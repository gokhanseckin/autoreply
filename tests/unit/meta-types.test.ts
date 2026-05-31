import { describe, it, expect } from 'vitest';
import { MetaWebhookSchema } from '@/lib/meta/types';
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
});
