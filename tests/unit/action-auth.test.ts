import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Wiring test: every admin server action must refuse unauthenticated callers
// before touching the database. Uses the real requireAdmin against a fake
// signed-out session, and records any service-role DB activity.
const state = vi.hoisted(() => ({
  user: null as null | { email?: string },
  mutations: [] as string[],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@/lib/db/encryption', () => ({
  encryptSecret: vi.fn().mockResolvedValue(new Uint8Array([1])),
  decryptSecret: vi.fn().mockResolvedValue('TOKEN'),
  encodeBytea: vi.fn(() => '\\x01'),
  decodeBytea: vi.fn(() => new Uint8Array([1])),
}));

vi.mock('@/lib/meta/client', () => ({
  getMe: vi.fn().mockResolvedValue({ id: 'x', user_id: 'x', username: 'x' }),
  subscribeToAppWebhooks: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/flow-engine/erasure-execute', () => ({
  executeErasure: vi.fn(async () => {
    state.mutations.push('erase_contact');
  }),
}));

vi.mock('@/lib/db/client', () => ({
  userClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
  }),
  serviceClient: () => ({
    from: (table: string) => {
      const builder: any = {
        insert: () => { state.mutations.push(`insert:${table}`); return builder; },
        update: () => { state.mutations.push(`update:${table}`); return builder; },
        upsert: () => { state.mutations.push(`upsert:${table}`); return builder; },
        delete: () => { state.mutations.push(`delete:${table}`); return builder; },
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: { id: 'row-1' }, error: null }),
        maybeSingle: async () => ({ data: { id: 'row-1' }, error: null }),
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
      };
      return builder;
    },
  }),
}));

import { addAccount, repairWebhookSubscription } from '@/app/admin/(gated)/accounts/actions';
import { eraseContact } from '@/app/admin/(gated)/contacts/actions';
import { createFlow, saveFlowBuilderSteps, saveFlowSettings, saveFlowSteps, setFlowArchived } from '@/app/admin/(gated)/flows/actions';
import { setPostFlows, syncPosts } from '@/app/admin/(gated)/posts/actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  state.user = null;
  state.mutations = [];
  vi.stubEnv('ADMIN_ALLOWLIST', 'admin@example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin server actions reject unauthenticated callers', () => {
  it('eraseContact throws and never erases', async () => {
    await expect(eraseContact('contact-1')).rejects.toThrow(/unauthorized/i);
    expect(state.mutations).toEqual([]);
  });

  it('addAccount returns an error and never inserts', async () => {
    const result = await addAccount(null, form({ name: 'a', page_access_token: 't', default_language: 'tr' }));
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/unauthorized/i) });
    expect(state.mutations).toEqual([]);
  });

  it('repairWebhookSubscription returns an error and never reads the token', async () => {
    const result = await repairWebhookSubscription(null, form({ account_id: 'account-1' }));
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/unauthorized/i) });
    expect(state.mutations).toEqual([]);
  });

  it('createFlow throws and never inserts', async () => {
    await expect(createFlow(form({ name: 'f', ig_account_id: 'a', language: 'tr', trigger_type: 'dm', trigger_keywords: 'hi' }))).rejects.toThrow(/unauthorized/i);
    expect(state.mutations).toEqual([]);
  });

  it('saveFlowSteps returns an error and never updates', async () => {
    const result = await saveFlowSteps('flow-1', '[]');
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/unauthorized/i) });
    expect(state.mutations).toEqual([]);
  });

  it('saveFlowBuilderSteps returns an error and never updates', async () => {
    const result = await saveFlowBuilderSteps('flow-1', []);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/unauthorized/i) });
    expect(state.mutations).toEqual([]);
  });

  it('saveFlowSettings throws and never updates', async () => {
    await expect(saveFlowSettings('flow-1', form({ name: 'f', language: 'tr', trigger_type: 'dm', trigger_keywords: 'hi' }))).rejects.toThrow(/unauthorized/i);
    expect(state.mutations).toEqual([]);
  });

  it('setFlowArchived throws and never updates', async () => {
    await expect(setFlowArchived('flow-1', true)).rejects.toThrow(/unauthorized/i);
    expect(state.mutations).toEqual([]);
  });

  it('setPostFlows throws and never writes', async () => {
    await expect(setPostFlows('post-1', ['flow-1'])).rejects.toThrow(/unauthorized/i);
    expect(state.mutations).toEqual([]);
  });

  it('syncPosts returns an error and never calls Instagram', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await syncPosts('account-1');
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/unauthorized/i) });
    expect(state.mutations).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('admin server actions allow allowlisted admins', () => {
  it('eraseContact runs for an allowlisted admin', async () => {
    state.user = { email: 'admin@example.com' };
    await eraseContact('contact-1');
    expect(state.mutations).toEqual(['erase_contact']);
  });

  it('setFlowArchived runs for an allowlisted admin', async () => {
    state.user = { email: 'admin@example.com' };
    await setFlowArchived('flow-1', true);
    expect(state.mutations).toEqual(['update:flows']);
  });
});
