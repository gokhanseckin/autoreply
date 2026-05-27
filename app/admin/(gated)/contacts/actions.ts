'use server';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';
import { revalidatePath } from 'next/cache';

export async function eraseContact(contactId: string) {
  await executeErasure({ contactId, requestedVia: 'admin' });
  revalidatePath('/admin/contacts');
}
