import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: null as null | { email?: string },
}));

vi.mock('@/lib/db/client', () => ({
  userClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
  }),
}));

import { isAdminRequest, requireAdmin, UnauthorizedError } from '@/lib/auth/require-admin';

beforeEach(() => {
  state.user = null;
  vi.stubEnv('ADMIN_ALLOWLIST', 'admin@example.com, second@example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAdminRequest', () => {
  it('is false when no user is signed in', async () => {
    expect(await isAdminRequest()).toBe(false);
  });

  it('is false when the signed-in email is not on the allowlist', async () => {
    state.user = { email: 'intruder@example.com' };
    expect(await isAdminRequest()).toBe(false);
  });

  it('is true for an allowlisted email, tolerating whitespace in the env list', async () => {
    state.user = { email: 'second@example.com' };
    expect(await isAdminRequest()).toBe(true);
  });

  it('is false when the allowlist is empty', async () => {
    vi.stubEnv('ADMIN_ALLOWLIST', '');
    state.user = { email: 'admin@example.com' };
    expect(await isAdminRequest()).toBe(false);
  });

  it('is false for a user without an email', async () => {
    state.user = {};
    expect(await isAdminRequest()).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('throws UnauthorizedError for unauthenticated requests', async () => {
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('resolves for an allowlisted admin', async () => {
    state.user = { email: 'admin@example.com' };
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
