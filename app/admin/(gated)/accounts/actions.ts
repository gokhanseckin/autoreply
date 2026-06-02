'use server';
import { serviceClient } from '@/lib/db/client';
import { decryptSecret, decodeBytea, encryptSecret, encodeBytea } from '@/lib/db/encryption';
import { getMe, subscribeToAppWebhooks } from '@/lib/meta/client';
import { revalidatePath } from 'next/cache';

export type AddAccountResult =
  | { ok: true; igBusinessAccountId: string; username: string | null }
  | { ok: false; error: string };
export type WebhookSubscriptionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

  try {
    await subscribeToAppWebhooks(token);
  } catch (e) {
    return { ok: false, error: `Could not subscribe this account to Instagram webhooks: ${errorMessage(e)}` };
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

export async function repairWebhookSubscription(_prev: unknown, form: FormData): Promise<WebhookSubscriptionResult> {
  const accountId = String(form.get('account_id') ?? '');
  if (!accountId) return { ok: false, error: 'Choose an Instagram account first.' };

  const db = serviceClient();
  const { data: account, error } = await db
    .from('ig_accounts')
    .select('id,name,page_access_token_enc')
    .eq('id', accountId)
    .maybeSingle();
  if (error) return { ok: false, error: `Database error: ${error.message}` };
  if (!account) return { ok: false, error: 'Instagram account not found.' };

  try {
    const token = await decryptSecret(decodeBytea(account.page_access_token_enc));
    await subscribeToAppWebhooks(token);
  } catch (e) {
    return { ok: false, error: `Could not refresh webhook subscription: ${errorMessage(e)}` };
  }

  revalidatePath('/admin/accounts');
  return { ok: true, message: `Webhook subscription refreshed for ${account.name}.` };
}
