import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/links/ip-hash';

describe('hashIp', () => {
  it('is deterministic for the same IP with the same salt', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
  });

  it('differs across IPs', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'));
  });

  it('works with an arbitrary (non-bcrypt) salt string', () => {
    expect(hashIp('1.2.3.4')).toMatch(/^[0-9a-f]{64}$/);
  });
});
