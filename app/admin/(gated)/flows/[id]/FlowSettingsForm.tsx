'use client';

import { useActionState, useRef, useState } from 'react';
import { remainingReplyProbability, type PublicReplyOption } from '@/lib/flow-engine/public-replies';
import { saveFlowSettings } from '../actions';

type FlowSettings = {
  name: string;
  language: string;
  triggerType: string;
  keywords: string;
  publicReplyEnabled: boolean;
  publicReplyOptions: PublicReplyOption[];
};

export function FlowSettingsForm({ flowId, initial }: { flowId: string; initial: FlowSettings }) {
  const [settings, setSettings] = useState(initial);
  const [options, setOptions] = useState(() => initial.publicReplyOptions.map((option, id) => ({
    id,
    text: option.text,
    probability: String(option.probability),
  })));
  const nextOptionId = useRef(options.length);
  const [result, formAction, pending] = useActionState(
    async (_previous: Awaited<ReturnType<typeof saveFlowSettings>> | null, form: FormData) => saveFlowSettings(flowId, form),
    null,
  );
  const remaining = remainingReplyProbability(options.slice(0, -1).map((option) => {
    const value = Number(option.probability);
    return Number.isInteger(value) ? value : 0;
  }));

  function addOption() {
    const id = nextOptionId.current++;
    setOptions([
      ...options.slice(0, -1),
      { ...options[options.length - 1], probability: String(remaining) },
      { id, text: '', probability: '0' },
    ]);
  }

  return (
    <form action={formAction} noValidate className="rounded border p-3">
      <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Name</span>
          <input name="name" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} className="border px-2 py-2" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Footer language</span>
          <select name="language" value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })} className="border px-2 py-2">
            <option value="tr">Turkish - Gizlilik</option>
            <option value="en">English - Privacy</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Trigger</span>
          <select name="trigger_type" value={settings.triggerType} onChange={(e) => setSettings({ ...settings, triggerType: e.target.value })} className="border px-2 py-2">
            <option value="comment">Post comment</option>
            <option value="dm">DM keyword</option>
            <option value="story_reply">Story reply / comment - any story</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Keywords</span>
          <input name="trigger_keywords" value={settings.keywords} onChange={(e) => setSettings({ ...settings, keywords: e.target.value })} className="border px-2 py-2" required />
        </label>

        {settings.triggerType === 'comment' && (
          <div className="grid gap-3 border-t pt-3 md:col-span-2 lg:col-span-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input name="public_reply_enabled" type="checkbox" checked={settings.publicReplyEnabled} onChange={(e) => setSettings({ ...settings, publicReplyEnabled: e.target.checked })} />
              Reply publicly after sending the DM
            </label>
            {options.map((option, index) => {
              const last = index === options.length - 1;
              const current = Number(option.probability);
              const max = remaining + (Number.isInteger(current) ? current : 0);
              return (
                <div key={option.id} className="flex flex-wrap items-end gap-2">
                  <label className="grid min-w-40 flex-1 gap-1 text-sm">
                    <span className="text-xs font-medium text-gray-500">Option {index + 1}</span>
                    <input name="public_reply_text" value={option.text} className="w-full border px-2 py-2" required
                      onChange={(e) => setOptions(options.map((row) => row.id === option.id ? { ...row, text: e.target.value } : row))}
                    />
                  </label>
                  <label className="grid w-28 gap-1 text-sm">
                    <span className="text-xs font-medium text-gray-500">Probability %<span className="sr-only"> for option {index + 1}</span></span>
                    <input type="number" min={0} max={last ? 100 : max} step={1}
                      name={last ? undefined : 'public_reply_probability'}
                      value={last ? remaining : option.probability}
                      readOnly={last} required={!last}
                      className={last ? 'border bg-gray-50 px-2 py-2 text-gray-600' : 'border px-2 py-2'}
                      onChange={(e) => {
                        const value = e.target.value;
                        const number = e.target.valueAsNumber;
                        const probability = Number.isInteger(number) ? String(Math.max(0, Math.min(number, max))) : value;
                        setOptions(options.map((row) => row.id === option.id ? { ...row, probability } : row));
                      }}
                    />
                  </label>
                  {options.length > 1 && (
                    <button type="button" className="rounded border px-3 py-2 text-sm"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => setOptions(options.filter((row) => row.id !== option.id))}
                    >Remove</button>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={addOption} className="w-fit rounded border px-3 py-2 text-sm">Add option</button>
          </div>
        )}

        <div className="space-y-2 md:col-span-2 lg:col-span-4">
          {result?.ok === false && <p role="alert" className="text-sm text-red-700">{result.error}</p>}
          <button className="bg-black px-3 py-2 text-sm text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save settings'}</button>
        </div>
      </fieldset>
    </form>
  );
}
