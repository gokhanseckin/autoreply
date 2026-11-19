import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  updates: [] as { table: string; payload: Record<string, unknown>; eq: [string, unknown][] }[],
  deletes: [] as { table: string; eq: [string, unknown][] }[],
  revalidated: [] as string[],
  nextError: null as null | { message: string },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => state.revalidated.push(path),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Auth wiring is covered by action-auth.test.ts; here the caller is an admin.
vi.mock('@/lib/auth/require-admin', () => ({
  isAdminRequest: vi.fn().mockResolvedValue(true),
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  UNAUTHORIZED_MESSAGE: 'Unauthorized',
}));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => {
      const eq: [string, unknown][] = [];
      const builder: any = {
        insert: (payload: Record<string, unknown>) => {
          state.inserts.push(payload);
          return builder;
        },
        select: () => builder,
        single: async () => ({ data: { id: 'flow-1' } }),
        update: (payload: Record<string, unknown>) => {
          state.updates.push({ table, payload, eq });
          return builder;
        },
        delete: () => {
          state.deletes.push({ table, eq });
          return builder;
        },
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return builder;
        },
        then: (resolve: (value: { error: null | { message: string } }) => void) => {
          resolve({ error: state.nextError });
        },
      };
      return builder;
    },
  }),
}));

import { createFlow, saveFlowBuilderSteps, saveFlowSettings, setFlowArchived } from '@/app/admin/(gated)/flows/actions';
import { readPublicReplyOptions } from '@/lib/flow-engine/public-replies';

function settingsForm(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

beforeEach(() => {
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.revalidated = [];
  state.nextError = null;
});

describe('flow admin actions', () => {
  it.each([['comment', true], ['dm', false], ['story_reply', false]])(
    'sets the public reply default on creation for %s',
    async (triggerType, enabled) => {
      await createFlow(settingsForm({ name: 'New flow', trigger_type: triggerType }));
      expect(state.inserts[0]).toMatchObject({ trigger_type: triggerType, public_reply_enabled: enabled });
    },
  );

  it('saves ordered reply options and recalculates the final percentage even with replies disabled', async () => {
    const form = settingsForm({ name: 'Flow', language: 'tr', trigger_type: 'comment', trigger_keywords: 'hello' });
    form.append('public_reply_text', '  First  ');
    form.append('public_reply_text', 'Second');
    form.append('public_reply_probability', '70');

    expect(await saveFlowSettings('flow-1', form)).toEqual({ ok: true });
    expect(state.updates[0].payload.public_reply_enabled).toBe(false);
    expect(readPublicReplyOptions(state.updates[0].payload.public_reply_options)).toEqual([
      { text: 'First', probability: 70 },
      { text: 'Second', probability: 30 },
    ]);
    expect(state.revalidated).toContain('/admin/flows/flow-1');
  });

  it.each([
    ['   ', ['70'], 'Enter text'],
    ['Third', ['70', '50'], 'more than 100%'],
    ['Third', ['70', '2.5'], 'whole probabilities'],
    ['Third', ['70', ''], 'whole probabilities'],
  ] as const)('rejects invalid public reply settings', async (lastText, probabilities, error) => {
    const form = settingsForm({ name: 'Flow', language: 'tr', trigger_type: 'comment', trigger_keywords: 'hello', public_reply_enabled: 'on' });
    for (const probability of probabilities) {
      form.append('public_reply_text', 'Reply');
      form.append('public_reply_probability', probability);
    }
    form.append('public_reply_text', lastText);

    expect(await saveFlowSettings('flow-1', form)).toEqual({ ok: false, error: expect.stringContaining(error) });
    expect(state.updates).toEqual([]);
  });

  it('archives a flow without deleting post attachments', async () => {
    await setFlowArchived('flow-1', true);

    expect(state.updates).toEqual([
      expect.objectContaining({
        table: 'flows',
        payload: expect.objectContaining({ archived: true }),
        eq: [['id', 'flow-1']],
      }),
    ]);
    expect(state.deletes).toEqual([]);
    expect(state.revalidated).toEqual(expect.arrayContaining(['/admin/flows', '/admin/posts', '/admin/stats']));
  });

  it('saves expanded settings and clears post attachments when trigger is no longer comment', async () => {
    await saveFlowSettings('flow-1', settingsForm({
      name: 'Story flow',
      language: 'en',
      trigger_type: 'story_reply',
      trigger_keywords: 'hello, VIP',
    }));

    expect(state.updates[0]).toEqual(expect.objectContaining({
      table: 'flows',
      payload: expect.objectContaining({
        name: 'Story flow',
        language: 'en',
        trigger_type: 'story_reply',
        trigger_keywords: ['hello', 'VIP'],
      }),
      eq: [['id', 'flow-1']],
    }));
    expect(state.deletes).toEqual([
      expect.objectContaining({ table: 'flow_posts', eq: [['flow_id', 'flow-1']] }),
    ]);
  });

  it('saves builder steps after schema validation', async () => {
    const result = await saveFlowBuilderSteps('flow-1', [
      { id: 's1', type: 'send_link', text: 'Open this', label: 'Open', destination_url: 'https://example.com' },
    ]);

    expect(result).toEqual({ ok: true });
    expect(state.updates[0]).toEqual(expect.objectContaining({
      table: 'flows',
      payload: expect.objectContaining({
        steps: [{ id: 's1', type: 'send_link', text: 'Open this', label: 'Open', destination_url: 'https://example.com' }],
      }),
      eq: [['id', 'flow-1']],
    }));
  });

  it('returns plain-language validation errors for invalid builder steps', async () => {
    const result = await saveFlowBuilderSteps('flow-1', [
      { id: 's1', type: 'send_link', text: 'Open this', label: 'This label is much too long', destination_url: 'not-a-url' },
    ]);

    expect(result.ok).toBe(false);
    expect(result).toEqual(expect.objectContaining({
      error: expect.stringContaining('Label must be 20 characters or fewer'),
    }));
    expect(result).toEqual(expect.objectContaining({
      error: expect.stringContaining('Destination URL must be a valid link starting with http:// or https://'),
    }));
    expect(state.updates).toEqual([]);
  });
});
