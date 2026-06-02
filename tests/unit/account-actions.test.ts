import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  selects: [] as { table: string; columns: string; eq: [string, unknown][] }[],
  revalidated: [] as string[],
  nextInsertError: null as null | { message: string },
  accountLookup: {
    id: 'account-1',
    name: 'mila.seckin',
    page_access_token_enc: '\\x454e43525950544544',
  } as null | { id: string; name: string; page_access_token_enc: string },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => state.revalidated.push(path),
}));

vi.mock('@/lib/meta/client', () => ({
  getMe: vi.fn().mockResolvedValue({
    id: 'ig-app-id',
    user_id: '17841400000000000',
    username: 'mila.seckin',
  }),
  subscribeToAppWebhooks: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/db/encryption', () => ({
  encryptSecret: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  decryptSecret: vi.fn().mockResolvedValue('TOKEN'),
  encodeBytea: vi.fn(() => '\\x010203'),
  decodeBytea: vi.fn(() => new Uint8Array([4, 5, 6])),
}));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => {
      const eq: [string, unknown][] = [];
      const builder: any = {
        insert: (row: Record<string, unknown>) => {
          state.inserts.push({ table, row });
          return builder;
        },
        select: (columns: string) => {
          state.selects.push({ table, columns, eq });
          return builder;
        },
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: state.accountLookup, error: null }),
        then: (resolve: (value: { error: null | { message: string } }) => void) => {
          resolve({ error: state.nextInsertError });
        },
      };
      return builder;
    },
  }),
}));

import { addAccount, repairWebhookSubscription } from '@/app/admin/(gated)/accounts/actions';
import { getMe, subscribeToAppWebhooks } from '@/lib/meta/client';
import { decryptSecret } from '@/lib/db/encryption';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.inserts = [];
  state.selects = [];
  state.revalidated = [];
  state.nextInsertError = null;
  state.accountLookup = {
    id: 'account-1',
    name: 'mila.seckin',
    page_access_token_enc: '\\x454e43525950544544',
  };
});

describe('account admin actions', () => {
  it('subscribes a newly added Instagram account to comment and message webhooks before saving it', async () => {
    const result = await addAccount(null, form({
      name: 'mila.seckin',
      page_access_token: 'TOKEN',
      default_language: 'tr',
    }));

    expect(result).toEqual({
      ok: true,
      igBusinessAccountId: '17841400000000000',
      username: 'mila.seckin',
    });
    expect(getMe).toHaveBeenCalledWith('TOKEN');
    expect(subscribeToAppWebhooks).toHaveBeenCalledWith('TOKEN');
    expect(state.inserts[0]).toEqual(expect.objectContaining({
      table: 'ig_accounts',
      row: expect.objectContaining({
        name: 'mila.seckin',
        ig_business_account_id: '17841400000000000',
        page_access_token_enc: '\\x010203',
      }),
    }));
    expect(state.revalidated).toContain('/admin/accounts');
  });

  it('repairs webhook subscription for an existing account token', async () => {
    const result = await repairWebhookSubscription(null, form({ account_id: 'account-1' }));

    expect(result).toEqual({ ok: true, message: 'Webhook subscription refreshed for mila.seckin.' });
    expect(state.selects[0]).toEqual(expect.objectContaining({
      table: 'ig_accounts',
      columns: 'id,name,page_access_token_enc',
      eq: [['id', 'account-1']],
    }));
    expect(decryptSecret).toHaveBeenCalled();
    expect(subscribeToAppWebhooks).toHaveBeenCalledWith('TOKEN');
    expect(state.revalidated).toContain('/admin/accounts');
  });
});
