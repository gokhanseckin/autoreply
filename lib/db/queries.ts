import { serviceClient } from './client';
import type { Database } from './types';

type Tables = Database['public']['Tables'];
export type IgAccount = Tables['ig_accounts']['Row'];
export type Post = Tables['posts']['Row'];
export type Flow = Tables['flows']['Row'];
export type Contact = Tables['contacts']['Row'];
export type ConversationState = Tables['conversation_state']['Row'];
export type MessageLog = Tables['messages_log']['Row'];
export type Link = Tables['links']['Row'];
export type LinkCode = Tables['link_codes']['Row'];

export async function findIgAccountByBusinessId(igBusinessAccountId: string) {
  const db = serviceClient();
  const { data, error } = await db
    .from('ig_accounts')
    .select('*')
    .eq('ig_business_account_id', igBusinessAccountId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertContact(args: {
  igAccountId: string;
  igUserId: string;
  igUsername?: string;
}): Promise<Contact> {
  const db = serviceClient();
  const { data, error } = await db
    .from('contacts')
    .upsert(
      {
        ig_account_id: args.igAccountId,
        ig_user_id: args.igUserId,
        ig_username: args.igUsername,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'ig_account_id,ig_user_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadConversationState(contactId: string): Promise<ConversationState | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('conversation_state')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveConversationState(state: Partial<ConversationState> & { contact_id: string }) {
  const db = serviceClient();
  const { error } = await db.from('conversation_state').upsert(
    { ...state, updated_at: new Date().toISOString() },
    { onConflict: 'contact_id' },
  );
  if (error) throw error;
}

export async function alreadyProcessed(metaMessageId: string): Promise<boolean> {
  const db = serviceClient();
  const { data } = await db
    .from('messages_log')
    .select('id')
    .eq('meta_message_id', metaMessageId)
    .maybeSingle();
  return !!data;
}

// Atomically claims an inbound webhook event. Meta redelivers webhooks within
// seconds; the unique meta_message_id constraint makes exactly one delivery
// win the insert. Returns false when another delivery already claimed it.
export async function claimInboundMessage(row: Tables['messages_log']['Insert']): Promise<boolean> {
  const db = serviceClient();
  const { error } = await db.from('messages_log').insert(row);
  if (error) {
    if (error.code === '23505') return false;
    throw error;
  }
  return true;
}

export async function logMessage(row: Tables['messages_log']['Insert']) {
  const db = serviceClient();
  const { data, error } = await db.from('messages_log').insert(row).select().single();
  if (error) throw error;
  return data;
}
