import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  account: null as null | { email_provider_config: unknown },
  dbError: null as null | { message: string },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@/lib/auth/require-admin', () => ({
  isAdminRequest: vi.fn().mockResolvedValue(true),
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  UNAUTHORIZED_MESSAGE: 'Unauthorized',
}));

vi.mock('@/lib/db/encryption', () => ({
  decryptSecret: vi.fn().mockResolvedValue('RESEND_KEY'),
}));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            state.dbError
              ? { data: null, error: state.dbError }
              : { data: state.account, error: null },
        }),
      }),
    }),
  }),
}));

import { listResendEvents } from '@/app/admin/(gated)/flows/actions';

beforeEach(() => {
  vi.clearAllMocks();
  state.account = { email_provider_config: { kind: 'resend', api_key_enc: Buffer.from('enc').toString('base64'), audience_id: 'aud-1' } };
  state.dbError = null;
});

describe('listResendEvents', () => {
  it('returns event names from the Resend List Events API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ object: 'list', data: [
        { id: 'evt-1', name: 'welcome' },
        { id: 'evt-2', name: 'user.upgraded' },
      ] }),
    });
    global.fetch = fetchMock as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: true, events: [
      { id: 'evt-1', name: 'welcome' },
      { id: 'evt-2', name: 'user.upgraded' },
    ] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/events');
    expect(init.headers.Authorization).toBe('Bearer RESEND_KEY');
  });

  it('returns an empty list when the account is not on Resend', async () => {
    state.account = { email_provider_config: { kind: 'none' } };
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: true, events: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the Resend status as an error on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: false, error: 'Resend 401' });
  });

  it('returns an error without leaking the key when fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed')) as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: false, error: 'fetch failed' });
    expect(JSON.stringify(result)).not.toContain('RESEND_KEY');
  });

  it('returns an empty list when the account does not exist', async () => {
    state.account = null;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: true, events: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a DB error when the account lookup fails', async () => {
    state.dbError = { message: 'boom' };
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: false, error: 'DB error: boom' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
