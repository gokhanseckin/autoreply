import type { EmailProviderAdapter } from './adapter';

export class MailchimpAdapter implements EmailProviderAdapter {
  readonly kind = 'mailchimp' as const;
  constructor(private opts: { apiKey: string }) {}
  async subscribe(input: { email: string; igUsername: string; flowName: string; language: 'tr' | 'en'; audienceId?: string }): Promise<{ id: string }> {
    if (!input.audienceId) throw new Error('Mailchimp requires audienceId (list_id)');
    const parts = this.opts.apiKey.split('-');
    const dc = parts[parts.length - 1] ?? 'us1';
    const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${input.audienceId}/members`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${this.opts.apiKey}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email_address: input.email,
        status: 'subscribed',
        language: input.language,
        merge_fields: { IGUSER: input.igUsername },
        tags: [input.flowName],
      }),
    });
    if (!res.ok) throw new Error(`Mailchimp ${res.status}`);
    const json = await res.json();
    return { id: json.id ?? 'unknown' };
  }
}
