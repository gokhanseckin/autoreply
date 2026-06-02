import { MetaWebhookSchema, CommentValue, isStoryComment } from '@/lib/meta/types';
import { matchesErasureKeyword } from '@/lib/flow-engine/reserved-keywords';
import { findCommentFlow, findDmFlow, findStoryReplyFlow } from '@/lib/flow-engine/routing';
import { advance, type AdvanceResult, type Effects, type Lang } from '@/lib/flow-engine/machine';
import { buildErasureSteps, ERASURE_FLOW_ID } from '@/lib/flow-engine/erasure-flow';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';
import { findIgAccountByBusinessId, upsertContact, loadConversationState, saveConversationState, alreadyProcessed, logMessage } from '@/lib/db/queries';
import { decryptSecret, decodeBytea } from '@/lib/db/encryption';
import { sendButtons, sendText, sendPrivateReplyToComment } from '@/lib/meta/client';
import { generateLinkCode } from '@/lib/links/shorten';
import { serviceClient } from '@/lib/db/client';
import { FlowStepsSchema, type FlowStep } from '@/lib/flow-engine/schema';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';
import { appendPrivacyFooter } from '@/lib/consent/footer';
import { captureEmail } from '@/lib/flow-engine/email-step';
import { EMAIL_CONSENT_EN } from '@/lib/consent/email-consent-text.en';
import { EMAIL_CONSENT_TR } from '@/lib/consent/email-consent-text.tr';
import type { ProviderConfig } from '@/lib/email-providers/factory';
import type { Json } from '@/lib/db/types';

function buildEffects(token: string, igAccountId: string, contactId: string): Effects {
  return {
    sendText: ({ token: t, igUserId, text, commentId }) => sendText({ pageAccessToken: t, igUserId, text, commentId }),
    sendButtons: ({ token: t, igUserId, text, buttons, commentId }) => sendButtons({ pageAccessToken: t, igUserId, text, buttons: buttons as any, commentId }),
    recordLink: async ({ flowId, stepId, label, destinationUrl, contactId: c }) => {
      const db = serviceClient();
      const { data: link } = await db.from('links').insert({ flow_id: flowId, step_id: stepId, label, destination_url: destinationUrl }).select().single();
      if (!link) throw new Error('failed to insert link');
      const code = generateLinkCode();
      await db.from('link_codes').insert({ link_id: link.id, contact_id: c, code });
      return code;
    },
    logSend: ({ messageType, payload, metaMessageId }) =>
      logMessage({ ig_account_id: igAccountId, contact_id: contactId, direction: 'out', message_type: messageType, payload: payload as any, meta_message_id: metaMessageId }).then(() => {}),
  };
}

function decryptToken(enc: string): Promise<string> {
  return decryptSecret(decodeBytea(enc));
}

function logWebhookDecision(event: string, details: Record<string, unknown> = {}) {
  console.info('[webhook:meta]', JSON.stringify({ event, ...details }));
}

