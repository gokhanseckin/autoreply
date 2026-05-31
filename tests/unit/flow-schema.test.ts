import { describe, it, expect } from 'vitest';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';

describe('FlowStepsSchema', () => {
  it('accepts a typical multi-step flow', () => {
    const steps = [
      {
        id: 's1',
        type: 'send_message',
        text: "You're looking to access the free course?",
        buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }],
      },
      { id: 's2', type: 'wait_for_button', expected_payloads: ['s2'], on_each: { s2: 's3' } },
      {
        id: 's3',
        type: 'send_link',
        text: "Here's the Free Leads Course. Go win.",
        label: 'Free Course',
        destination_url: 'https://example.com/course',
      },
      { id: 's4', type: 'end' },
    ];
    expect(() => FlowStepsSchema.parse(steps)).not.toThrow();
  });

  it('rejects unknown step types', () => {
    expect(() => FlowStepsSchema.parse([{ id: 'x', type: 'wat' }])).toThrow();
  });
});
