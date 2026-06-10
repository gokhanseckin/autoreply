import type { FlowStep } from './schema';
import { appendPrivacyFooter } from '@/lib/consent/footer';
import { resolveCollectEmailText } from '@/lib/consent/collect-email-step-text';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';

export type Lang = 'tr' | 'en';

export type FlowContext = {
  steps: FlowStep[];
  language: Lang;
  currentStepId: string | null;
  contactId: string;
  igAccountId: string;
  flowId: string;
  pageAccessToken: string;
  igUserId: string;
  // When true (a fresh trigger), the privacy footer is appended to the first
  // non-plain message this run sends; later messages stay clean. Continuations
  // of an already-started conversation pass false so replies look natural.
  appendFooter?: boolean;
  // Set when the trigger was a public comment (e.g. a story comment): the very
  // first outbound message is addressed to the comment so Instagram opens the
  // DM thread. Subsequent messages go to the user normally. Buttons still work.
  replyToCommentId?: string;
};

export type Event =
  | { type: 'trigger' }
  | { type: 'button'; payload: string }
  | { type: 'text'; text: string };

export type Effects = {
  sendText: (args: { token: string; igUserId: string; text: string; commentId?: string }) => Promise<{ message_id: string }>;
  sendButtons: (args: { token: string; igUserId: string; text: string; buttons: { type: 'postback' | 'web_url'; title: string; payload?: string; url?: string }[]; commentId?: string }) => Promise<{ message_id: string }>;
  recordLink: (args: { flowId: string; stepId: string; label: string; destinationUrl: string; contactId: string }) => Promise<string>;
  logSend: (args: { messageType: string; payload: unknown; metaMessageId: string }) => Promise<void>;
};

export type AdvanceResult = {
  nextStepId: string | null;
  awaitingInputType: 'button' | 'text' | 'email' | null;
  expiresAt: string | null;
};


function findStep(ctx: FlowContext, id: string): FlowStep {
  const step = ctx.steps.find((s) => s.id === id);
  if (!step) throw new Error(`Step ${id} not found`);
  return step;
}

function firstStep(ctx: FlowContext): FlowStep {
  if (!ctx.steps.length) throw new Error('Flow has no steps');
  return ctx.steps[0];
}

