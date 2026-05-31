import { describe, it, expect } from 'vitest';
import { advance, type FlowContext } from '@/lib/flow-engine/machine';
import type { FlowStep } from '@/lib/flow-engine/schema';

const steps: FlowStep[] = [
  { id: 's1', type: 'send_message', text: 'Hi', buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }] },
  { id: 's2', type: 'wait_for_button', expected_payloads: ['s2'], on_each: { s2: 's3' } },
  { id: 's3', type: 'send_link', text: 'Here you go', label: 'Open', destination_url: 'https://x.test', next_id: 's4' },
  { id: 's4', type: 'end' },
];

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
  it('starts at the first step (send_message + buttons -> waits)', async () => {
    const result = await advance(ctx(), { type: 'trigger' }, { sendText: async () => ({ message_id: 'm' }), sendButtons: async () => ({ message_id: 'm' }), recordLink: async () => 'CODE', logSend: async () => {} });
    expect(result.nextStepId).toBe('s2');
    expect(result.awaitingInputType).toBe('button');
  });
});
