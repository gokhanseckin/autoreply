'use server';
import { serviceClient } from '@/lib/db/client';
import { decryptSecret, decodeBytea } from '@/lib/db/encryption';
import { revalidatePath } from 'next/cache';

export async function toggleMonitor(postId: string, next: boolean) {
  const db = serviceClient();
  await db.from('posts').update({ monitored: next }).eq('id', postId);
  revalidatePath('/admin/posts');
}

export async function syncPosts(igAccountId: string) {
  const db = serviceClient();
  const { data: acc } = await db.from('ig_accounts').select('*').eq('id', igAccountId).single();
  if (!acc) return;
  const token = await decryptSecret(decodeBytea(acc.page_access_token_enc));
  // graph.instagram.com is used because tokens are IG-Login scoped (IGAA*).
  // Endpoint shape: /me/media works with the IG user token directly.
  const res = await fetch(`https://graph.instagram.com/v23.0/me/media?fields=id,caption,permalink&limit=25&access_token=${encodeURIComponent(token)}`);
  const json = await res.json();
  for (const m of json.data ?? []) {
    await db.from('posts').upsert({
      ig_account_id: igAccountId,
      ig_media_id: m.id,
      caption_excerpt: (m.caption ?? '').slice(0, 140),
      permalink: m.permalink,
    }, { onConflict: 'ig_media_id' });
  }
  revalidatePath('/admin/posts');
}
