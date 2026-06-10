import { EMAIL_CONSENT_TR } from './email-consent-text.tr';
import { EMAIL_CONSENT_EN } from './email-consent-text.en';
import type { FlowStep } from '@/lib/flow-engine/schema';

type Lang = 'tr' | 'en';
type CollectEmailStep = Extract<FlowStep, { type: 'collect_email' }>;

export type CollectEmailText = {
  disclaimer: string;
  accept: string;
  decline: string;
  request: string;
  declineGoodbye: string;
};

export function collectEmailDefaults(lang: Lang): CollectEmailText {
  const consent = lang === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN;
  return {
    disclaimer: consent.body,
    accept: lang === 'tr' ? 'Kabul Et' : 'Accept',
    decline: lang === 'tr' ? 'Reddet' : 'Decline',
    request: lang === 'tr' ? 'Lütfen email adresinizi girin' : 'Please enter your email',
    declineGoodbye: lang === 'tr' ? 'Tamam, sorun değil.' : 'No problem.',
  };
}

// A blank/whitespace field counts as "unset" and falls back to the default,
// so an admin clearing a box never sends an empty message to a user.
function pick(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function resolveCollectEmailText(step: CollectEmailStep, lang: Lang): CollectEmailText {
  const d = collectEmailDefaults(lang);
  return {
    disclaimer: pick(step.disclaimer_message, d.disclaimer),
    accept: pick(step.accept_label, d.accept),
    decline: pick(step.decline_label, d.decline),
    request: pick(step.request_message, d.request),
    declineGoodbye: pick(step.decline_message, d.declineGoodbye),
  };
}
