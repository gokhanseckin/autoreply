import type { EmailProviderAdapter } from './adapter';

export class ResendAdapter implements EmailProviderAdapter {
  readonly kind = 'resend' as const;
  constructor(private opts: { apiKey: string }) {}
  async subscribe(input: { email: string; igUsername: string; flowName: string; language: 'tr' | 'en'; audienceId?: string }): Promise<{ id: string }> {
    if (!input.audienceId) throw new Error('Resend requires audienceId');
    const res = await fetch(`https://api.resend.com/audiences/${input.audienceId}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        first_name: input.igUsername,
        unsubscribed: false,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    const json = await res.json();
    return { id: json.data?.id ?? 'unknown' };
  }
  async triggerEvent(input: { email: string; event: string; payload?: Record<string, unknown> }): Promise<void> {
    const res = await fetch('https://api.resend.com/events/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ event: input.event, email: input.email, payload: input.payload ?? {} }),
    });
    if (!res.ok) throw new Error(`Resend events/send ${res.status}`);
  }
}
