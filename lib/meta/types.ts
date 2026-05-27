import { z } from 'zod';

export const CommentChange = z.object({
  field: z.literal('comments'),
  value: z.object({
    id: z.string(),
    from: z.object({ id: z.string(), username: z.string().optional() }),
    media: z.object({ id: z.string() }),
    text: z.string(),
  }),
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
  changes: z.array(CommentChange).optional(),
  messaging: z.array(MessagingMessage).optional(),
});

export const MetaWebhookSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(MetaEntry),
});

export type MetaWebhook = z.infer<typeof MetaWebhookSchema>;
