import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { POST } from '@/app/api/webhooks/meta/route';
import comment from '../fixtures/meta/comment.json';
import message from '../fixtures/meta/message.json';
import storyReply from '../fixtures/meta/story_reply.json';
import { findCommentFlow, findDmFlow, findStoryReplyFlow } from '@/lib/flow-engine/routing';
import { findIgAccountByBusinessId, loadConversationState, saveConversationState } from '@/lib/db/queries';
import { captureEmail } from '@/lib/flow-engine/email-step';

const dbState = vi.hoisted(() => ({
  flow: null as any,
  inserts: [] as { table: string; row: unknown }[],
}));

vi.mock('@/lib/db/queries', () => ({
  findIgAccountByBusinessId: vi.fn().mockResolvedValue({ id: 'a1', name: 'Main', default_language: 'en', page_access_token_enc: Buffer.alloc(48).toString('base64'), email_provider_config: { kind: 'none' } }),
  upsertContact: vi.fn().mockResolvedValue({ id: 'c1', ig_username: 'test_user' }),
  loadConversationState: vi.fn().mockResolvedValue(null),
  saveConversationState: vi.fn().mockResolvedValue(undefined),
  alreadyProcessed: vi.fn().mockResolvedValue(false),
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
        maybeSingle: async () => ({ data: table === 'flows' ? dbState.flow : null, error: null }),
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
  dbState.inserts = [];
  vi.mocked(findCommentFlow).mockResolvedValue({ id: 'f1', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Hi' }] } as any);
  vi.mocked(findDmFlow).mockResolvedValue(null);
  vi.mocked(findStoryReplyFlow).mockResolvedValue(null);
  vi.mocked(loadConversationState).mockResolvedValue(null);
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
