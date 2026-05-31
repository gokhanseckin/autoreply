'use server';
import { serviceClient } from '@/lib/db/client';
import { encryptSecret, encodeBytea } from '@/lib/db/encryption';
import { getMe } from '@/lib/meta/client';
import { revalidatePath } from 'next/cache';

export type AddAccountResult =
  | { ok: true; igBusinessAccountId: string; username: string | null }
  | { ok: false; error: string };

export async function addAccount(_prev: unknown, form: FormData): Promise<AddAccountResult> {
  const name = String(form.get('name'));
  const fbPage = String(form.get('fb_page_id') ?? '');
  const token = String(form.get('page_access_token'));
  const lang = String(form.get('default_language'));

  // Resolve the canonical IG account id from Graph instead of trusting a typed value.
  // `user_id` is the Instagram-scoped id that webhook deliveries carry in `entry.id`.
  let me: { id: string; user_id?: string; username?: string };
  try {
    me = await getMe(token);
  } catch (e) {
    return { ok: false, error: `Could not verify token with Instagram: ${(e as Error).message}` };
  }
  const igBusinessAccountId = me.user_id ?? me.id;
  if (!igBusinessAccountId) {
    return { ok: false, error: 'Instagram did not return an account id for this token.' };
  }

  const enc = await encryptSecret(token);
  const db = serviceClient();
  const { error } = await db.from('ig_accounts').insert({
    name,
    ig_business_account_id: igBusinessAccountId,
    fb_page_id: fbPage || igBusinessAccountId,
    page_access_token_enc: encodeBytea(enc),
    default_language: lang,
  });
  if (error) return { ok: false, error: `Database error: ${error.message}` };

  revalidatePath('/admin/accounts');
  return { ok: true, igBusinessAccountId, username: me.username ?? null };
}
