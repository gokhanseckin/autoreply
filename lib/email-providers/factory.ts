import { NoneAdapter } from './none';
import { ResendAdapter } from './resend';
import { MailchimpAdapter } from './mailchimp';
import type { EmailProviderAdapter } from './adapter';
import { decryptSecret } from '@/lib/db/encryption';

export type ProviderConfig =
  | { kind: 'none' }
  | { kind: 'resend'; api_key_enc: string; audience_id: string }
  | { kind: 'mailchimp'; api_key_enc: string; audience_id: string };

export async function makeProvider(cfg: ProviderConfig): Promise<EmailProviderAdapter> {
  if (cfg.kind === 'none') return new NoneAdapter();
  const apiKey = await decryptSecret(new Uint8Array(Buffer.from(cfg.api_key_enc, 'base64')));
  if (cfg.kind === 'resend') return new ResendAdapter({ apiKey });
  if (cfg.kind === 'mailchimp') return new MailchimpAdapter({ apiKey });
  throw new Error('unknown provider');
}
