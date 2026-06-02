import { FlowStepsSchema, type FlowStep } from '@/lib/flow-engine/schema';

const GUIDED_TYPES = new Set(['send_message', 'send_link', 'collect_email', 'end']);

export type GuidedFlowStep = Extract<FlowStep, { type: 'send_message' | 'send_link' | 'collect_email' | 'end' }>;

function isGuidedStep(step: FlowStep): step is GuidedFlowStep {
  return GUIDED_TYPES.has(step.type);
}

function cloneGuidedStep(step: GuidedFlowStep): GuidedFlowStep {
  return JSON.parse(JSON.stringify(step)) as GuidedFlowStep;
}

function rewriteButtonGateTargets(steps: GuidedFlowStep[], gate: Extract<FlowStep, { type: 'wait_for_button' }>): boolean {
  let used = false;

  for (const step of steps) {
    if (step.type !== 'send_message' || !step.buttons?.length) continue;
    step.buttons = step.buttons.map((button) => {
      if (button.action.type !== 'next') return button;
      const target = gate.on_each[button.action.next_id];
      if (!target) return button;
      used = true;
      return { ...button, action: { type: 'next' as const, next_id: target } };
    });
  }

  return used;
}

export function toGuidedSteps(steps: unknown[]): GuidedFlowStep[] | null {
  const parsed = FlowStepsSchema.safeParse(steps);
  if (!parsed.success) return null;

  const guided: GuidedFlowStep[] = [];
  for (const step of parsed.data) {
    if (isGuidedStep(step)) {
      guided.push(cloneGuidedStep(step));
      continue;
    }

    if (step.type === 'wait_for_button' && rewriteButtonGateTargets(guided, step)) {
      continue;
    }

    return null;
  }

  return guided;
}

export function canUseGuidedBuilder(steps: unknown[]): steps is GuidedFlowStep[] {
  return toGuidedSteps(steps) !== null;
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
