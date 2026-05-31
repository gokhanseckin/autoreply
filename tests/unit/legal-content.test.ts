import { describe, it, expect } from 'vitest';
import { POLICY_EN } from '@/lib/consent/policy-content.en';
import { POLICY_TR } from '@/lib/consent/policy-content.tr';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';

const VERSION = '2026-05-31.v1';

describe('privacy policy content', () => {
  it('names the real operator and contact, no placeholders', () => {
    for (const doc of [POLICY_EN, POLICY_TR]) {
      expect(doc).toContain('Gokhan Seckin');
      expect(doc).toContain('iyibey@gmail.com');
      expect(doc).not.toContain('[Operator');
      expect(doc).not.toContain('[Operatör');
      expect(doc).not.toContain('example.com');
    }
  });

  it('carries the bumped policy version everywhere', () => {
    expect(CURRENT_POLICY_VERSION).toBe(VERSION);
    expect(POLICY_EN).toContain(VERSION);
    expect(POLICY_TR).toContain(VERSION);
  });
});
