import { describe, it, expect } from 'vitest';
import { NoneAdapter } from '@/lib/email-providers/none';

describe('NoneAdapter', () => {
  it('returns id "none"', async () => {
    const r = await new NoneAdapter().subscribe({ email: 'a@b', igUsername: 'u', flowName: 'f', language: 'en' });
    expect(r.id).toBe('none');
  });
});
