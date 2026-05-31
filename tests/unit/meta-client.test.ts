import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendText, sendButtons, getMe } from '@/lib/meta/client';

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

describe('getMe', () => {
  it('GETs /me with a Bearer header and returns the profile', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"id":"app123","user_id":"17841400000000000","username":"kenjutsudojo"}',
    });
    const me = await getMe('TOKEN');
    expect(me.user_id).toBe('17841400000000000');
    expect(me.username).toBe('kenjutsudojo');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/me?fields=id,user_id,username');
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
  });

  it('throws MetaAPIError on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":{"code":190,"type":"OAuthException","message":"bad token"}}',
    });
    await expect(getMe('BAD')).rejects.toThrow(/bad token/);
  });
});
