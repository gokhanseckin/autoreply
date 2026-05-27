import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendAdapter } from '@/lib/email-providers/resend';

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockClear();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'res-1' } }) });
});

describe('ResendAdapter', () => {
  it('POSTs to Resend Audiences contacts endpoint', async () => {
    const r = await new ResendAdapter({ apiKey: 'KEY' }).subscribe({ email: 'a@b.com', igUsername: 'u', flowName: 'f', language: 'en', audienceId: 'aud-1' });
    expect(r.id).toBe('res-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/audiences\/aud-1\/contacts/);
    expect(init.headers.Authorization).toBe('Bearer KEY');
    expect(JSON.parse(init.body)).toMatchObject({ email: 'a@b.com' });
  });
});
