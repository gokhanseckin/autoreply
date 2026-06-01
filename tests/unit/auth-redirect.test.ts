import { describe, expect, it } from 'vitest';
import { getAuthRedirectUrl } from '@/lib/auth/redirect';

const canonical = 'https://autoreply-three.vercel.app';
const teamAlias = 'https://autoreply-gokhan-seckins-projects.vercel.app';

describe('getAuthRedirectUrl', () => {
  it('moves root magic-link codes to the canonical auth callback', () => {
    expect(getAuthRedirectUrl(`${teamAlias}/?code=abc123&next=%2Fadmin`, canonical)).toBe(
      `${canonical}/auth/callback?code=abc123&next=%2Fadmin`,
    );
  });

  it('moves callback requests from a Vercel team alias to the canonical domain before exchanging the code', () => {
    expect(getAuthRedirectUrl(`${teamAlias}/auth/callback?code=abc123`, canonical)).toBe(
      `${canonical}/auth/callback?code=abc123`,
    );
  });

  it('preserves admin paths when moving from the team alias to the canonical domain', () => {
    expect(getAuthRedirectUrl(`${teamAlias}/admin/flows?tab=archived`, canonical)).toBe(
      `${canonical}/admin/flows?tab=archived`,
    );
  });

  it('does not redirect canonical callback requests', () => {
    expect(getAuthRedirectUrl(`${canonical}/auth/callback?code=abc123`, canonical)).toBeNull();
  });

  it('keeps localhost on localhost while still repairing root magic-link codes', () => {
    expect(getAuthRedirectUrl('http://localhost:3000/?code=abc123', canonical)).toBe(
      'http://localhost:3000/auth/callback?code=abc123',
    );
  });
});
