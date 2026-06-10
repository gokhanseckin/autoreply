'use server';
import { serviceClient } from '@/lib/db/client';
import { decryptSecret, decodeBytea } from '@/lib/db/encryption';
import { isAdminRequest, requireAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';

export async function setPostFlows(postId: string, flowIds: string[]) {
  await requireAdmin();
  const db = serviceClient();
  await db.from('flow_posts').delete().eq('post_id', postId);
  if (flowIds.length > 0) {
    await db.from('flow_posts').insert(flowIds.map(fid => ({ post_id: postId, flow_id: fid })));
  }
  revalidatePath('/admin/posts');
}

export type SyncResult = { ok: true; count: number } | { ok: false; error: string };

export async function syncPosts(igAccountId: string): Promise<SyncResult> {
  if (!(await isAdminRequest())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const db = serviceClient();
  const { data: acc } = await db.from('ig_accounts').select('*').eq('id', igAccountId).single();
  if (!acc) return { ok: false, error: 'Account not found.' };
  const token = await decryptSecret(decodeBytea(acc.page_access_token_enc));
  // graph.instagram.com is used because tokens are IG-Login scoped (IGAA*).
  const res = await fetch('https://graph.instagram.com/v23.0/me/media?fields=id,caption,permalink,timestamp&limit=25', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    return { ok: false, error: json?.error?.message ?? `Instagram returned ${res.status}` };
  }
  let count = 0;
  for (const m of json.data ?? []) {
    await db.from('posts').upsert({
      ig_account_id: igAccountId,
      ig_media_id: m.id,
      caption_excerpt: (m.caption ?? '').slice(0, 140),
      permalink: m.permalink,
      posted_at: m.timestamp ?? null,
    }, { onConflict: 'ig_media_id' });
    count++;
  }
  revalidatePath('/admin/posts');
  return { ok: true, count };
}
