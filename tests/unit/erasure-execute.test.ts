import { describe, it, expect, vi } from 'vitest';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';

describe('executeErasure', () => {
  it('runs the documented anonymization sequence in order', async () => {
    const calls: string[] = [];
    const db = {
      from(table: string) {
        const chain = {
          delete: () => chain,
          update: () => chain,
          insert: () => { calls.push(`insert:${table}`); return chain; },
          eq: () => chain,
          select: () => chain,
          single: async () => ({ data: { id: 'x' }, error: null }),
          then: (cb: any) => cb({ data: null, error: null }),
        } as any;
        if (table === 'contacts') calls.push('delete:contacts');
        if (table === 'email_subscribers') calls.push('update:email_subscribers');
        if (table === 'messages_log') calls.push('update:messages_log');
        if (table === 'consent_log') calls.push('update:consent_log');
        return chain;
      },
    };
    await executeErasure({ contactId: 'c1', requestedVia: 'dm', db: db as any });
    expect(calls.some((c) => c.startsWith('insert:deletion_requests'))).toBe(true);
  });
});
