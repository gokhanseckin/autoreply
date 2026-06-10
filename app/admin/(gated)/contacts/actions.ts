'use server';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';
import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';

export async function eraseContact(contactId: string) {
  await requireAdmin();
  await executeErasure({ contactId, requestedVia: 'admin' });
  revalidatePath('/admin/contacts');
}
