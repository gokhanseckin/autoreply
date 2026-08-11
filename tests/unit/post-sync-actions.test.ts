import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/require-admin', () => ({
  isAdminRequest: vi.fn().mockResolvedValue(true),
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  UNAUTHORIZED_MESSAGE: 'Unauthorized',
}));
vi.mock('@/lib/db/encryption', () => ({
  decryptSecret: vi.fn().mockResolvedValue('EXPIRED_TOKEN'),
  decodeBytea: vi.fn(() => new Uint8Array([1])),
}));
vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: () => {
      // Supabase's fluent mock intentionally exposes a dynamic test-only builder.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({
          data: { id: 'account-1', page_access_token_enc: '\\x01' },
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

import { syncPosts } from '@/app/admin/(gated)/posts/actions';

describe('post sync errors', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('turns Meta OAuth code 190 into an actionable reconnect result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: {
        message: 'Error validating access token: Session has expired.',
        type: 'OAuthException',
        code: 190,
      },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));

    await expect(syncPosts('account-1')).resolves.toEqual({
      ok: false,
      error: 'The Instagram access token is invalid or expired.',
      reconnect: true,
    });
  });
});
