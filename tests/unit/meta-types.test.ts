import { describe, it, expect } from 'vitest';
import { MetaWebhookSchema, CommentValue } from '@/lib/meta/types';
import comment from '../fixtures/meta/comment.json';
import message from '../fixtures/meta/message.json';
import postback from '../fixtures/meta/postback.json';
import story from '../fixtures/meta/story_reply.json';

describe('MetaWebhookSchema', () => {
  it.each([
    ['comment', comment],
    ['message', message],
    ['postback', postback],
    ['story_reply', story],
  ])('parses %s payload', (_, payload) => {
    expect(() => MetaWebhookSchema.parse(payload)).not.toThrow();
  });

  it('tolerates a delivery mixing comments with an unknown change field', () => {
    const mixed = {
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: 1748372160,
        changes: [
          { field: 'mentions', value: { media_id: 'x', comment_id: 'y' } },
          {
            field: 'comments',
            value: { id: 'c1', from: { id: 'u1', username: 'tester' }, media: { id: 'm1' }, text: 'FREE' },
          },
        ],
      }],
    };
    const parsed = MetaWebhookSchema.parse(mixed);
    const comments = parsed.entry[0].changes!.filter(c => c.field === 'comments');
    expect(comments).toHaveLength(1);
    expect(CommentValue.parse(comments[0].value).text).toBe('FREE');
  });
});
