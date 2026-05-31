import { describe, it, expect } from 'vitest';
import { POLICY_EN } from '@/lib/consent/policy-content.en';
import { POLICY_TR } from '@/lib/consent/policy-content.tr';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';
import { TERMS_EN } from '@/lib/consent/terms-content.en';
import { TERMS_TR } from '@/lib/consent/terms-content.tr';
import { DATA_DELETION_EN } from '@/lib/consent/data-deletion-content.en';
import { DATA_DELETION_TR } from '@/lib/consent/data-deletion-content.tr';

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

describe('terms of service content', () => {
  it('declares operator, no-affiliation, and contact (EN)', () => {
    expect(TERMS_EN).toContain('Gokhan Seckin');
    expect(TERMS_EN).toContain('not');
    expect(TERMS_EN.toLowerCase()).toContain('affiliated');
    expect(TERMS_EN).toContain('iyibey@gmail.com');
  });

  it('declares operator, no-affiliation, and contact (TR)', () => {
    expect(TERMS_TR).toContain('Gokhan Seckin');
    expect(TERMS_TR).toContain('ilişkili değildir');
    expect(TERMS_TR).toContain('iyibey@gmail.com');
  });
});

describe('data deletion content', () => {
  it('explains the DELETE keyword and contact (EN)', () => {
    expect(DATA_DELETION_EN).toContain('DELETE');
    expect(DATA_DELETION_EN).toContain('iyibey@gmail.com');
  });

  it('explains the SİL keyword and contact (TR)', () => {
    expect(DATA_DELETION_TR).toContain('SİL');
    expect(DATA_DELETION_TR).toContain('iyibey@gmail.com');
  });
});
