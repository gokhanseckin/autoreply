import { MetaWebhookSchema } from '@/lib/meta/types';
import { matchesErasureKeyword } from '@/lib/flow-engine/reserved-keywords';
import { findCommentFlow, findDmFlow, findStoryReplyFlow } from '@/lib/flow-engine/routing';
import { advance, type Effects } from '@/lib/flow-engine/machine';
import { buildErasureSteps, ERASURE_FLOW_ID } from '@/lib/flow-engine/erasure-flow';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';
import { findIgAccountByBusinessId, upsertContact, loadConversationState, saveConversationState, alreadyProcessed, logMessage } from '@/lib/db/queries';
import { decryptSecret, decodeBytea } from '@/lib/db/encryption';
import { sendButtons, sendText, sendPrivateReplyToComment } from '@/lib/meta/client';
import { generateLinkCode } from '@/lib/links/shorten';
import { serviceClient } from '@/lib/db/client';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';

function buildEffects(token: string, igAccountId: string, contactId: string): Effects {
  return {
    sendText: ({ token: t, igUserId, text }) => sendText({ pageAccessToken: t, igUserId, text }),
    sendButtons: ({ token: t, igUserId, text, buttons }) => sendButtons({ pageAccessToken: t, igUserId, text, buttons: buttons as any }),
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

export async function handleMetaWebhook(rawBody: string): Promise<{ status: number; body?: string }> {
  console.error('[webhook] raw', rawBody.slice(0, 2000));
  const parsed = MetaWebhookSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    console.error('[webhook] schema fail', JSON.stringify(parsed.error.issues));
    return { status: 200 };
  }
  console.error('[webhook] parsed entries:', parsed.data.entry.length);

  for (const entry of parsed.data.entry) {
    // Comments
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (await alreadyProcessed(v.id)) continue;
      const account = await findIgAccountByBusinessId(entry.id);
      if (!account) continue;
      const flow = await findCommentFlow({ igAccountId: account.id, postId: v.media.id, commentText: v.text });
      if (!flow) continue;
      const contact = await upsertContact({ igAccountId: account.id, igUserId: v.from.id, igUsername: v.from.username });
      const token = await decryptToken(account.page_access_token_enc);
      const firstStep = FlowStepsSchema.parse(flow.steps)[0];
      if (firstStep?.type === 'send_message' && (!firstStep.buttons || firstStep.buttons.length === 0)) {
        await sendPrivateReplyToComment({ pageAccessToken: token, commentId: v.id, text: firstStep.text });
        await logMessage({ ig_account_id: account.id, contact_id: contact.id, direction: 'out', message_type: 'private_reply', payload: { text: firstStep.text }, meta_message_id: v.id });
      }
      const result = await advance(
        { steps: FlowStepsSchema.parse(flow.steps), language: flow.language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: v.from.id },
        { type: 'trigger' },
        buildEffects(token, account.id, contact.id),
      );
      await saveConversationState({ contact_id: contact.id, current_flow_id: flow.id, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: {} });
    }

    // Messages and postbacks
    for (const m of entry.messaging ?? []) {
      const mid = m.message?.mid ?? m.postback?.mid ?? `${m.sender.id}:${m.timestamp}`;
      console.error('[webhook] msg', { mid, entryId: entry.id, sender: m.sender.id, text: m.message?.text });
      if (await alreadyProcessed(mid)) { console.error('[webhook] skip dup', mid); continue; }
      const account = await findIgAccountByBusinessId(entry.id);
      console.error('[webhook] account lookup', { entryId: entry.id, found: !!account, accountId: account?.id });
      if (!account) continue;
      const contact = await upsertContact({ igAccountId: account.id, igUserId: m.sender.id });
      const token = await decryptToken(account.page_access_token_enc);
      await logMessage({ ig_account_id: account.id, contact_id: contact.id, direction: 'in', message_type: m.postback ? 'postback' : 'text', payload: m as any, meta_message_id: mid });

      if (m.message?.text && matchesErasureKeyword(m.message.text)) {
        const result = await advance(
          { steps: buildErasureSteps((account.default_language as 'tr' | 'en')), language: account.default_language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: ERASURE_FLOW_ID, pageAccessToken: token, igUserId: m.sender.id },
          { type: 'trigger' },
          buildEffects(token, account.id, contact.id),
        );
        await saveConversationState({ contact_id: contact.id, current_flow_id: null, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: { erasure: true } });
        continue;
      }

      const state = await loadConversationState(contact.id);
      if (state?.context && (state.context as any).erasure && m.postback) {
        if (m.postback.payload === 'execute') {
          await executeErasure({ contactId: contact.id, requestedVia: 'dm' });
          continue;
        }
      }

      if (state?.current_flow_id) {
        const flow = await serviceClient().from('flows').select('*').eq('id', state.current_flow_id).maybeSingle();
        if (flow.data) {
          const event = m.postback
            ? { type: 'button' as const, payload: m.postback.payload }
            : { type: 'text' as const, text: m.message?.text ?? '' };
          const result = await advance(
            { steps: FlowStepsSchema.parse(flow.data.steps), language: flow.data.language as 'tr' | 'en', currentStepId: state.current_step_id, contactId: contact.id, igAccountId: account.id, flowId: flow.data.id, pageAccessToken: token, igUserId: m.sender.id },
            event,
            buildEffects(token, account.id, contact.id),
          );
          await saveConversationState({ contact_id: contact.id, current_flow_id: result.nextStepId ? flow.data.id : null, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: {} });
          continue;
        }
      }

      let flow = null;
      if (m.message?.reply_to?.story && m.message.text) {
        flow = await findStoryReplyFlow({ igAccountId: account.id, text: m.message.text });
      } else if (m.message?.text) {
        flow = await findDmFlow({ igAccountId: account.id, text: m.message.text });
      }
      if (!flow) continue;
      const result = await advance(
        { steps: FlowStepsSchema.parse(flow.steps), language: flow.language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: m.sender.id },
        { type: 'trigger' },
        buildEffects(token, account.id, contact.id),
      );
      await saveConversationState({ contact_id: contact.id, current_flow_id: flow.id, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: {} });
    }
  }

  return { status: 200 };
}
