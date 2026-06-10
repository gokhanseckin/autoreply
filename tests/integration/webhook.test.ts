import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { POST } from '@/app/api/webhooks/meta/route';
import comment from '../fixtures/meta/comment.json';
import message from '../fixtures/meta/message.json';
import storyReply from '../fixtures/meta/story_reply.json';
import storyComment from '../fixtures/meta/story_comment.json';
import { findCommentFlow, findDmFlow, findStoryReplyFlow } from '@/lib/flow-engine/routing';
import { claimInboundMessage, findIgAccountByBusinessId, loadConversationState, logMessage, saveConversationState } from '@/lib/db/queries';
import { captureEmail } from '@/lib/flow-engine/email-step';

const dbState = vi.hoisted(() => ({
  flow: null as any,
  flowError: null as any,
  inserts: [] as { table: string; row: unknown }[],
}));

vi.mock('@/lib/db/queries', () => ({
  findIgAccountByBusinessId: vi.fn().mockResolvedValue({ id: 'a1', name: 'Main', default_language: 'en', page_access_token_enc: Buffer.alloc(48).toString('base64'), email_provider_config: { kind: 'none' } }),
  upsertContact: vi.fn().mockResolvedValue({ id: 'c1', ig_username: 'test_user' }),
  loadConversationState: vi.fn().mockResolvedValue(null),
  saveConversationState: vi.fn().mockResolvedValue(undefined),
  alreadyProcessed: vi.fn().mockResolvedValue(false),
  claimInboundMessage: vi.fn().mockResolvedValue(true),
  logMessage: vi.fn().mockResolvedValue({ id: 'log1' }),
}));
vi.mock('@/lib/flow-engine/routing', () => ({
  findCommentFlow: vi.fn().mockResolvedValue({ id: 'f1', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Hi' }] }),
  findDmFlow: vi.fn(), findStoryReplyFlow: vi.fn(),
}));
vi.mock('@/lib/db/encryption', () => ({
  decryptSecret: vi.fn().mockResolvedValue('TOKEN'),
  decodeBytea: vi.fn(() => new Uint8Array(0)),
  encodeBytea: vi.fn(() => '\\x00'),
}));
vi.mock('@/lib/meta/client', () => ({
  sendText: vi.fn().mockResolvedValue({ message_id: 'm' }),
  sendButtons: vi.fn().mockResolvedValue({ message_id: 'm' }),
  sendPrivateReplyToComment: vi.fn().mockResolvedValue({ message_id: 'm' }),
}));
vi.mock('@/lib/links/shorten', () => ({ generateLinkCode: vi.fn(() => 'CODE') }));
vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: table === 'flows' ? dbState.flow : null, error: table === 'flows' ? dbState.flowError : null }),
        insert: (row: unknown) => {
          dbState.inserts.push({ table, row });
          return builder;
        },
        single: async () => ({ data: { id: 'L1' }, error: null }),
      };
      return builder;
    },
  }),
}));
vi.mock('@/lib/flow-engine/erasure-execute', () => ({ executeErasure: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/flow-engine/email-step', () => ({
  captureEmail: vi.fn().mockResolvedValue({ ok: true, status: 'confirmed', message: 'Confirmed' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  dbState.flow = null;
  dbState.flowError = null;
  dbState.inserts = [];
  vi.mocked(findCommentFlow).mockResolvedValue({ id: 'f1', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Hi' }] } as any);
  vi.mocked(findDmFlow).mockResolvedValue(null);
  vi.mocked(findStoryReplyFlow).mockResolvedValue(null);
  vi.mocked(loadConversationState).mockResolvedValue(null);
  vi.mocked(claimInboundMessage).mockResolvedValue(true);
  vi.mocked(captureEmail).mockResolvedValue({ ok: true, status: 'confirmed', message: 'Confirmed' });
});

function signed(body: string) {
  const sig = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(body).digest('hex');
  return new Request('http://localhost/api/webhooks/meta', {
    method: 'POST',
    body,
    headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json' },
  });
}

describe('POST /api/webhooks/meta', () => {
  it('rejects bad signature with 401', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(new Request('http://localhost/api/webhooks/meta', { method: 'POST', body: '{}', headers: { 'x-hub-signature-256': 'sha256=00' } }));
    expect(res.status).toBe(401);
    expect(errorSpy).toHaveBeenCalledWith('[webhook:meta]', expect.stringContaining('"event":"signature_rejected"'));
    // No fragment of the rejected signature belongs in the logs.
    expect(errorSpy).not.toHaveBeenCalledWith('[webhook:meta]', expect.stringContaining('signaturePrefix'));
    errorSpy.mockRestore();
  });

  it('processes a comment event end-to-end with valid signature', async () => {
    const body = JSON.stringify(comment);
    const res = await POST(signed(body));
    expect(res.status).toBe(200);
    const { sendPrivateReplyToComment, sendText } = await import('@/lib/meta/client');
    expect(sendPrivateReplyToComment).toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null,
      current_step_id: null,
      awaiting_input_type: null,
    }));
  });

  it('runs a public story comment through the story-reply flow as a DM addressed to the comment', async () => {
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Story comment matched' }] } as any);

    const res = await POST(signed(JSON.stringify(storyComment)));

    expect(res.status).toBe(200);
    expect(findStoryReplyFlow).toHaveBeenCalledWith({ igAccountId: 'a1', text: 'reply' });
    expect(findCommentFlow).not.toHaveBeenCalled();
    const { sendText, sendPrivateReplyToComment } = await import('@/lib/meta/client');
    // First (and only) message is addressed to the comment so it lands in DMs.
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ commentId: '18000000000000001', text: expect.stringContaining('Story comment matched') }));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
  });

  it('runs a direct-entry story comment payload through the story-reply flow', async () => {
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Story comment matched' }] } as any);
    const directStoryComment = {
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        field: 'comments',
        value: {
          id: '18000000000000001',
          from: { id: '8800000000000000', username: 'test_user' },
          media: { id: '17900000000000000', media_product_type: 'STORY' },
          text: 'reply',
        },
      }],
    };

    const res = await POST(signed(JSON.stringify(directStoryComment)));

    expect(res.status).toBe(200);
    expect(findStoryReplyFlow).toHaveBeenCalledWith({ igAccountId: 'a1', text: 'reply' });
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ commentId: '18000000000000001' }));
  });

  it('runs an array-shaped direct-entry story comment payload through the story-reply flow', async () => {
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Story comment matched' }] } as any);
    const directStoryComment = {
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        field: 'comments',
        value: [{
          id: '18000000000000003',
          from: { id: '8800000000000000', username: 'laraseckinn' },
          media: { id: '17900000000000000', media_product_type: 'STORY' },
          text: 'bravo',
        }],
      }],
    };

    const res = await POST(signed(JSON.stringify(directStoryComment)));

    expect(res.status).toBe(200);
    expect(findStoryReplyFlow).toHaveBeenCalledWith({ igAccountId: 'a1', text: 'bravo' });
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ commentId: '18000000000000003' }));
  });

  it('accepts direct-entry story comments when Meta omits the commenter id', async () => {
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Story comment matched' }] } as any);
    const directStoryComment = {
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        field: 'comments',
        value: {
          id: '18000000000000002',
          from: { username: 'test_user' },
          media: { id: '17900000000000000', media_product_type: 'STORY' },
          text: 'reply',
        },
      }],
    };

    const res = await POST(signed(JSON.stringify(directStoryComment)));

    expect(res.status).toBe(200);
    expect(findStoryReplyFlow).toHaveBeenCalledWith({ igAccountId: 'a1', text: 'reply' });
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ commentId: '18000000000000002' }));
  });

  it('starts a DM flow and clears state when the first step ends the flow', async () => {
    vi.mocked(findDmFlow).mockResolvedValue({ id: 'dm-flow', language: 'en', steps: [{ id: 'dm1', type: 'send_message', text: 'Welcome' }] } as any);

    const res = await POST(signed(JSON.stringify(message)));

    expect(res.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ igUserId: '8800000000000000' }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null,
      current_step_id: null,
      awaiting_input_type: null,
    }));
  });

  it('starts a story reply flow globally without checking DM flow routing', async () => {
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 'story1', type: 'send_message', text: 'Story reply matched' }] } as any);
    vi.mocked(findDmFlow).mockResolvedValue({ id: 'dm-flow', language: 'en', steps: [{ id: 'dm1', type: 'send_message', text: 'DM matched' }] } as any);

    const res = await POST(signed(JSON.stringify(storyReply)));

    expect(res.status).toBe(200);
    expect(findStoryReplyFlow).toHaveBeenCalledWith({ igAccountId: 'a1', text: 'reply' });
    expect(findDmFlow).not.toHaveBeenCalled();
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Story reply matched') }));
  });

  it('records email consent and waits for the next email text', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: 'email-flow',
      current_step_id: 'email1',
      awaiting_input_type: 'button',
      context: {},
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
          postback: { mid: 'MID-EMAIL-AGREE', payload: 'EMAIL_AGREE_email1', title: 'I agree' },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(dbState.inserts).toContainEqual(expect.objectContaining({
      table: 'consent_log',
      row: expect.objectContaining({ contact_id: 'c1', consent_type: 'email_capture' }),
    }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: 'email-flow',
      current_step_id: 'email1',
      awaiting_input_type: 'email',
    }));
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      igUserId: '8800000000000000',
      text: 'Please enter your email',
    }));
  });

  it('captures an awaited email text, sends the result message, and ends without a next step', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: 'email-flow',
      current_step_id: 'email1',
      awaiting_input_type: 'email',
      context: { email: { stepId: 'email1', retries: 0 } },
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
          message: { mid: 'MID-EMAIL-TEXT', text: 'person@example.com' },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(captureEmail).toHaveBeenCalledWith(expect.objectContaining({
      igAccountId: 'a1',
      contactId: 'c1',
      igUsername: 'test_user',
      flowId: 'email-flow',
      flowName: 'Lead flow',
      emailText: 'person@example.com',
      providerConfig: { kind: 'none' },
    }));
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Confirmed') }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null,
      current_step_id: null,
      awaiting_input_type: null,
    }));
  });

  it('does not re-prompt for the email when the provider fails — sends the fallback and moves on', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: 'email-flow',
      current_step_id: 'email1',
      awaiting_input_type: 'email',
      context: { email: { stepId: 'email1', retries: 0 } },
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email' }] };
    vi.mocked(captureEmail).mockResolvedValue({ ok: false, status: 'failed', message: "Thanks — we'll be in touch." });
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
          message: { mid: 'MID-EMAIL-PROVIDER-DOWN', text: 'person@example.com' },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Thanks — we'll be in touch.") }));
    // A provider outage is not the user's fault: never ask them to retype the email.
    expect(saveConversationState).not.toHaveBeenCalledWith(expect.objectContaining({ awaiting_input_type: 'email' }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null,
      current_step_id: null,
      awaiting_input_type: null,
    }));
  });

  it('logs the query error when the active-flow lookup fails', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: 'dm-flow',
      current_step_id: 's1',
      awaiting_input_type: 'button',
      context: {},
    } as any);
    dbState.flow = null;
    dbState.flowError = { message: 'connection refused' };

    const res = await POST(signed(JSON.stringify(message)));

    expect(res.status).toBe(200);
    const lookupLog = infoSpy.mock.calls
      .map(([, payload]) => String(payload))
      .find((payload) => payload.includes('"event":"active_flow_lookup"'));
    expect(lookupLog).toBeDefined();
    expect(lookupLog).toContain('"error":"connection refused"');
    infoSpy.mockRestore();
  });

  it('ignores active-flow webhook messages with no text or postback', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: 'dm-flow',
      current_step_id: 's1',
      awaiting_input_type: 'button',
      context: {},
    } as any);
    dbState.flow = {
      id: 'dm-flow',
      name: 'DM flow',
      language: 'en',
      steps: [{
        id: 's1',
        type: 'send_message',
        text: 'Want the free thing?',
        buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }],
      }],
    };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { sendButtons, sendText } = await import('@/lib/meta/client');
    expect(sendButtons).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(loadConversationState).not.toHaveBeenCalled();
  });

  it('logs non-sensitive shape details for ignored no-text webhook messages', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
          message: {
            mid: 'NO-TEXT-MID',
            reply_to: { story: { id: 'STORY-ID', url: 'https://example.com/story' } },
            attachments: [{ type: 'story_mention', payload: { url: 'https://example.com/asset' } }],
          },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const shapeLog = infoSpy.mock.calls
      .map(([, payload]) => String(payload))
      .find((payload) => payload.includes('"event":"message_ignored_non_actionable_shape"'));
    expect(shapeLog).toContain('"messageKeys":["attachments","mid","reply_to"]');
    expect(shapeLog).toContain('"attachmentTypes":["story_mention"]');
    expect(shapeLog).toContain('"replyToHasStory":true');
    expect(shapeLog).not.toContain('https://example.com');
    expect(loadConversationState).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it('continues processing remaining messages when one message in the batch fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(findDmFlow).mockResolvedValue({ id: 'dm-flow', language: 'en', steps: [{ id: 'dm1', type: 'send_message', text: 'Welcome' }] } as any);
    const { sendText } = await import('@/lib/meta/client');
    vi.mocked(sendText).mockRejectedValueOnce(new Error('Meta API down'));
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [
          { sender: { id: '8800000000000001' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000, message: { mid: 'MID-FAIL', text: 'hello' } },
          { sender: { id: '8800000000000002' }, recipient: { id: '17841400000000000' }, timestamp: 1748372161000, message: { mid: 'MID-OK', text: 'hello' } },
        ],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(sendText).toHaveBeenCalledTimes(2);
    const failureLog = errorSpy.mock.calls.map(([, payload]) => String(payload)).find((p) => p.includes('"event":"message_failed"'));
    expect(failureLog).toBeDefined();
    errorSpy.mockRestore();
  });

  it('continues processing remaining comments when one comment in the batch fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendPrivateReplyToComment } = await import('@/lib/meta/client');
    vi.mocked(sendPrivateReplyToComment).mockRejectedValueOnce(new Error('Meta API down'));
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        field: 'comments',
        value: [
          { id: '18000000000000011', from: { id: '8800000000000001', username: 'user_one' }, media: { id: '17900000000000000' }, text: 'first' },
          { id: '18000000000000012', from: { id: '8800000000000002', username: 'user_two' }, media: { id: '17900000000000000' }, text: 'second' },
        ],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(2);
    const failureLog = errorSpy.mock.calls.map(([, payload]) => String(payload)).find((p) => p.includes('"event":"comment_failed"'));
    expect(failureLog).toBeDefined();
    errorSpy.mockRestore();
  });

  it('skips a message another delivery already claimed, without sending anything', async () => {
    vi.mocked(claimInboundMessage).mockResolvedValue(false);
    vi.mocked(findDmFlow).mockResolvedValue({ id: 'dm-flow', language: 'en', steps: [{ id: 'dm1', type: 'send_message', text: 'Welcome' }] } as any);

    const res = await POST(signed(JSON.stringify(message)));

    expect(res.status).toBe(200);
    const { sendText, sendButtons } = await import('@/lib/meta/client');
    expect(sendText).not.toHaveBeenCalled();
    expect(sendButtons).not.toHaveBeenCalled();
    expect(saveConversationState).not.toHaveBeenCalled();
  });

  it('claims a comment before replying so story-comment redeliveries cannot re-run the flow', async () => {
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Story comment matched' }] } as any);

    const res = await POST(signed(JSON.stringify(storyComment)));

    expect(res.status).toBe(200);
    expect(claimInboundMessage).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'in',
      message_type: 'comment',
      meta_message_id: '18000000000000001',
    }));

    // Redelivery of the same comment: claim is refused, nothing is sent.
    vi.clearAllMocks();
    vi.mocked(findStoryReplyFlow).mockResolvedValue({ id: 'story-flow', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Story comment matched' }] } as any);
    vi.mocked(claimInboundMessage).mockResolvedValue(false);
    const redelivery = await POST(signed(JSON.stringify(storyComment)));
    expect(redelivery.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('logs the private reply under its own message id, not the comment id', async () => {
    const res = await POST(signed(JSON.stringify(comment)));

    expect(res.status).toBe(200);
    expect(logMessage).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'out',
      message_type: 'private_reply',
      meta_message_id: 'm',
    }));
  });

  it('executes erasure on the confirm postback and then sends the deletion confirmation', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: null,
      current_step_id: 'confirm',
      awaiting_input_type: 'button',
      context: { erasure: true },
    } as any);
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
          postback: { mid: 'MID-ERASE-YES', payload: 'execute', title: 'Yes, delete everything' },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { executeErasure } = await import('@/lib/flow-engine/erasure-execute');
    expect(executeErasure).toHaveBeenCalledWith({ contactId: 'c1', requestedVia: 'dm' });
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      igUserId: '8800000000000000',
      text: 'Your data has been deleted. ✅',
    }));
    // Confirmation must go out only after the erasure RPC has succeeded.
    expect(vi.mocked(executeErasure).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(sendText).mock.invocationCallOrder[0]);
    // The contact row is gone after erase_contact(); nothing must be logged against it.
    expect(logMessage).not.toHaveBeenCalled();
  });

  it('cancels erasure on the cancel postback: replies and disarms the erasure context', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1',
      current_flow_id: null,
      current_step_id: 'confirm',
      awaiting_input_type: 'button',
      context: { erasure: true },
    } as any);
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '8800000000000000' },
          recipient: { id: '17841400000000000' },
          timestamp: 1748372160000,
          postback: { mid: 'MID-ERASE-NO', payload: 'cancelled', title: 'Cancel' },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { executeErasure } = await import('@/lib/flow-engine/erasure-execute');
    expect(executeErasure).not.toHaveBeenCalled();
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      igUserId: '8800000000000000',
      text: 'Cancelled.',
    }));
    // Disarm: a later unrelated 'execute' postback must not be able to wipe the contact.
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      contact_id: 'c1',
      current_flow_id: null,
      current_step_id: null,
      awaiting_input_type: null,
      context: {},
    }));
  });

  it('sends the custom request message after the user agrees', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'button', context: {},
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email', request_message: 'Drop your best email below' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        postback: { mid: 'MID-AGREE-CUSTOM', payload: 'EMAIL_AGREE_email1', title: 'Accept' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: 'Drop your best email below' }));
  });

  it('ends the flow with the goodbye message when the user declines', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'button', context: {},
    } as any);
    // next_id is set so the OLD behavior would advance to s2; the new behavior must end instead.
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [
      { id: 'email1', type: 'collect_email', next_id: 's2' },
      { id: 's2', type: 'send_message', text: 'should not run' },
    ] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        postback: { mid: 'MID-DECLINE', payload: 'EMAIL_DECLINE_email1', title: 'Decline' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: 'No problem.' }));
    expect(sendText).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('should not run') }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null, current_step_id: null, awaiting_input_type: null,
    }));
  });

  it('lets a decline postback end the flow even while awaiting the email text', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'email', context: { email: { stepId: 'email1', retries: 0 } },
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        postback: { mid: 'MID-DECLINE-LATE', payload: 'EMAIL_DECLINE_email1', title: 'Decline' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(captureEmail).not.toHaveBeenCalled();
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: 'No problem.' }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null, current_step_id: null, awaiting_input_type: null,
    }));
  });

  it('forwards the configured Resend event to captureEmail', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'email', context: { email: { stepId: 'email1', retries: 0 } },
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email', resend_event: 'welcome' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        message: { mid: 'MID-EMAIL-WITH-EVENT', text: 'person@example.com' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(captureEmail).toHaveBeenCalledWith(expect.objectContaining({ resendEvent: 'welcome' }));
  });

  it('ignores echo webhook messages sent by the Instagram account', async () => {
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        messaging: [{
          sender: { id: '17841400000000000' },
          recipient: { id: '8800000000000000' },
          timestamp: 1748372160000,
          message: { mid: 'ECHO-MID' },
        }],
      }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(findIgAccountByBusinessId).not.toHaveBeenCalled();
  });
});
