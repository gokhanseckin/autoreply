import { serviceClient } from '@/lib/db/client';
import { makeProvider, type ProviderConfig } from '@/lib/email-providers/factory';
import { EMAIL_CONSENT_EN } from '@/lib/consent/email-consent-text.en';
import { EMAIL_CONSENT_TR } from '@/lib/consent/email-consent-text.tr';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function captureEmail(args: {
  igAccountId: string;
  contactId: string;
  igUsername: string | null;
  flowId: string;
  flowName: string;
  language: 'tr' | 'en';
  emailText: string;
  providerConfig: ProviderConfig;
}): Promise<{ ok: boolean; status: 'pending' | 'confirmed' | 'failed'; message: string }> {
  const t = args.language === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN;
  if (!EMAIL_RE.test(args.emailText.trim())) return { ok: false, status: 'pending', message: t.invalidEmail };

  const db = serviceClient();
  const { data: sub } = await db.from('email_subscribers').insert({
    ig_account_id: args.igAccountId,
    contact_id: args.contactId,
    email: args.emailText.trim(),
    consent_at: new Date().toISOString(),
    consent_text_version: CURRENT_POLICY_VERSION,
    source_flow_id: args.flowId,
    status: 'pending',
  }).select().single();

  try {
    const adapter = await makeProvider(args.providerConfig);
    const ext = await adapter.subscribe({
      email: args.emailText.trim(),
      igUsername: args.igUsername ?? '',
      flowName: args.flowName,
      language: args.language,
      audienceId: args.providerConfig.kind === 'none' ? undefined : args.providerConfig.audience_id,
    });
    if (sub) {
      await db.from('email_subscribers').update({ status: 'confirmed', provider_id: ext.id }).eq('id', sub.id);
    }
    return { ok: true, status: 'confirmed', message: t.confirmation };
  } catch (err) {
    console.error('[email-step]', JSON.stringify({
      event: 'provider_subscribe_failed',
      provider: args.providerConfig.kind,
      subscriberId: sub?.id ?? null,
      error: err instanceof Error ? err.message : String(err),
    }));
    if (sub) {
      const { error } = await db.from('email_subscribers').update({ status: 'failed' }).eq('id', sub.id);
      if (error) console.error('[email-step]', JSON.stringify({ event: 'mark_failed_failed', subscriberId: sub.id, error: error.message }));
    }
    // 'failed' (vs invalid-email 'pending') tells the caller this is a
    // provider outage, not user error — keep the friendly message, don't re-prompt.
    return { ok: false, status: 'failed', message: t.fallback };
  }
}
