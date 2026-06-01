import { describe, it, expect } from 'vitest';
import { advance, type FlowContext, type Effects } from '@/lib/flow-engine/machine';
import type { FlowStep } from '@/lib/flow-engine/schema';

const steps: FlowStep[] = [
  {
    id: 's1',
    type: 'send_message',
    text: 'Pick one',
    buttons: [
      { label: 'Free PDF', action: { type: 'next', next_id: 's_pdf' } },
      { label: 'No thanks', action: { type: 'next', next_id: 's_bye' } },
    ],
  },
  { id: 's_pdf', type: 'send_link', text: 'Here you go', label: 'Open', destination_url: 'https://x.test', next_id: 's_end' },
  { id: 's_bye', type: 'send_message', text: 'Bye' },
  { id: 's_end', type: 'end' },
];

const effects: Effects = {
  sendText: async () => ({ message_id: 'm' }),
  sendButtons: async () => ({ message_id: 'm' }),
  recordLink: async () => 'CODE',
  logSend: async () => {},
};

function ctx(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    steps,
    language: 'en',
    currentStepId: null,
    contactId: 'c1',
    igAccountId: 'a1',
    flowId: 'f1',
    pageAccessToken: 'TOK',
    igUserId: 'u1',
    ...overrides,
  };
}

describe('advance', () => {
  it('sends buttons and waits on the send_message step itself', async () => {
    const result = await advance(ctx(), { type: 'trigger' }, effects);
    expect(result.nextStepId).toBe('s1');
    expect(result.awaitingInputType).toBe('button');
  });

  it('routes each button to its own target on re-entry', async () => {
    // Tapping "Free PDF" (payload = its next_id) follows the send_link -> end branch.
    const pdf = await advance(ctx({ currentStepId: 's1' }), { type: 'button', payload: 's_pdf' }, effects);
    expect(pdf.nextStepId).toBeNull();

    // Tapping "No thanks" follows the other branch (send_message with no next -> ends).
    const bye = await advance(ctx({ currentStepId: 's1' }), { type: 'button', payload: 's_bye' }, effects);
    expect(bye.nextStepId).toBeNull();
    expect(bye.awaitingInputType).toBeNull();
  });

  it('consumes a button when its target is a wait_for_button gate', async () => {
    const gatedSteps: FlowStep[] = [
      {
        id: 's1',
        type: 'send_message',
        text: 'Want it?',
        buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }],
      },
      { id: 's2', type: 'wait_for_button', expected_payloads: ['s2'], on_each: { s2: 's3' } },
      { id: 's3', type: 'send_link', text: 'Here you go', label: 'Open', destination_url: 'https://x.test', next_id: 's4' },
      { id: 's4', type: 'end' },
    ];

    const result = await advance(ctx({ steps: gatedSteps, currentStepId: 's1' }), { type: 'button', payload: 's2' }, effects);

    expect(result.nextStepId).toBeNull();
    expect(result.awaitingInputType).toBeNull();
  });

  it('ends when an END_ payload is received', async () => {
    const result = await advance(ctx({ currentStepId: 's1' }), { type: 'button', payload: 'END_s1' }, effects);
    expect(result.nextStepId).toBeNull();
    expect(result.awaitingInputType).toBeNull();
  });
});
