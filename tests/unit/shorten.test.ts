import { describe, it, expect } from 'vitest';
import { generateLinkCode } from '@/lib/links/shorten';

describe('generateLinkCode', () => {
  it('is 10 alphanumeric chars', () => {
    const code = generateLinkCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{10}$/);
  });

  it('produces unique values', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateLinkCode()));
    expect(codes.size).toBe(1000);
  });
});
