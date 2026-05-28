'use server';
import { serviceClient } from '@/lib/db/client';
import { encryptSecret, encodeBytea } from '@/lib/db/encryption';
import { revalidatePath } from 'next/cache';

export async function addAccount(form: FormData) {
  const name = String(form.get('name'));
  const igBiz = String(form.get('ig_business_account_id'));
  const fbPage = String(form.get('fb_page_id'));
  const token = String(form.get('page_access_token'));
  const lang = String(form.get('default_language'));
  const enc = await encryptSecret(token);
  const db = serviceClient();
  await db.from('ig_accounts').insert({
    name, ig_business_account_id: igBiz, fb_page_id: fbPage,
    page_access_token_enc: encodeBytea(enc),
    default_language: lang,
  });
  revalidatePath('/admin/accounts');
}
