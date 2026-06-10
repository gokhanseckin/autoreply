'use client';

import { useEffect, useState } from 'react';
import { saveFlowBuilderSteps, saveFlowSteps, listResendEvents } from '../actions';
import type { FlowStep } from '@/lib/flow-engine/schema';
import {
  createChoiceStep,
  createEmailStep,
  createEndStep,
  createLinkStep,
  createMessageStep,
  createPlainMessageStep,
  nextStepId,
  toGuidedSteps,
  type GuidedFlowStep,
} from './flow-builder-model';
import { collectEmailDefaults } from '@/lib/consent/collect-email-step-text';

type Mode = 'guided' | 'advanced';
type MessageStep = Extract<FlowStep, { type: 'send_message' }>;
type LinkStep = Extract<FlowStep, { type: 'send_link' }>;
type EmailStep = Extract<FlowStep, { type: 'collect_email' }>;
type Button = NonNullable<MessageStep['buttons']>[number];

function stepTitle(step: GuidedFlowStep) {
  if (step.type === 'send_message' && step.plain) return 'Plain message';
  if (step.type === 'send_message' && step.buttons?.length) return 'Choice message';
  if (step.type === 'send_message') return 'Message';
  if (step.type === 'send_link') return 'Tracked link';
  if (step.type === 'collect_email') return 'Collect email';
  return 'End';
}

function stepBadge(step: GuidedFlowStep) {
  if (step.type === 'send_message' && step.plain) return 'plain';
  if (step.type === 'send_message' && step.buttons?.length) return 'choice';
  if (step.type === 'send_message') return 'message';
  if (step.type === 'send_link') return 'link';
  if (step.type === 'collect_email') return 'email';
  return 'end';
}

function targetOptions(steps: GuidedFlowStep[], currentId: string) {
  return steps.filter((step) => step.id !== currentId);
}

function defaultNextTarget(steps: GuidedFlowStep[], currentId: string) {
  return targetOptions(steps, currentId)[0]?.id;
}

