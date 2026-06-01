import { FlowStepsSchema, type FlowStep } from '@/lib/flow-engine/schema';

const GUIDED_TYPES = new Set(['send_message', 'send_link', 'collect_email', 'end']);

export type GuidedFlowStep = Extract<FlowStep, { type: 'send_message' | 'send_link' | 'collect_email' | 'end' }>;

export function canUseGuidedBuilder(steps: unknown[]): steps is GuidedFlowStep[] {
  const parsed = FlowStepsSchema.safeParse(steps);
  if (!parsed.success) return false;
  return parsed.data.every((step) => GUIDED_TYPES.has(step.type));
}

export function nextStepId(steps: { id: string }[]): string {
  const used = new Set(steps.map((step) => step.id));
  let index = steps.length + 1;
  while (used.has(`s${index}`)) index += 1;
  return `s${index}`;
}

export function createMessageStep(index: number): GuidedFlowStep {
  return {
    id: `s${index}`,
    type: 'send_message',
    text: 'New message',
  };
}

export function createChoiceStep(index: number): GuidedFlowStep {
  return {
    id: `s${index}`,
    type: 'send_message',
    text: 'Choose an option',
    buttons: [
      { label: 'Yes', action: { type: 'end' } },
      { label: 'No', action: { type: 'end' } },
    ],
  };
}

export function createLinkStep(index: number): GuidedFlowStep {
  return {
    id: `s${index}`,
    type: 'send_link',
    text: 'Here is the link',
    label: 'Open',
    destination_url: 'https://example.com',
  };
}

export function createEmailStep(index: number): GuidedFlowStep {
  return {
    id: `s${index}`,
    type: 'collect_email',
  };
}

export function createEndStep(index: number): GuidedFlowStep {
  return {
    id: `s${index}`,
    type: 'end',
  };
}
