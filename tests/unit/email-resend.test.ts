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

describe('ResendAdapter.triggerEvent', () => {
  it('POSTs to the Resend events/send endpoint with event + email + payload', async () => {
    await new ResendAdapter({ apiKey: 'KEY' }).triggerEvent({ email: 'a@b.com', event: 'welcome', payload: { plan: 'pro' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/events/send');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer KEY');
    expect(JSON.parse(init.body)).toEqual({ event: 'welcome', email: 'a@b.com', payload: { plan: 'pro' } });
  });

  it('omits the payload key when no payload is given', async () => {
    await new ResendAdapter({ apiKey: 'KEY' }).triggerEvent({ email: 'a@b.com', event: 'welcome' });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ event: 'welcome', email: 'a@b.com' });
  });

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });
    await expect(
      new ResendAdapter({ apiKey: 'KEY' }).triggerEvent({ email: 'a@b.com', event: 'welcome' }),
    ).rejects.toThrow(/422/);
  });
});
