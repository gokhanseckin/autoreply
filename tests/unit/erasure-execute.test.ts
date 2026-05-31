import { describe, it, expect, vi } from 'vitest';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';

describe('executeErasure', () => {
  it('delegates to the erase_contact RPC with the right args', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await executeErasure({ contactId: 'c1', requestedVia: 'dm', db: { rpc } as any });
    expect(rpc).toHaveBeenCalledWith('erase_contact', { p_contact_id: 'c1', p_requested_via: 'dm' });
  });

  it('throws when the RPC returns an error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(executeErasure({ contactId: 'c1', requestedVia: 'admin', db: { rpc } as any }))
      .rejects.toMatchObject({ message: 'boom' });
  });
});
