import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  exchangeError: null as null | Error,
  verifyError: null as null | Error,
  exchangeCodes: [] as string[],
  verifyArgs: [] as unknown[],
}));

vi.mock('@/lib/db/client', () => ({
  userClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        state.exchangeCodes.push(code);
        return { error: state.exchangeError };
      },
      verifyOtp: async (args: unknown) => {
        state.verifyArgs.push(args);
        return { error: state.verifyError };
      },
    },
  }),
}));

import { GET } from '@/app/auth/callback/route';

beforeEach(() => {
  state.exchangeError = null;
  state.verifyError = null;
  state.exchangeCodes = [];
  state.verifyArgs = [];
});

describe('auth callback route', () => {
  it('exchanges PKCE auth codes and redirects to the admin app', async () => {
    const res = await GET(new Request('https://example.com/auth/callback?code=abc123'));

    expect(state.exchangeCodes).toEqual(['abc123']);
    expect(res.headers.get('location')).toBe('https://example.com/admin/accounts');
  });

  it('verifies token-hash email links without requiring a PKCE verifier cookie', async () => {
    const res = await GET(new Request('https://example.com/auth/callback?token_hash=hash123&type=email'));

    expect(state.verifyArgs).toEqual([{ token_hash: 'hash123', type: 'email' }]);
    expect(res.headers.get('location')).toBe('https://example.com/admin/accounts');
  });

  it('does not redirect successful token-hash links back into the callback route', async () => {
    const res = await GET(new Request('https://example.com/auth/callback?token_hash=hash123&type=email&next=%2Fauth%2Fcallback'));

    expect(res.headers.get('location')).toBe('https://example.com/admin/accounts');
  });

  it('returns failed PKCE exchanges to sign-in instead of bouncing through a protected page', async () => {
    state.exchangeError = new Error('PKCE code verifier not found in storage');

    const res = await GET(new Request('https://example.com/auth/callback?code=abc123'));

    expect(res.headers.get('location')).toBe('https://example.com/admin/sign-in?error=auth-callback');
  });
});