function shortId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function entryChanges(entry: { field?: string; value?: unknown; changes?: Array<{ field: string; value: unknown }> }) {
  const direct = entry.field ? [{ field: entry.field, value: entry.value }] : [];
  return [...direct, ...(entry.changes ?? [])];
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sortedKeys(value: unknown): string[] {
  const record = objectRecord(value);
  return record ? Object.keys(record).sort() : [];
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function messagingShapeDetails(args: {
  entryId: string;
  mid: string;
  message: unknown;
}) {
  const message = objectRecord(args.message);
  const nestedMessage = objectRecord(message?.message);
  const postback = objectRecord(message?.postback);
  const replyTo = objectRecord(nestedMessage?.reply_to);
  const story = objectRecord(replyTo?.story);
  const attachments = arrayFrom(nestedMessage?.attachments);
  return {
    mid: shortId(args.mid),
    entryId: shortId(args.entryId),
    topLevelKeys: sortedKeys(message),
    hasMessage: !!nestedMessage,
    messageKeys: sortedKeys(nestedMessage),
    hasText: typeof nestedMessage?.text === 'string' && nestedMessage.text.length > 0,
    hasPostback: !!postback,
    postbackKeys: sortedKeys(postback),
    replyToKeys: sortedKeys(replyTo),
    replyToHasStory: !!story,
    storyKeys: sortedKeys(story),
    attachmentCount: attachments.length,
    attachmentTypes: attachments.slice(0, 5).map((attachment) => {
      const record = objectRecord(attachment);
      return typeof record?.type === 'string' ? record.type : typeof attachment;
    }),
  };
}

function parseCommentValues(value: unknown) {
  const items = Array.isArray(value) ? value : [value];
  const results = items.map((item) => CommentValue.safeParse(item));
  return {
    comments: results.flatMap((result) => (result.success ? [result.data] : [])),
    issues: results.flatMap((result) =>
      result.success
        ? []
        : result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
    ),
  };
}

function expiresIn24h(): string {
  return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
}

function completed(): AdvanceResult {
  return { nextStepId: null, awaitingInputType: null, expiresAt: null };
}

async function saveFlowResult(contactId: string, flowId: string, result: AdvanceResult, context: Json = {}) {
  await saveConversationState({
    contact_id: contactId,
    current_flow_id: result.nextStepId ? flowId : null,
    current_step_id: result.nextStepId,
    awaiting_input_type: result.awaitingInputType,
    expires_at: result.expiresAt,
    context,
  });
}

function providerConfigFrom(value: unknown): ProviderConfig {
  if (!value || typeof value !== 'object') return { kind: 'none' };
  const cfg = value as Record<string, unknown>;
  if (cfg.kind === 'resend' && typeof cfg.api_key_enc === 'string' && typeof cfg.audience_id === 'string') {
    return { kind: 'resend', api_key_enc: cfg.api_key_enc, audience_id: cfg.audience_id };
  }
  if (cfg.kind === 'mailchimp' && typeof cfg.api_key_enc === 'string' && typeof cfg.audience_id === 'string') {
    return { kind: 'mailchimp', api_key_enc: cfg.api_key_enc, audience_id: cfg.audience_id };
  }
  return { kind: 'none' };
}

function emailConsentText(lang: Lang) {
  return lang === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN;
}

async function advanceFromNext(args: {
  step: Extract<FlowStep, { type: 'collect_email' | 'send_message' }>;
  steps: FlowStep[];
  language: Lang;
  contactId: string;
  igAccountId: string;
  flowId: string;
  pageAccessToken: string;
  igUserId: string;
  effects: Effects;
}): Promise<AdvanceResult> {
  if (!args.step.next_id) return completed();
  return advance(
    {
      steps: args.steps,
      language: args.language,
      currentStepId: args.step.next_id,
      contactId: args.contactId,
      igAccountId: args.igAccountId,
      flowId: args.flowId,
      pageAccessToken: args.pageAccessToken,
      igUserId: args.igUserId,
      // A continuation of an already-greeted conversation — keep it footer-free.
      appendFooter: false,
    },
    { type: 'trigger' },
    args.effects,
  );
}

async function sendTextWithLog(args: {
  token: string;
  igUserId: string;
  igAccountId: string;
  contactId: string;
  language: Lang;
  text: string;
  appendFooter?: boolean;
}) {
  const text = args.appendFooter === false ? args.text : appendPrivacyFooter(args.text, args.language);
  const sent = await sendText({ pageAccessToken: args.token, igUserId: args.igUserId, text });
  await logMessage({
    ig_account_id: args.igAccountId,
    contact_id: args.contactId,
    direction: 'out',
    message_type: 'text',
    payload: { text },
    meta_message_id: sent.message_id,
  });
}

async function maybeHandleEmailStep(args: {
  state: { current_step_id: string | null; awaiting_input_type: string | null; context: unknown };
  flow: { id: string; name: string; language: string; steps: unknown };
  account: { id: string; email_provider_config: unknown };
  contact: { id: string; ig_username: string | null };
  token: string;
  igUserId: string;
  event: { postback?: { payload: string }; text?: string };
  effects: Effects;
}): Promise<boolean> {
  const steps = FlowStepsSchema.parse(args.flow.steps);
  const step = steps.find((s) => s.id === args.state.current_step_id);
  if (!step || step.type !== 'collect_email') return false;

  const language = args.flow.language as Lang;

  if (args.event.postback?.payload === `EMAIL_AGREE_${step.id}`) {
    const { error } = await serviceClient().from('consent_log').insert({
      contact_id: args.contact.id,
      consent_type: 'email_capture',
      consent_text_version: CURRENT_POLICY_VERSION,
    });
    if (error) throw error;
    await saveConversationState({
      contact_id: args.contact.id,
      current_flow_id: args.flow.id,
      current_step_id: step.id,
      awaiting_input_type: 'email',
      expires_at: expiresIn24h(),
      context: { email: { stepId: step.id, retries: 0 } },
    });
    await sendTextWithLog({
      token: args.token,
      igUserId: args.igUserId,
      igAccountId: args.account.id,
      contactId: args.contact.id,
      language,
      text: emailConsentText(language).prompt,
      appendFooter: false,
    });
    return true;
  }

  if (args.event.postback?.payload === `EMAIL_DECLINE_${step.id}`) {
    const result = await advanceFromNext({
      step,
      steps,
      language,
      contactId: args.contact.id,
      igAccountId: args.account.id,
      flowId: args.flow.id,
      pageAccessToken: args.token,
      igUserId: args.igUserId,
      effects: args.effects,
    });
    await saveFlowResult(args.contact.id, args.flow.id, result);
    return true;
  }

  if (args.state.awaiting_input_type !== 'email') return false;
  if (!args.event.text) {
    await saveConversationState({
      contact_id: args.contact.id,
      current_flow_id: args.flow.id,
      current_step_id: step.id,
      awaiting_input_type: 'email',
      expires_at: expiresIn24h(),
      context: args.state.context as Json,
    });
    return true;
  }

  const captured = await captureEmail({
    igAccountId: args.account.id,
    contactId: args.contact.id,
    igUsername: args.contact.ig_username,
    flowId: args.flow.id,
    flowName: args.flow.name,
    language,
    emailText: args.event.text,
    providerConfig: providerConfigFrom(args.account.email_provider_config),
  });
  await sendTextWithLog({
    token: args.token,
    igUserId: args.igUserId,
    igAccountId: args.account.id,
    contactId: args.contact.id,
    language,
    text: captured.message,
  });

  if (!captured.ok) {
    const emailContext = (args.state.context && typeof args.state.context === 'object' && 'email' in args.state.context)
      ? (args.state.context as { email?: { retries?: number } }).email
      : undefined;
    const retries = (emailContext?.retries ?? 0) + 1;
    if (retries < 3) {
      await saveConversationState({
        contact_id: args.contact.id,
        current_flow_id: args.flow.id,
        current_step_id: step.id,
        awaiting_input_type: 'email',
        expires_at: expiresIn24h(),
        context: { email: { stepId: step.id, retries } },
      });
      return true;
    }
  }

  const result = await advanceFromNext({
    step,
    steps,
    language,
    contactId: args.contact.id,
    igAccountId: args.account.id,
    flowId: args.flow.id,
    pageAccessToken: args.token,
    igUserId: args.igUserId,
    effects: args.effects,
  });
  await saveFlowResult(args.contact.id, args.flow.id, result);
  return true;
}

export async function handleMetaWebhook(rawBody: string): Promise<{ status: number; body?: string }> {
  const parsed = MetaWebhookSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    logWebhookDecision('schema_rejected', { issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) });
    return { status: 200 };
  }
  logWebhookDecision('parsed', { entries: parsed.data.entry.length });

  for (const entry of parsed.data.entry) {
    logWebhookDecision('entry', {
      entryId: shortId(entry.id),
      directField: entry.field ?? null,
      changes: entry.changes?.length ?? 0,
      messaging: entry.messaging?.length ?? 0,
    });

    // Comments
    for (const change of entryChanges(entry)) {
      // Log the field of every change so a story comment delivered under an
      // unexpected field name is visible instead of silently skipped.
      logWebhookDecision('change_field', { entryId: shortId(entry.id), field: change.field });
      if (change.field !== 'comments') continue;
      const parsedValues = parseCommentValues(change.value);
      if (parsedValues.comments.length === 0) {
        logWebhookDecision('comment_value_rejected', {
          entryId: shortId(entry.id),
          issues: parsedValues.issues,
        });
        continue;
      }
      if (parsedValues.issues.length > 0) {
        logWebhookDecision('comment_value_partially_rejected', {
          entryId: shortId(entry.id),
          issues: parsedValues.issues,
        });
      }
      for (const v of parsedValues.comments) {
        logWebhookDecision('comment_parsed', {
          entryId: shortId(entry.id),
          commentId: shortId(v.id),
          mediaProductType: v.media.media_product_type ?? null,
          isStory: isStoryComment(v),
        });
        if (await alreadyProcessed(v.id)) {
          logWebhookDecision('comment_duplicate', { commentId: shortId(v.id) });
          continue;
        }
        const account = await findIgAccountByBusinessId(entry.id);
        logWebhookDecision('comment_account_lookup', { entryId: shortId(entry.id), found: !!account, accountId: shortId(account?.id) });
        if (!account) continue;
        // Public story comments arrive on the same `comments` channel as post
        // comments but aren't tied to a post — route them to the account's
        // story-reply flows so the same keywords fire whether a user replies to
        // a story (DM) or comments on it.
        const storyComment = isStoryComment(v);
        const flow = storyComment
          ? await findStoryReplyFlow({ igAccountId: account.id, text: v.text })
          : await findCommentFlow({ igAccountId: account.id, postId: v.media.id, commentText: v.text });
        logWebhookDecision('comment_flow_lookup', {
          mediaId: shortId(v.media.id),
          source: storyComment ? 'story_comment' : 'post_comment',
          matched: !!flow,
          flowId: shortId(flow?.id),
        });
        if (!flow) continue;
        const commenterId = v.from.id ?? `comment:${v.id}`;
        const contact = await upsertContact({ igAccountId: account.id, igUserId: commenterId, igUsername: v.from.username });
        const token = await decryptToken(account.page_access_token_enc);
        const steps = FlowStepsSchema.parse(flow.steps);
        let result = completed();
        if (storyComment) {
          // A public story comment is just a story reply that happens to be
          // public: run the same flow as a DM. The opening message is addressed to
          // the comment so Instagram delivers it to the user's inbox; buttons,
          // links and footer-on-first all behave exactly like a story reply.
          result = await advance(
            { steps, language: flow.language as Lang, currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: commenterId, appendFooter: true, replyToCommentId: v.id },
            { type: 'trigger' },
            buildEffects(token, account.id, contact.id),
          );
        } else {
          const firstStep = steps[0];
          if (firstStep?.type === 'send_message' && (!firstStep.buttons || firstStep.buttons.length === 0)) {
            // First touch from a post comment: footer the opening private reply
            // (unless it's an intentionally plain message), then continue clean.
            const replyText = firstStep.plain ? firstStep.text : appendPrivacyFooter(firstStep.text, flow.language as Lang);
            await sendPrivateReplyToComment({ pageAccessToken: token, commentId: v.id, text: replyText });
            await logMessage({ ig_account_id: account.id, contact_id: contact.id, direction: 'out', message_type: 'private_reply', payload: { text: replyText, plain: firstStep.plain ?? false }, meta_message_id: v.id });
            result = await advanceFromNext({
              step: firstStep,
              steps,
              language: flow.language as Lang,
              contactId: contact.id,
              igAccountId: account.id,
              flowId: flow.id,
              pageAccessToken: token,
              igUserId: commenterId,
              effects: buildEffects(token, account.id, contact.id),
            });
          } else {
            result = await advance(
              { steps, language: flow.language as Lang, currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: commenterId, appendFooter: true },
              { type: 'trigger' },
              buildEffects(token, account.id, contact.id),
            );
          }
        }
        await saveFlowResult(contact.id, flow.id, result);
      }
    }

    // Messages and postbacks
    for (const m of entry.messaging ?? []) {
      const mid = m.message?.mid ?? m.postback?.mid ?? `${m.sender.id}:${m.timestamp}`;
      logWebhookDecision('message_received', {
        mid: shortId(mid),
        entryId: shortId(entry.id),
        senderId: shortId(m.sender.id),
        recipientId: shortId(m.recipient.id),
        kind: m.postback ? 'postback' : 'message',
        hasText: !!m.message?.text,
        textPreview: m.message?.text?.slice(0, 80) ?? null,
        postbackPayload: m.postback?.payload ?? null,
      });
      if (m.sender.id === entry.id || m.sender.id === m.recipient.id) {
        logWebhookDecision('message_ignored_echo', { mid: shortId(mid), senderId: shortId(m.sender.id) });
        continue;
      }
      const hasActionableText = typeof m.message?.text === 'string' && m.message.text.trim().length > 0;
      const hasActionablePostback = typeof m.postback?.payload === 'string' && m.postback.payload.length > 0;
      if (!hasActionableText && !hasActionablePostback) {
        logWebhookDecision('message_ignored_non_actionable_shape', messagingShapeDetails({ entryId: entry.id, mid, message: m }));
        logWebhookDecision('message_ignored_non_actionable', { mid: shortId(mid) });
        continue;
      }
      if (await alreadyProcessed(mid)) {
        logWebhookDecision('message_duplicate', { mid: shortId(mid) });
        continue;
      }
      const account = await findIgAccountByBusinessId(entry.id);
      logWebhookDecision('message_account_lookup', { entryId: shortId(entry.id), found: !!account, accountId: shortId(account?.id) });
      if (!account) continue;
      const contact = await upsertContact({ igAccountId: account.id, igUserId: m.sender.id });
      const token = await decryptToken(account.page_access_token_enc);
      await logMessage({ ig_account_id: account.id, contact_id: contact.id, direction: 'in', message_type: m.postback ? 'postback' : 'text', payload: m as any, meta_message_id: mid });

      if (m.message?.text && matchesErasureKeyword(m.message.text)) {
        const result = await advance(
          { steps: buildErasureSteps((account.default_language as 'tr' | 'en')), language: account.default_language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: ERASURE_FLOW_ID, pageAccessToken: token, igUserId: m.sender.id, appendFooter: true },
          { type: 'trigger' },
          buildEffects(token, account.id, contact.id),
        );
        await saveConversationState({ contact_id: contact.id, current_flow_id: null, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: { erasure: true } });
        continue;
      }

      const state = await loadConversationState(contact.id);
      logWebhookDecision('conversation_state', {
        contactId: shortId(contact.id),
        currentFlowId: shortId(state?.current_flow_id),
        currentStepId: state?.current_step_id ?? null,
        awaitingInputType: state?.awaiting_input_type ?? null,
      });
      if (state?.context && (state.context as any).erasure && m.postback) {
        if (m.postback.payload === 'execute') {
          await executeErasure({ contactId: contact.id, requestedVia: 'dm' });
          continue;
        }
      }

      if (state?.current_flow_id) {
        const flow = await serviceClient().from('flows').select('*').eq('id', state.current_flow_id).maybeSingle();
        logWebhookDecision('active_flow_lookup', { flowId: shortId(state.current_flow_id), found: !!flow.data });
        if (flow.data) {
          const effects = buildEffects(token, account.id, contact.id);
          const handledEmail = await maybeHandleEmailStep({
            state,
            flow: flow.data,
            account,
            contact,
            token,
            igUserId: m.sender.id,
            event: m.postback ? { postback: m.postback } : { text: m.message?.text ?? '' },
            effects,
          });
          logWebhookDecision('active_flow_email_gate', { handled: handledEmail });
          if (handledEmail) continue;

          const event = m.postback
            ? { type: 'button' as const, payload: m.postback.payload }
            : { type: 'text' as const, text: m.message?.text ?? '' };
          const result = await advance(
            { steps: FlowStepsSchema.parse(flow.data.steps), language: flow.data.language as Lang, currentStepId: state.current_step_id, contactId: contact.id, igAccountId: account.id, flowId: flow.data.id, pageAccessToken: token, igUserId: m.sender.id, appendFooter: false },
            event,
            effects,
          );
          await saveFlowResult(contact.id, flow.data.id, result);
          logWebhookDecision('active_flow_advanced', {
            flowId: shortId(flow.data.id),
            nextStepId: result.nextStepId,
            awaitingInputType: result.awaitingInputType,
          });
          continue;
        }
      }

      let flow = null;
      if (m.message?.reply_to?.story && m.message.text) {
        flow = await findStoryReplyFlow({ igAccountId: account.id, text: m.message.text });
      } else if (m.message?.text) {
        flow = await findDmFlow({ igAccountId: account.id, text: m.message.text });
      }
      logWebhookDecision('new_flow_lookup', {
        triggerType: m.message?.reply_to?.story ? 'story_reply' : m.message?.text ? 'dm' : 'none',
        matched: !!flow,
        flowId: shortId(flow?.id),
      });
      if (!flow) continue;
      const result = await advance(
        { steps: FlowStepsSchema.parse(flow.steps), language: flow.language as Lang, currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: m.sender.id, appendFooter: true },
        { type: 'trigger' },
        buildEffects(token, account.id, contact.id),
      );
      await saveFlowResult(contact.id, flow.id, result);
      logWebhookDecision('new_flow_advanced', {
        flowId: shortId(flow.id),
        nextStepId: result.nextStepId,
        awaitingInputType: result.awaitingInputType,
      });
    }
  }

  return { status: 200 };
}
