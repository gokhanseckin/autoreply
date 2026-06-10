import { z } from 'zod';

// z.string().url() alone accepts javascript:/data: URLs; these end up in
// outbound buttons and the /r/[code] redirect, so only http(s) is allowed.
const HttpUrl = z.string().url().refine(
  (u) => /^https?:\/\//i.test(u),
  { message: 'URL must start with http:// or https://' },
);

export const ButtonAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next'), next_id: z.string() }),
  z.object({ type: z.literal('url'), url: HttpUrl }),
  z.object({ type: z.literal('end') }),
]);

export const Button = z.object({ label: z.string().min(1).max(20), action: ButtonAction });

export const SendMessageStep = z.object({
  id: z.string().min(1),
  type: z.literal('send_message'),
  text: z.string().min(1),
  buttons: z.array(Button).max(3).optional(),
  next_id: z.string().optional(),
  // `plain` sends a natural-looking text DM: no privacy footer, no button
  // template (so Instagram renders it as an ordinary message, not bold card),
  // links in the text stay tappable. Mutually exclusive with `buttons`.
  plain: z.boolean().optional(),
});

export const WaitForButtonStep = z.object({
  id: z.string(),
  type: z.literal('wait_for_button'),
  expected_payloads: z.array(z.string()),
  on_each: z.record(z.string(), z.string()),
});

export const WaitForTextStep = z.object({
  id: z.string(),
  type: z.literal('wait_for_text'),
  regex: z.string().optional(),
  on_match_next_id: z.string(),
  on_miss: z.union([z.literal('retry'), z.literal('end'), z.string()]),
  max_retries: z.number().int().min(0).max(5).default(3),
});

export const CollectEmailStep = z.object({
  id: z.string(),
  type: z.literal('collect_email'),
  next_id: z.string().optional(),
});

export const SendLinkStep = z.object({
  id: z.string(),
  type: z.literal('send_link'),
  text: z.string(),
  label: z.string().max(20),
  destination_url: HttpUrl,
  next_id: z.string().optional(),
});

export const BranchStep = z.object({
  id: z.string(),
  type: z.literal('branch'),
  cases: z.array(z.object({ when: z.string(), next_id: z.string() })),
  default_next_id: z.string().optional(),
});

export const EndStep = z.object({ id: z.string(), type: z.literal('end') });

export const FlowStep = z.discriminatedUnion('type', [
  SendMessageStep,
  WaitForButtonStep,
  WaitForTextStep,
  CollectEmailStep,
  SendLinkStep,
  BranchStep,
  EndStep,
]);

export const FlowStepsSchema = z.array(FlowStep);

export type FlowStep = z.infer<typeof FlowStep>;
