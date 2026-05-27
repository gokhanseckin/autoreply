import { describe, it, expect } from 'vitest';
import { appendPrivacyFooter } from '@/lib/consent/footer';

describe('appendPrivacyFooter', () => {
  it('appends Turkish footer', () => {
    const out = appendPrivacyFooter('Merhaba', 'tr');
    expect(out).toBe('Merhaba\n\n—\nGizlilik: http://localhost:3000/p/tr');
  });

  it('appends English footer', () => {
    const out = appendPrivacyFooter('Hello', 'en');
    expect(out.endsWith('Privacy: http://localhost:3000/p/en')).toBe(true);
  });

  it('truncates body if combined > 1000 chars', () => {
    const body = 'x'.repeat(1100);
    const out = appendPrivacyFooter(body, 'en');
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(out.endsWith('Privacy: http://localhost:3000/p/en')).toBe(true);
  });
});
