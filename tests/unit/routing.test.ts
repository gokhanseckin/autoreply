import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { table?: string; select?: string; eq: [string, unknown][] } = { eq: [] };
let result: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => {
    const builder: any = {
      from(t: string) { calls.table = t; calls.eq = []; return builder; },
      select(s: string) { calls.select = s; return builder; },
      eq(col: string, val: unknown) { calls.eq.push([col, val]); return builder; },
      then(resolve: (r: typeof result) => void) { resolve(result); },
    };
    return builder;
  },
}));

import { matchTriggerKeyword, findCommentFlow, findDmFlow, findStoryReplyFlow } from '@/lib/flow-engine/routing';

const step = { id: 's1', type: 'send_message', text: 'hi' };

beforeEach(() => { calls.table = undefined; calls.select = undefined; calls.eq = []; result = { data: [], error: null }; });

describe('matchTriggerKeyword', () => {
  it('finds keyword as whole-word substring (case-insensitive)', () => {
    expect(matchTriggerKeyword('I want the FREE course', ['free', 'course'])).toBe('free');
  });
  it('returns null when no match', () => {
    expect(matchTriggerKeyword('hello world', ['free'])).toBeNull();
  });
});

describe('findCommentFlow', () => {
  it('resolves the IG media id via the posts relation (no uuid cast)', async () => {
    result = { data: [{ flows: { id: 'f1', trigger_keywords: ['free'], steps: [step] } }], error: null };
    const f = await findCommentFlow({ igAccountId: 'a1', postId: '178414_IGMEDIA', commentText: 'free please' });
    expect(f?.id).toBe('f1');
    expect(calls.table).toBe('flow_posts');
    expect(calls.select).toContain('posts!inner');
    expect(calls.eq).toContainEqual(['posts.ig_media_id', '178414_IGMEDIA']);
  });

  it('returns null when no keyword matches', async () => {
    result = { data: [{ flows: { id: 'f1', trigger_keywords: ['free'], steps: [step] } }], error: null };
    expect(await findCommentFlow({ igAccountId: 'a1', postId: 'm', commentText: 'nope' })).toBeNull();
  });

  it('skips a keyword-matching flow that has no steps', async () => {
    result = { data: [{ flows: { id: 'f1', trigger_keywords: ['free'], steps: [] } }], error: null };
    expect(await findCommentFlow({ igAccountId: 'a1', postId: 'm', commentText: 'free' })).toBeNull();
  });
});

describe('findDmFlow', () => {
  it('skips a keyword-matching flow that has no steps', async () => {
    result = { data: [{ id: 'f1', trigger_keywords: ['hi'], steps: [] }], error: null };
    expect(await findDmFlow({ igAccountId: 'a1', text: 'hi' })).toBeNull();
  });
  it('returns a configured flow on match', async () => {
    result = { data: [{ id: 'f1', trigger_keywords: ['hi'], steps: [step] }], error: null };
    expect((await findDmFlow({ igAccountId: 'a1', text: 'hi there' }))?.id).toBe('f1');
  });
});

describe('findStoryReplyFlow', () => {
  it('matches a keyword globally for any story reply on the account', async () => {
    result = { data: [{ id: 'story-flow', trigger_keywords: ['reply'], steps: [step] }], error: null };

    const flow = await findStoryReplyFlow({ igAccountId: 'a1', text: 'story reply please' });

    expect(flow?.id).toBe('story-flow');
    expect(calls.table).toBe('flows');
    expect(calls.eq).toContainEqual(['ig_account_id', 'a1']);
    expect(calls.eq).toContainEqual(['trigger_type', 'story_reply']);
    expect(calls.eq).toContainEqual(['archived', false]);
    expect(calls.eq.some(([col]) => String(col).includes('post'))).toBe(false);
  });

  it('skips a keyword-matching story flow that has no steps', async () => {
    result = { data: [{ id: 'story-flow', trigger_keywords: ['reply'], steps: [] }], error: null };

    expect(await findStoryReplyFlow({ igAccountId: 'a1', text: 'reply' })).toBeNull();
  });
});
