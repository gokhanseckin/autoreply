import { z } from 'zod';

// The shape of a `comments` change value. Parsed lazily per-item in the handler
// so an unrelated change field (mentions, reactions, …) in the same delivery
// doesn't fail the whole webhook.
//
// `media.media_product_type` distinguishes where the comment lives: 'FEED' /
// 'REELS' / 'AD' comments belong to a post, while 'STORY' marks a public story
// comment — which we route to the account's story-reply flows.
export const CommentValue = z.object({
  id: z.string(),
  from: z.object({ id: z.string(), username: z.string().optional() }),
  media: z.object({ id: z.string(), media_product_type: z.string().optional() }),
  text: z.string(),
});

export function isStoryComment(value: { media: { media_product_type?: string } }): boolean {
  return value.media.media_product_type?.toUpperCase() === 'STORY';
}

// Permissive change envelope: accept any `field`, keep `value` opaque.
export const Change = z.object({
  field: z.string(),
  value: z.unknown(),
});

export const MessagingMessage = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number(),
  message: z
    .object({
      mid: z.string(),
      text: z.string().optional(),
      reply_to: z
        .object({
          story: z.object({ id: z.string(), url: z.string().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
  postback: z
    .object({
      mid: z.string().optional(),
      payload: z.string(),
      title: z.string().optional(),
    })
    .optional(),
});

export const MetaEntry = z.object({
  id: z.string(),
  time: z.number(),
  changes: z.array(Change).optional(),
  messaging: z.array(MessagingMessage).optional(),
});

export const MetaWebhookSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(MetaEntry),
});

export type MetaWebhook = z.infer<typeof MetaWebhookSchema>;
