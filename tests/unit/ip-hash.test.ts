import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/links/ip-hash';

describe('hashIp', () => {
  it('is deterministic for the same IP with the same salt', async () => {
    const a = await hashIp('1.2.3.4');
    const b = await hashIp('1.2.3.4');
    expect(a).toBe(b);
  });

  it('differs across IPs', async () => {
    expect(await hashIp('1.2.3.4')).not.toBe(await hashIp('5.6.7.8'));
  });
});
