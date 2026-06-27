import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  signOutCalls: 0,
}));

const redirect = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect }));

vi.mock('@/lib/db/client', () => ({
  userClient: async () => ({
    auth: {
      signOut: async () => {
        state.signOutCalls += 1;
        return { error: null };
      },
    },
  }),
}));

import { signOutAdmin } from '@/app/admin/(gated)/auth-actions';

beforeEach(() => {
  state.signOutCalls = 0;
  redirect.mockReset();
});

describe('signOutAdmin', () => {
  it('signs out and sends the user back to sign-in', async () => {
    await signOutAdmin();

    expect(state.signOutCalls).toBe(1);
    expect(redirect).toHaveBeenCalledWith('/admin/sign-in');
  });
});
