import { serviceClient } from '@/lib/db/client';
import bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

export async function executeErasure(args: {
  contactId: string;
  requestedVia: 'dm' | 'admin' | 'email';
  db?: SupabaseClient<Database>;
}) {
  const db = args.db ?? serviceClient();

  const { data: req } = await db.from('deletion_requests').insert({
    contact_id: args.contactId,
    requested_via: args.requestedVia,
    status: 'pending',
  }).select().single();

  const { data: subs } = await db.from('email_subscribers').select('id,email').eq('contact_id', args.contactId);
  for (const s of subs ?? []) {
    const hashed = await bcrypt.hash(s.email, 8);
    await db.from('email_subscribers').update({ email: hashed, status: 'deleted' }).eq('id', s.id);
  }

  await db.from('messages_log').update({ payload: { redacted: true } }).eq('contact_id', args.contactId);
  await db.from('consent_log').update({ contact_id: null }).eq('contact_id', args.contactId);
  await db.from('contacts').delete().eq('id', args.contactId);

  if (req) {
    await db.from('deletion_requests').update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      contact_id: null,
    }).eq('id', req.id);
  }
}
