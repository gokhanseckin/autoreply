import { serviceClient } from '@/lib/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

// Delegates to the `erase_contact` Postgres function so the whole anonymization
// runs in a single transaction (all-or-nothing).
export async function executeErasure(args: {
  contactId: string;
  requestedVia: 'dm' | 'admin' | 'email';
  db?: SupabaseClient<Database>;
}) {
  const db = args.db ?? serviceClient();
  const { error } = await db.rpc('erase_contact', {
    p_contact_id: args.contactId,
    p_requested_via: args.requestedVia,
  });
  if (error) throw error;
}
