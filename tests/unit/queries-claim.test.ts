import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  insertError: null as null | { code?: string; message: string },
  inserts: [] as { table: string; row: unknown }[],
}));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      insert: async (row: unknown) => {
        state.inserts.push({ table, row });
        return { error: state.insertError };
      },
    }),
  }),
}));

import { claimInboundMessage } from '@/lib/db/queries';

const row = {
  ig_account_id: 'a1',
  contact_id: 'c1',
  direction: 'in',
  message_type: 'text',
  payload: {},
  meta_message_id: 'MID-1',
};

beforeEach(() => {
  state.insertError = null;
  state.inserts = [];
});

describe('claimInboundMessage', () => {
  it('claims an unseen message by inserting its log row', async () => {
    await expect(claimInboundMessage(row as never)).resolves.toBe(true);
    expect(state.inserts).toEqual([{ table: 'messages_log', row }]);
  });

  it('reports a duplicate when the unique constraint rejects the insert', async () => {
    state.insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    await expect(claimInboundMessage(row as never)).resolves.toBe(false);
  });

  it('rethrows non-duplicate insert errors', async () => {
    state.insertError = { code: '57014', message: 'canceling statement due to timeout' };
    await expect(claimInboundMessage(row as never)).rejects.toMatchObject({ code: '57014' });
  });
});
