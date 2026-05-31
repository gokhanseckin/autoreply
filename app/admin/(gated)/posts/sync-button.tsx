'use client';
import { useState, useTransition } from 'react';

export function SyncButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  const [justDone, setJustDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await action();
            setJustDone(true);
            setTimeout(() => setJustDone(false), 2000);
          })
        }
        className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Sync from Meta
      </button>
      {isPending && <span className="text-sm text-gray-500">Syncing…</span>}
      {!isPending && justDone && <span className="text-sm text-green-600">Synced!</span>}
    </div>
  );
}
