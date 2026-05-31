import { z } from 'zod';

// The shape of a `comments` change value. Parsed lazily per-item in the handler
// so an unrelated change field (mentions, reactions, …) in the same delivery
// doesn't fail the whole webhook.
export const CommentValue = z.object({
  id: z.string(),
  from: z.object({ id: z.string(), username: z.string().optional() }),
  media: z.object({ id: z.string() }),
  text: z.string(),
});

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