export function StepsEditor({
  flowId,
  initialSteps,
  language,
  accountId,
  providerKind,
}: {
  flowId: string;
  initialSteps: unknown[];
  language: 'tr' | 'en';
  accountId: string;
  providerKind: string;
}) {
  const normalizedInitialSteps = toGuidedSteps(initialSteps);
  const initialGuided = normalizedInitialSteps !== null;
  const [mode, setMode] = useState<Mode>(initialGuided ? 'guided' : 'advanced');
  const [steps, setSteps] = useState<GuidedFlowStep[]>(normalizedInitialSteps ?? []);
  const [json, setJson] = useState(JSON.stringify(initialSteps, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  function patchStep(index: number, patch: Partial<GuidedFlowStep>) {
    setSteps((current) => current.map((step, i) => (i === index ? ({ ...step, ...patch } as GuidedFlowStep) : step)));
  }

  function addStep(kind: 'message' | 'plain' | 'choice' | 'link' | 'email' | 'end') {
    setSteps((current) => {
      const id = nextStepId(current);
      const index = Number(id.slice(1));
      const step =
        kind === 'message'
          ? createMessageStep(index)
          : kind === 'plain'
            ? createPlainMessageStep(index)
            : kind === 'choice'
              ? createChoiceStep(index)
              : kind === 'link'
                ? createLinkStep(index)
                : kind === 'email'
                  ? createEmailStep(index, language)
                  : createEndStep(index);
      return [...current, { ...step, id }];
    });
    setOk(false);
    setErr(null);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeStep(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index));
  }

  function updateButton(stepIndex: number, buttonIndex: number, button: Button) {
    const step = steps[stepIndex];
    if (step?.type !== 'send_message') return;
    const buttons = [...(step.buttons ?? [])];
    buttons[buttonIndex] = button;
    patchStep(stepIndex, { buttons });
  }

  function addButton(stepIndex: number) {
    const step = steps[stepIndex];
    if (step?.type !== 'send_message') return;
    const buttons = [...(step.buttons ?? [])];
    if (buttons.length >= 3) return;
    buttons.push({ label: 'Option', action: { type: 'end' } });
    patchStep(stepIndex, { buttons, next_id: undefined });
  }

  function removeButton(stepIndex: number, buttonIndex: number) {
    const step = steps[stepIndex];
    if (step?.type !== 'send_message') return;
    const buttons = (step.buttons ?? []).filter((_, i) => i !== buttonIndex);
    patchStep(stepIndex, { buttons: buttons.length ? buttons : undefined });
  }

  function setNext(stepIndex: number, nextId: string) {
    patchStep(stepIndex, { next_id: nextId || undefined });
  }

  function showAdvanced() {
    setJson(JSON.stringify(steps, null, 2));
    setMode('advanced');
    setOk(false);
    setErr(null);
  }

  function showGuided() {
    try {
      const parsed = JSON.parse(json);
      const normalized = Array.isArray(parsed) ? toGuidedSteps(parsed) : null;
      if (!normalized) {
        setErr('This flow uses advanced blocks. Keep editing it in JSON.');
        return;
      }
      setSteps(normalized);
      setMode('guided');
      setErr(null);
      setOk(false);
    } catch (e) {
      setErr(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  async function saveGuided() {
    setErr(null);
    setOk(false);
    setSaving(true);
    try {
      const result = await saveFlowBuilderSteps(flowId, steps);
      if (result.ok) {
        setOk(true);
        setJson(JSON.stringify(steps, null, 2));
      } else {
        setErr(result.error);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  async function saveAdvanced() {
    setErr(null);
    setOk(false);
    setSaving(true);
    try {
      const result = await saveFlowSteps(flowId, json);
      if (result.ok) {
        setOk(true);
        const parsed = JSON.parse(json);
        const normalized = Array.isArray(parsed) ? toGuidedSteps(parsed) : null;
        if (normalized) setSteps(normalized);
      } else {
        setErr(result.error);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Flow messages</h2>
        <div className="inline-flex rounded border bg-white text-sm">
          <button
            type="button"
            onClick={showGuided}
            className={`px-3 py-2 ${mode === 'guided' ? 'bg-black text-white' : 'text-gray-700'}`}
          >
            Guided
          </button>
          <button
            type="button"
            onClick={showAdvanced}
            className={`border-l px-3 py-2 ${mode === 'advanced' ? 'bg-black text-white' : 'text-gray-700'}`}
          >
            Advanced JSON
          </button>
        </div>
      </div>

      {mode === 'guided' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addStep('message')} className="rounded border px-3 py-2 text-sm">Add message</button>
            <button type="button" onClick={() => addStep('plain')} className="rounded border px-3 py-2 text-sm">Add plain message</button>
            <button type="button" onClick={() => addStep('choice')} className="rounded border px-3 py-2 text-sm">Add choice</button>
            <button type="button" onClick={() => addStep('link')} className="rounded border px-3 py-2 text-sm">Add link</button>
            <button type="button" onClick={() => addStep('email')} className="rounded border px-3 py-2 text-sm">Collect email</button>
            <button type="button" onClick={() => addStep('end')} className="rounded border px-3 py-2 text-sm">Add end</button>
          </div>

          {steps.length === 0 ? (
            <div className="rounded border border-dashed p-6 text-sm text-gray-500">No blocks yet.</div>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={step.id} className="rounded border bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{stepBadge(step)}</span>
                    <h3 className="font-medium">{stepTitle(step)}</h3>
                    <span className="text-xs text-gray-400">{step.id}</span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Up</button>
                      <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Down</button>
                      <button type="button" onClick={() => removeStep(index)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Delete</button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {step.type === 'send_message' && (
                      <MessageFields
                        step={step}
                        steps={steps}
                        index={index}
                        patchStep={patchStep}
                        setNext={setNext}
                        addButton={addButton}
                        updateButton={updateButton}
                        removeButton={removeButton}
                      />
                    )}
                    {step.type === 'send_link' && (
                      <LinkFields step={step} steps={steps} index={index} patchStep={patchStep} setNext={setNext} />
                    )}
                    {step.type === 'collect_email' && (
                      <EmailFields
                        step={step}
                        steps={steps}
                        index={index}
                        patchStep={patchStep}
                        setNext={setNext}
                        language={language}
                        accountId={accountId}
                        providerKind={providerKind}
                      />
                    )}
                    {step.type === 'end' && (
                      <p className="text-sm text-gray-500">Conversation ends here.</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={saveGuided} disabled={saving} className="bg-black px-3 py-2 text-sm text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save flow'}
            </button>
            {ok && <span className="text-sm text-green-700">Saved</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {!initialGuided && (
            <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              Advanced blocks detected.
            </p>
          )}
          <textarea className="h-96 w-full border p-2 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={saveAdvanced} disabled={saving} className="bg-black px-3 py-2 text-sm text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save JSON'}
            </button>
            {ok && <span className="text-sm text-green-700">Saved</span>}
          </div>
        </div>
      )}

      {err && <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">{err}</pre>}
    </div>
  );
}

function NextSelector({
  step,
  steps,
  index,
  setNext,
}: {
  step: MessageStep | LinkStep | EmailStep;
  steps: GuidedFlowStep[];
  index: number;
  setNext: (index: number, nextId: string) => void;
}) {
  const options = targetOptions(steps, step.id);
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-medium text-gray-500">After this</span>
      <select value={step.next_id ?? ''} onChange={(e) => setNext(index, e.target.value)} className="border px-2 py-2">
        <option value="">End flow</option>
        {options.map((target) => (
          <option key={target.id} value={target.id}>{target.id} - {stepTitle(target)}</option>
        ))}
      </select>
    </label>
  );
}

function MessageFields({
  step,
  steps,
  index,
  patchStep,
  setNext,
  addButton,
  updateButton,
  removeButton,
}: {
  step: MessageStep;
  steps: GuidedFlowStep[];
  index: number;
  patchStep: (index: number, patch: Partial<GuidedFlowStep>) => void;
  setNext: (index: number, nextId: string) => void;
  addButton: (index: number) => void;
  updateButton: (stepIndex: number, buttonIndex: number, button: Button) => void;
  removeButton: (stepIndex: number, buttonIndex: number) => void;
}) {
  const plain = !!step.plain;
  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Message</span>
        <textarea value={step.text} onChange={(e) => patchStep(index, { text: e.target.value })} className="min-h-24 border p-2" />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={plain}
          onChange={(e) => patchStep(index, e.target.checked ? { plain: true, buttons: undefined } : { plain: undefined })}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Plain message</span>
          <span className="block text-xs text-gray-500">Sends a natural text DM — no privacy footer, no buttons, links stay tappable.</span>
        </span>
      </label>

      {!plain && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-500">Buttons</span>
            <button type="button" onClick={() => addButton(index)} disabled={(step.buttons?.length ?? 0) >= 3} className="rounded border px-2 py-1 text-xs disabled:opacity-40">
              Add button
            </button>
          </div>
          <p className="text-xs text-gray-400">Buttons render as tappable Instagram buttons with a contrasting background. Add one with an &ldquo;Open URL&rdquo; action to send a noticeable call-to-action link.</p>
          {(step.buttons ?? []).map((button, buttonIndex) => (
            <ButtonFields
              key={buttonIndex}
              button={button}
              step={step}
              steps={steps}
              onChange={(nextButton) => updateButton(index, buttonIndex, nextButton)}
              onRemove={() => removeButton(index, buttonIndex)}
            />
          ))}
        </div>
      )}

      {(plain || !step.buttons?.length) && <NextSelector step={step} steps={steps} index={index} setNext={setNext} />}
    </>
  );
}

function ButtonFields({
  button,
  step,
  steps,
  onChange,
  onRemove,
}: {
  button: Button;
  step: MessageStep;
  steps: GuidedFlowStep[];
  onChange: (button: Button) => void;
  onRemove: () => void;
}) {
  const targets = targetOptions(steps, step.id);

  function setActionType(type: Button['action']['type']) {
    if (type === 'end') onChange({ ...button, action: { type: 'end' } });
    if (type === 'url') onChange({ ...button, action: { type: 'url', url: 'https://example.com' } });
    if (type === 'next') {
      const nextId = defaultNextTarget(steps, step.id);
      if (nextId) onChange({ ...button, action: { type: 'next', next_id: nextId } });
    }
  }

  return (
    <div className="grid gap-2 rounded border bg-gray-50 p-2 md:grid-cols-[1fr_160px_1fr_auto]">
      <input
        value={button.label}
        onChange={(e) => onChange({ ...button, label: e.target.value })}
        className="border bg-white px-2 py-2 text-sm"
        placeholder="Button label"
      />
      <select value={button.action.type} onChange={(e) => setActionType(e.target.value as Button['action']['type'])} className="border bg-white px-2 py-2 text-sm">
        <option value="end">End flow</option>
        <option value="url">Open URL</option>
        <option value="next" disabled={targets.length === 0}>Go to block</option>
      </select>
      {button.action.type === 'url' ? (
        <input
          value={button.action.url}
          onChange={(e) => onChange({ ...button, action: { type: 'url', url: e.target.value } })}
          className="border bg-white px-2 py-2 text-sm"
          placeholder="https://example.com"
        />
      ) : button.action.type === 'next' ? (
        <select
          value={button.action.next_id}
          onChange={(e) => onChange({ ...button, action: { type: 'next', next_id: e.target.value } })}
          className="border bg-white px-2 py-2 text-sm"
        >
          {targets.map((target) => (
            <option key={target.id} value={target.id}>{target.id} - {stepTitle(target)}</option>
          ))}
        </select>
      ) : (
        <div className="hidden md:block" />
      )}
      <button type="button" onClick={onRemove} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Remove</button>
    </div>
  );
}

function LinkFields({
  step,
  steps,
  index,
  patchStep,
  setNext,
}: {
  step: LinkStep;
  steps: GuidedFlowStep[];
  index: number;
  patchStep: (index: number, patch: Partial<GuidedFlowStep>) => void;
  setNext: (index: number, nextId: string) => void;
}) {
  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Message</span>
        <textarea value={step.text} onChange={(e) => patchStep(index, { text: e.target.value })} className="min-h-24 border p-2" />
      </label>
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Button label</span>
          <input value={step.label} onChange={(e) => patchStep(index, { label: e.target.value })} className="border px-2 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Destination URL</span>
          <input value={step.destination_url} onChange={(e) => patchStep(index, { destination_url: e.target.value })} className="border px-2 py-2" />
        </label>
      </div>
      <NextSelector step={step} steps={steps} index={index} setNext={setNext} />
    </>
  );
}

function EmailFields({
  step,
  steps,
  index,
  patchStep,
  setNext,
  language,
  accountId,
  providerKind,
}: {
  step: EmailStep;
  steps: GuidedFlowStep[];
  index: number;
  patchStep: (index: number, patch: Partial<GuidedFlowStep>) => void;
  setNext: (index: number, nextId: string) => void;
  language: 'tr' | 'en';
  accountId: string;
  providerKind: string;
}) {
  const d = collectEmailDefaults(language);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (providerKind !== 'resend') return;
    let active = true;
    setLoadingEvents(true);
    setEventsError(null);
    listResendEvents(accountId)
      .then((r) => {
        if (!active) return;
        if (r.ok) setEvents(r.events);
        else setEventsError(r.error);
      })
      .catch((e) => { if (active) setEventsError((e as Error).message); })
      .finally(() => { if (active) setLoadingEvents(false); });
    return () => { active = false; };
  }, [accountId, providerKind]);

  const selectedKnown = !step.resend_event || events.some((e) => e.name === step.resend_event);

  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Disclaimer / consent message</span>
        <textarea
          value={step.disclaimer_message ?? ''}
          onChange={(e) => patchStep(index, { disclaimer_message: e.target.value })}
          placeholder={d.disclaimer}
          className="min-h-24 border p-2"
        />
        <span className="text-xs text-gray-400">The privacy/KVKK footer is always appended below this automatically.</span>
        <span className="text-xs text-gray-400">Leave a field blank to send the localized default (shown as placeholder).</span>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Accept button</span>
          <input
            value={step.accept_label ?? ''}
            onChange={(e) => patchStep(index, { accept_label: e.target.value })}
            placeholder={d.accept}
            maxLength={20}
            className="border px-2 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Decline button</span>
          <input
            value={step.decline_label ?? ''}
            onChange={(e) => patchStep(index, { decline_label: e.target.value })}
            placeholder={d.decline}
            maxLength={20}
            className="border px-2 py-2"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Email request message (sent after Accept)</span>
        <input
          value={step.request_message ?? ''}
          onChange={(e) => patchStep(index, { request_message: e.target.value })}
          placeholder={d.request}
          className="border px-2 py-2"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Decline message (sent before the flow ends)</span>
        <input
          value={step.decline_message ?? ''}
          onChange={(e) => patchStep(index, { decline_message: e.target.value })}
          placeholder={d.declineGoodbye}
          className="border px-2 py-2"
        />
      </label>

      {providerKind === 'resend' && (
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Resend automation event</span>
          <select
            value={step.resend_event ?? ''}
            onChange={(e) => patchStep(index, { resend_event: e.target.value || undefined })}
            className="border px-2 py-2"
          >
            <option value="">No automation</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.name}>{ev.name}</option>
            ))}
            {!selectedKnown && step.resend_event && (
              <option value={step.resend_event}>{step.resend_event}</option>
            )}
          </select>
          {loadingEvents && <span className="text-xs text-gray-400">Loading events…</span>}
          {eventsError && <span className="text-xs text-red-600">Could not load events: {eventsError}</span>}
          {!loadingEvents && !eventsError && events.length === 0 && (
            <span className="text-xs text-gray-400">No events found in Resend — create one in the Resend dashboard first.</span>
          )}
        </label>
      )}

      <NextSelector step={step} steps={steps} index={index} setNext={setNext} />
    </>
  );
}
