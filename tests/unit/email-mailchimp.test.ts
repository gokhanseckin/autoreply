import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailchimpAdapter } from '@/lib/email-providers/mailchimp';

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockClear();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'mc-1' }) });
});

describe('MailchimpAdapter', () => {
  it('POSTs to lists/{id}/members with subscribed status', async () => {
    const r = await new MailchimpAdapter({ apiKey: 'us1-KEY' }).subscribe({ email: 'a@b.com', igUsername: 'u', flowName: 'f', language: 'en', audienceId: 'list-1' });
    expect(r.id).toBe('mc-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/us1\.api\.mailchimp\.com\/3\.0\/lists\/list-1\/members/);
    expect(JSON.parse(init.body)).toMatchObject({ email_address: 'a@b.com', status: 'subscribed' });
  });
});
