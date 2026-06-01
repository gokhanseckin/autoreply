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

function hasSteps(f: Flow): boolean {
  return Array.isArray(f.steps) && f.steps.length > 0;
}

function shortId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

export async function findCommentFlow(args: { igAccountId: string; postId: string; commentText: string }): Promise<Flow | null> {
  const db = serviceClient();
  // args.postId is the Instagram media id; resolve it to the internal post via the
  // embedded `posts` relation so we never compare a uuid column to a media id.
  const { data, error } = await db
    .from('flow_posts')
    .select('flows!inner(*), posts!inner(ig_media_id)')
    .eq('posts.ig_media_id', args.postId)
    .eq('flows.ig_account_id', args.igAccountId)
    .eq('flows.trigger_type', 'comment')
    .eq('flows.archived', false);
  if (error) throw error;
  for (const row of data ?? []) {
    const f = (row as any).flows as Flow;
    if (hasSteps(f) && matchTriggerKeyword(args.commentText, f.trigger_keywords)) return f;
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
    const matchedKeyword = matchTriggerKeyword(args.text, f.trigger_keywords);
    console.info('[routing:dm]', JSON.stringify({
      igAccountId: shortId(args.igAccountId),
      flowId: shortId(f.id),
      archived: f.archived,
      keywords: f.trigger_keywords,
      hasSteps: hasSteps(f),
      matchedKeyword,
      textPreview: args.text.slice(0, 80),
    }));
    if (hasSteps(f) && matchedKeyword) return f;
  }
  console.info('[routing:dm]', JSON.stringify({
    igAccountId: shortId(args.igAccountId),
    candidateCount: data?.length ?? 0,
    result: 'no_match',
    textPreview: args.text.slice(0, 80),
  }));
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
    const matchedKeyword = matchTriggerKeyword(args.text, f.trigger_keywords);
    console.info('[routing:story_reply]', JSON.stringify({
      igAccountId: shortId(args.igAccountId),
      flowId: shortId(f.id),
      archived: f.archived,
      keywords: f.trigger_keywords,
      hasSteps: hasSteps(f),
      matchedKeyword,
      textPreview: args.text.slice(0, 80),
      scope: 'account',
    }));
    if (hasSteps(f) && matchedKeyword) return f;
  }
  console.info('[routing:story_reply]', JSON.stringify({
    igAccountId: shortId(args.igAccountId),
    candidateCount: data?.length ?? 0,
    result: 'no_match',
    scope: 'account',
    textPreview: args.text.slice(0, 80),
  }));
  return null;
}
