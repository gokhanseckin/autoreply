'use client';
import { useState, useTransition } from 'react';

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
        className={`px-2 py-1 text-xs border rounded ${
          attachedFlows.length > 0 ? 'bg-green-50 border-green-300' : 'bg-gray-50'
        }`}
      >
        {summary}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border rounded shadow-lg z-10 p-2 space-y-1">
          {allFlows.length === 0 && (
            <p className="text-xs text-gray-500 p-2">No flows for this account.</p>
          )}
          {allFlows.map(f => (
            <label key={f.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                onChange={() => toggle(f.id)}
              />
              <span className="truncate">{f.name}</span>
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={() => { setSelected(attached); setOpen(false); }} className="text-xs px-2 py-1">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={isPending} className="text-xs px-2 py-1 bg-black text-white rounded disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
