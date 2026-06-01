import { describe, expect, it } from 'vitest';
import { canUseGuidedBuilder, createMessageStep, createLinkStep } from '@/app/admin/(gated)/flows/[id]/flow-builder-model';

describe('flow-builder-model', () => {
  it('uses the guided builder for common message, link, email, and end blocks', () => {
    expect(canUseGuidedBuilder([
      createMessageStep(1),
      createLinkStep(2),
      { id: 's3', type: 'collect_email' },
      { id: 's4', type: 'end' },
    ])).toBe(true);
  });

  it('falls back to advanced JSON for unsupported engine steps', () => {
    expect(canUseGuidedBuilder([
      { id: 's1', type: 'wait_for_text', on_match_next_id: 's2', on_miss: 'retry' },
    ])).toBe(false);
  });
});