export async function advance(ctx: FlowContext, event: Event, effects: Effects): Promise<AdvanceResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const stepId = ctx.currentStepId ?? firstStep(ctx).id;
  let step = findStep(ctx, stepId);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  // The footer rides only the first non-plain message of a fresh trigger.
  let footerUsed = false;
  const withFooter = (body: string): string => {
    if (ctx.appendFooter && !footerUsed) {
      footerUsed = true;
      return appendPrivacyFooter(body, ctx.language);
    }
    return body;
  };

  // Only the first message addresses the comment (to open the DM); the rest go
  // to the user. consumeCommentId() returns it once, then undefined thereafter.
  let pendingCommentId = ctx.replyToCommentId;
  const consumeCommentId = (): string | undefined => {
    const id = pendingCommentId;
    pendingCommentId = undefined;
    return id;
  };

  while (true) {
    if (step.type === 'send_message') {
      // Re-entry after the user tapped one of this step's buttons. The postback
      // payload encodes the chosen target (a step id, or `END_<id>` to finish),
      // so route by the actual button pressed instead of guessing.
      if (event.type === 'button' && step.buttons && step.buttons.length) {
        const payload = event.payload;
        if (payload.startsWith('END_')) {
          return { nextStepId: null, awaitingInputType: null, expiresAt: null };
        }
        const target = ctx.steps.find((s) => s.id === payload);
        if (!target) return { nextStepId: null, awaitingInputType: null, expiresAt: null };
        step = target;
        if (target.type !== 'wait_for_button' || !target.expected_payloads.includes(payload)) {
          event = { type: 'trigger' };
        }
        continue;
      }

      // Plain messages render as an ordinary text DM: no footer, no buttons.
      if (step.buttons && step.buttons.length && !step.plain) {
        const text = withFooter(step.text);
        const buttons = step.buttons.map((b) => {
          if (b.action.type === 'url') return { type: 'web_url' as const, title: b.label, url: b.action.url };
          return { type: 'postback' as const, title: b.label, payload: b.action.type === 'next' ? b.action.next_id : `END_${step.id}` };
        });
        const sent = await effects.sendButtons({ token: ctx.pageAccessToken, igUserId: ctx.igUserId, text, buttons, commentId: consumeCommentId() });
        await effects.logSend({ messageType: 'buttons', payload: { text, buttons }, metaMessageId: sent.message_id });
        // Wait on this step itself; the next button tap re-enters here and routes by payload.
        return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
      } else {
        const text = step.plain ? step.text : withFooter(step.text);
        const sent = await effects.sendText({ token: ctx.pageAccessToken, igUserId: ctx.igUserId, text, commentId: consumeCommentId() });
        await effects.logSend({ messageType: 'text', payload: { text, plain: step.plain ?? false }, metaMessageId: sent.message_id });
        if (step.next_id) { step = findStep(ctx, step.next_id); continue; }
        return { nextStepId: null, awaitingInputType: null, expiresAt };
      }
    }

    if (step.type === 'send_link') {
      const code = await effects.recordLink({ flowId: ctx.flowId, stepId: step.id, label: step.label, destinationUrl: step.destination_url, contactId: ctx.contactId });
      const url = `${baseUrl}/r/${code}`;
      const text = withFooter(step.text);
      const sent = await effects.sendButtons({ token: ctx.pageAccessToken, igUserId: ctx.igUserId, text, buttons: [{ type: 'web_url', title: step.label, url }], commentId: consumeCommentId() });
      await effects.logSend({ messageType: 'buttons', payload: { text, link_code: code, destination: step.destination_url }, metaMessageId: sent.message_id });
      if (step.next_id) { step = findStep(ctx, step.next_id); continue; }
      return { nextStepId: null, awaitingInputType: null, expiresAt };
    }

    if (step.type === 'wait_for_button') {
      if (event.type === 'button' && step.expected_payloads.includes(event.payload)) {
        const next = step.on_each[event.payload];
        step = findStep(ctx, next);
        event = { type: 'trigger' };
        continue;
      }
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }

    if (step.type === 'wait_for_text') {
      if (event.type === 'text') {
        const ok = step.regex ? new RegExp(step.regex).test(event.text) : true;
        if (ok) { step = findStep(ctx, step.on_match_next_id); event = { type: 'trigger' }; continue; }
        if (step.on_miss === 'retry') return { nextStepId: step.id, awaitingInputType: 'text', expiresAt };
        if (step.on_miss === 'end') return { nextStepId: null, awaitingInputType: null, expiresAt };
        step = findStep(ctx, step.on_miss); event = { type: 'trigger' }; continue;
      }
      return { nextStepId: step.id, awaitingInputType: 'text', expiresAt };
    }

    if (step.type === 'collect_email') {
      const ct = resolveCollectEmailText(step, ctx.language);
      const sent = await effects.sendButtons({
        token: ctx.pageAccessToken,
        igUserId: ctx.igUserId,
        // The consent disclaimer always carries the privacy/KVKK footer.
        text: appendPrivacyFooter(ct.disclaimer, ctx.language),
        buttons: [
          { type: 'postback', title: ct.accept, payload: `EMAIL_AGREE_${step.id}` },
          { type: 'postback', title: ct.decline, payload: `EMAIL_DECLINE_${step.id}` },
        ],
        commentId: consumeCommentId(),
      });
      await effects.logSend({ messageType: 'buttons', payload: { stage: 'email_consent', step: step.id, policy_version: CURRENT_POLICY_VERSION }, metaMessageId: sent.message_id });
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }

    if (step.type === 'branch') {
      if (event.type === 'button') {
        const buttonPayload = event.payload;
        const hit = step.cases.find((c) => c.when === buttonPayload);
        if (hit) { step = findStep(ctx, hit.next_id); event = { type: 'trigger' }; continue; }
        if (step.default_next_id) { step = findStep(ctx, step.default_next_id); event = { type: 'trigger' }; continue; }
      }
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }

    if (step.type === 'end') {
      return { nextStepId: null, awaitingInputType: null, expiresAt: null };
    }

    throw new Error(`Unhandled step type`);
  }
}
