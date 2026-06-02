import { describe, expect, it } from 'vitest';
import {
  canUseGuidedBuilder,
  createLinkStep,
  createMessageStep,
  createPlainMessageStep,
  toGuidedSteps,
} from '@/app/admin/(gated)/flows/[id]/flow-builder-model';

describe('flow-builder-model', () => {
  it('uses the guided builder for common message, link, email, and end blocks', () => {
    expect(canUseGuidedBuilder([
      createMessageStep(1),
      createLinkStep(2),
      { id: 's3', type: 'collect_email' },
      { id: 's4', type: 'end' },
    ])).toBe(true);
  });

  it('builds a plain message block and keeps it guided-compatible', () => {
    const plain = createPlainMessageStep(5);
    expect(plain).toMatchObject({ id: 's5', type: 'send_message', plain: true });
    expect(canUseGuidedBuilder([plain])).toBe(true);
    // round-trips through the normalizer without losing the plain flag
    expect(toGuidedSteps([plain])?.[0]).toMatchObject({ plain: true });
  });

  it('falls back to advanced JSON for unsupported engine steps', () => {
    expect(canUseGuidedBuilder([
      { id: 's1', type: 'wait_for_text', on_match_next_id: 's2', on_miss: 'retry' },
    ])).toBe(false);
  });

  it('converts old button-gate flows into guided choice blocks', () => {
    const guided = toGuidedSteps([
      {
        id: 's1',
        type: 'send_message',
        text: 'Want the link?',
        buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }],
      },
      { id: 's2', type: 'wait_for_button', expected_payloads: ['s2'], on_each: { s2: 's3' } },
      {
        id: 's3',
        type: 'send_link',
        text: 'Here it is',
        label: 'Open',
        destination_url: 'https://example.com',
      },
    ]);

    expect(guided).toEqual([
      {
        id: 's1',
        type: 'send_message',
        text: 'Want the link?',
        buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's3' } }],
      },
      {
        id: 's3',
        type: 'send_link',
        text: 'Here it is',
        label: 'Open',
        destination_url: 'https://example.com',
      },
    ]);
    expect(canUseGuidedBuilder(guided!)).toBe(true);
  });
});
