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

describe('advance footer policy', () => {
  function capturing() {
    const sent: { kind: 'text' | 'buttons'; text: string }[] = [];
    const fx: Effects = {
      sendText: async ({ text }) => { sent.push({ kind: 'text', text }); return { message_id: 'm' }; },
      sendButtons: async ({ text }) => { sent.push({ kind: 'buttons', text }); return { message_id: 'm' }; },
      recordLink: async () => 'CODE',
      logSend: async () => {},
    };
    return { sent, fx };
  }

  const twoMessages: FlowStep[] = [
    { id: 's1', type: 'send_message', text: 'First', next_id: 's2' },
    { id: 's2', type: 'send_message', text: 'Second' },
  ];

  it('appends the privacy footer to only the first message of a fresh trigger', async () => {
    const { sent, fx } = capturing();
    await advance(ctx({ steps: twoMessages, appendFooter: true }), { type: 'trigger' }, fx);
    expect(sent[0].text).toContain('Privacy:');
    expect(sent[1].text).toBe('Second');
  });

  it('never footers a continuation (appendFooter false)', async () => {
    const { sent, fx } = capturing();
    await advance(ctx({ steps: twoMessages, appendFooter: false }), { type: 'trigger' }, fx);
    expect(sent[0].text).toBe('First');
    expect(sent[1].text).toBe('Second');
  });

  it('sends plain messages as bare text and lets the footer fall to the next normal message', async () => {
    const plainSteps: FlowStep[] = [
      { id: 's1', type: 'send_message', text: 'natural hello', plain: true, next_id: 's2' },
      { id: 's2', type: 'send_message', text: 'follow up' },
    ];
    const { sent, fx } = capturing();
    await advance(ctx({ steps: plainSteps, appendFooter: true }), { type: 'trigger' }, fx);
    expect(sent[0]).toEqual({ kind: 'text', text: 'natural hello' });
    expect(sent[1].text).toContain('Privacy:');
  });

  it('ignores buttons on a plain message and sends plain text', async () => {
    const plainWithButtons: FlowStep[] = [
      { id: 's1', type: 'send_message', text: 'just text', plain: true, buttons: [{ label: 'X', action: { type: 'end' } }] },
    ];
    const { sent, fx } = capturing();
    await advance(ctx({ steps: plainWithButtons, appendFooter: true }), { type: 'trigger' }, fx);
    expect(sent).toEqual([{ kind: 'text', text: 'just text' }]);
  });
});

describe('advance comment opener', () => {
  it('addresses only the first message to the comment id, then the user', async () => {
    const seen: { commentId?: string; igUserId: string }[] = [];
    const fx: Effects = {
      sendText: async ({ commentId, igUserId }) => { seen.push({ commentId, igUserId }); return { message_id: 'm' }; },
      sendButtons: async ({ commentId, igUserId }) => { seen.push({ commentId, igUserId }); return { message_id: 'm' }; },
      recordLink: async () => 'CODE',
      logSend: async () => {},
    };
    const twoMsg: FlowStep[] = [
      { id: 's1', type: 'send_message', text: 'first', next_id: 's2' },
      { id: 's2', type: 'send_message', text: 'second' },
    ];
    await advance(ctx({ steps: twoMsg, igUserId: 'u1', replyToCommentId: 'CMT' }), { type: 'trigger' }, fx);
    expect(seen[0].commentId).toBe('CMT');
    expect(seen[1].commentId).toBeUndefined();
    expect(seen[1].igUserId).toBe('u1');
  });

  it('carries buttons on the comment-addressed opener', async () => {
    const seen: { kind: string; commentId?: string }[] = [];
    const fx: Effects = {
      sendText: async ({ commentId }) => { seen.push({ kind: 'text', commentId }); return { message_id: 'm' }; },
      sendButtons: async ({ commentId }) => { seen.push({ kind: 'buttons', commentId }); return { message_id: 'm' }; },
      recordLink: async () => 'CODE',
      logSend: async () => {},
    };
    const choiceFirst: FlowStep[] = [
      { id: 's1', type: 'send_message', text: 'Want the free thing?', buttons: [{ label: 'Yes', action: { type: 'end' } }] },
    ];
    await advance(ctx({ steps: choiceFirst, igUserId: 'u1', replyToCommentId: 'CMT' }), { type: 'trigger' }, fx);
    expect(seen[0]).toEqual({ kind: 'buttons', commentId: 'CMT' });
  });
});

describe('advance collect_email', () => {
  function capturingButtons() {
    const calls: { text: string; buttons: { title: string; payload?: string }[] }[] = [];
    const fx: Effects = {
      sendText: async () => ({ message_id: 'm' }),
      sendButtons: async ({ text, buttons }) => { calls.push({ text, buttons }); return { message_id: 'm' }; },
      recordLink: async () => 'CODE',
      logSend: async () => {},
    };
    return { calls, fx };
  }

  it('renders the editable disclaimer and button labels and waits for a button', async () => {
    const { calls, fx } = capturingButtons();
    const emailSteps: FlowStep[] = [{
      id: 'e1', type: 'collect_email',
      disclaimer_message: 'Custom disclaimer', accept_label: 'Kabul Et', decline_label: 'Reddet',
    }];

    const result = await advance(ctx({ steps: emailSteps, currentStepId: 'e1', language: 'tr' }), { type: 'trigger' }, fx);

    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('Custom disclaimer');
    expect(calls[0].text).toContain('Gizlilik:');
    expect(calls[0].buttons.map((b) => b.title)).toEqual(['Kabul Et', 'Reddet']);
    expect(calls[0].buttons.map((b) => b.payload)).toEqual(['EMAIL_AGREE_e1', 'EMAIL_DECLINE_e1']);
    expect(result.awaitingInputType).toBe('button');
    expect(result.nextStepId).toBe('e1');
  });

  it('falls back to localized defaults when the fields are absent', async () => {
    const { calls, fx } = capturingButtons();
    const emailSteps: FlowStep[] = [{ id: 'e1', type: 'collect_email' }];

    await advance(ctx({ steps: emailSteps, currentStepId: 'e1', language: 'tr' }), { type: 'trigger' }, fx);

    expect(calls[0].buttons.map((b) => b.title)).toEqual(['Kabul Et', 'Reddet']);
    expect(calls[0].text).toContain('Gizlilik:');
  });
});
