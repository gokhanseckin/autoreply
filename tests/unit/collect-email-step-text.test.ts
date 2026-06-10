import { describe, it, expect } from 'vitest';
import { collectEmailDefaults, resolveCollectEmailText } from '@/lib/consent/collect-email-step-text';

describe('collectEmailDefaults', () => {
  it('returns Turkish defaults', () => {
    const d = collectEmailDefaults('tr');
    expect(d.accept).toBe('Kabul Et');
    expect(d.decline).toBe('Reddet');
    expect(d.request).toBe('Lütfen email adresinizi girin');
    expect(d.declineGoodbye).toBe('Tamam, sorun değil.');
    expect(d.disclaimer.length).toBeGreaterThan(0);
  });

  it('returns English defaults', () => {
    const d = collectEmailDefaults('en');
    expect(d.accept).toBe('Accept');
    expect(d.decline).toBe('Decline');
    expect(d.request).toBe('Please enter your email');
    expect(d.declineGoodbye).toBe('No problem.');
    expect(d.disclaimer.length).toBeGreaterThan(0);
  });
});

describe('resolveCollectEmailText', () => {
  it('prefers step values over defaults', () => {
    const r = resolveCollectEmailText(
      { id: 'e1', type: 'collect_email', accept_label: 'Evet', request_message: 'Mailini yaz' },
      'tr',
    );
    expect(r.accept).toBe('Evet');
    expect(r.request).toBe('Mailini yaz');
    expect(r.decline).toBe('Reddet'); // unset field falls back to the default
  });

  it('ignores blank/whitespace step values', () => {
    const r = resolveCollectEmailText({ id: 'e1', type: 'collect_email', accept_label: '   ' }, 'en');
    expect(r.accept).toBe('Accept');
  });

  it('uses all five step values when fully populated', () => {
    const r = resolveCollectEmailText(
      {
        id: 'e1', type: 'collect_email',
        disclaimer_message: 'D', accept_label: 'A', decline_label: 'X',
        request_message: 'R', decline_message: 'G',
      },
      'en',
    );
    expect(r).toEqual({ disclaimer: 'D', accept: 'A', decline: 'X', request: 'R', declineGoodbye: 'G' });
  });
});
