import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { POST } from '@/app/api/webhooks/meta/route';
import comment from '../fixtures/meta/comment.json';

vi.mock('@/lib/db/queries', () => ({
  findIgAccountByBusinessId: vi.fn().mockResolvedValue({ id: 'a1', default_language: 'en', page_access_token_enc: Buffer.alloc(48).toString('base64') }),
  upsertContact: vi.fn().mockResolvedValue({ id: 'c1' }),
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
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'L1' } }) }) }),
    }),
  }),
}));
vi.mock('@/lib/flow-engine/erasure-execute', () => ({ executeErasure: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/flow-engine/machine', () => ({
  advance: vi.fn().mockResolvedValue({ nextStepId: null, awaitingInputType: null, expiresAt: null }),
}));

beforeEach(() => { vi.clearAllMocks(); });

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
    const res = await POST(new Request('http://localhost/api/webhooks/meta', { method: 'POST', body: '{}', headers: { 'x-hub-signature-256': 'sha256=00' } }));
    expect(res.status).toBe(401);
  });

  it('processes a comment event end-to-end with valid signature', async () => {
    const body = JSON.stringify(comment);
    const res = await POST(signed(body));
    expect(res.status).toBe(200);
    const { sendPrivateReplyToComment } = await import('@/lib/meta/client');
    expect(sendPrivateReplyToComment).toHaveBeenCalled();
  });
});
