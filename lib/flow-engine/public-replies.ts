import { z } from 'zod';

const PublicReplyText = z.string().trim().min(1);
const Probability = z.number().int().min(0).max(100);
const PublicReplyOptionsSchema = z.array(z.object({
  text: PublicReplyText,
  probability: Probability,
})).min(1).refine((options) => options.reduce((sum, option) => sum + option.probability, 0) === 100);

export type PublicReplyOption = z.infer<typeof PublicReplyOptionsSchema>[number];

export const DEFAULT_PUBLIC_REPLY_OPTIONS: PublicReplyOption[] = [
  { text: 'Teşekkürler. Mesaj gönderildi', probability: 100 },
];

export function remainingReplyProbability(probabilities: number[]): number {
  return 100 - probabilities.reduce((sum, probability) => sum + probability, 0);
}

export function parsePublicReplyForm(form: FormData) {
  const texts = z.array(PublicReplyText).min(1).safeParse(form.getAll('public_reply_text'));
  if (!texts.success) return { ok: false, error: 'Enter text for each public reply option.' } as const;

  const submitted = form.getAll('public_reply_probability');
  const probabilities = z.array(Probability).safeParse(submitted.map((value) => (
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  )));
  if (!probabilities.success || submitted.length !== texts.data.length - 1) {
    return { ok: false, error: 'Enter whole probabilities from 0 to 100.' } as const;
  }

  const remaining = remainingReplyProbability(probabilities.data);
  if (remaining < 0) {
    return { ok: false, error: 'Public reply probabilities cannot add up to more than 100%.' } as const;
  }
  const options = texts.data.map((text, index) => ({
    text,
    probability: probabilities.data[index] ?? remaining,
  }));
  return { ok: true, options } as const;
}

export function readPublicReplyOptions(value: unknown): PublicReplyOption[] {
  return PublicReplyOptionsSchema.safeParse(value).data ?? DEFAULT_PUBLIC_REPLY_OPTIONS;
}

export function choosePublicReply(options: PublicReplyOption[], random = Math.random): string | undefined {
  const draw = random();
  let cumulative = 0;
  for (const option of options) {
    cumulative += option.probability;
    if (draw < cumulative / 100) return option.text;
  }
}
