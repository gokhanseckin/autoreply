import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendText, sendButtons } from '@/lib/meta/client';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ message_id: 'm_001', recipient_id: 'u_001' }),
    text: async () => '{"message_id":"m_001","recipient_id":"u_001"}',
  });
});
afterEach(() => vi.restoreAllMocks());

describe('sendText', () => {
  it('POSTs the correct shape', async () => {
    const res = await sendText({
      pageAccessToken: 'TOKEN',
      igUserId: 'u_001',
      text: 'hello',
    });
    expect(res.message_id).toBe('m_001');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: 'u_001' },
      message: { text: 'hello' },
      messaging_type: 'RESPONSE',
    });
  });
});

describe('sendButtons', () => {
  it('POSTs button_template with up to 3 buttons', async () => {
    await sendButtons({
      pageAccessToken: 'TOKEN',
      igUserId: 'u_001',
      text: 'choose',
      buttons: [
        { type: 'postback', title: 'Yes', payload: 'YES' },
        { type: 'web_url', title: 'Go', url: 'https://x' },
      ],
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.message.attachment.payload.template_type).toBe('button');
    expect(body.message.attachment.payload.buttons).toHaveLength(2);
  });
});
