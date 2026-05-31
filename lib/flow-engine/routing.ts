import { serviceClient } from '@/lib/db/client';
import type { Flow } from '@/lib/db/queries';

export function matchTriggerKeyword(text: string, keywords: string[]): string | null {
  const t = text.toLowerCase();
  for (const k of keywords) {
    const kl = k.toLowerCase();
    const re = new RegExp(`(^|\\W)${kl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`);
    if (re.test(t)) return kl;
  }
  return null;
}

export async function findCommentFlow(args: { igAccountId: string; postId: string; commentText: string }): Promise<Flow | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('flow_posts')
    .select('flows!inner(*)')
    .eq('post_id', args.postId)
    .eq('flows.ig_account_id', args.igAccountId)
    .eq('flows.trigger_type', 'comment')
    .eq('flows.archived', false);
  if (error) throw error;
  for (const row of data ?? []) {
    const f = (row as any).flows as Flow;
    if (matchTriggerKeyword(args.commentText, f.trigger_keywords)) return f;
  }
  return null;
}

export async function findDmFlow(args: { igAccountId: string; text: string }): Promise<Flow | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('flows')
    .select('*')
    .eq('ig_account_id', args.igAccountId)
    .eq('trigger_type', 'dm')
    .eq('archived', false);
  if (error) throw error;
  for (const f of data ?? []) {
    if (matchTriggerKeyword(args.text, f.trigger_keywords)) return f;
  }
  return null;
}

export async function findStoryReplyFlow(args: { igAccountId: string; text: string }): Promise<Flow | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('flows')
    .select('*')
    .eq('ig_account_id', args.igAccountId)
    .eq('trigger_type', 'story_reply')
    .eq('archived', false);
  if (error) throw error;
  for (const f of data ?? []) {
    if (matchTriggerKeyword(args.text, f.trigger_keywords)) return f;
  }
  return null;
}
