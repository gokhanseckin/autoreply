'use client';
import { useState, useTransition } from 'react';
import { pickerPanelClassName, pickerSummaryButtonClassName } from './post-flow-styles';

type Flow = { id: string; name: string };

export function PostFlowsPicker({
  postId,
  allFlows,
  attached,
  onSave,
}: {
  postId: string;
  allFlows: Flow[];
  attached: string[];
  onSave: (postId: string, flowIds: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(attached);
  const [isPending, startTransition] = useTransition();

  const attachedFlows = allFlows.filter(f => attached.includes(f.id));
  const summary =
    attachedFlows.length === 0
      ? 'Not monitored'
      : attachedFlows.map(f => f.name).join(', ');

  function toggle(id: string) {
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  }

  function save() {
    startTransition(async () => {
      await onSave(postId, selected);
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={pickerSummaryButtonClassName(attachedFlows.length > 0)}
      >
        {summary}
      </button>
      {open && (
        <div className={pickerPanelClassName}>
          {allFlows.length === 0 && (
            <p className="p-2 text-xs text-neutral-500 dark:text-neutral-400">No flows for this account.</p>
          )}
          {allFlows.map(f => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                onChange={() => toggle(f.id)}
                className="accent-neutral-900 dark:accent-neutral-100"
              />
              <span className="truncate">{f.name}</span>
            </label>
          ))}
          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <button type="button" onClick={() => { setSelected(attached); setOpen(false); }} className="rounded px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={isPending} className="rounded bg-neutral-900 px-2 py-1 text-xs text-white disabled:bg-neutral-300 disabled:text-neutral-500 dark:bg-neutral-100 dark:text-neutral-950 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
