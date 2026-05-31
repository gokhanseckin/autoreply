'use client';
import { useState, useTransition } from 'react';
import type { SyncResult } from './actions';

export function SyncButton({ action }: { action: () => Promise<SyncResult> }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await action());
          })
        }
        className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Sync from Meta
      </button>
      {isPending && <span className="text-sm text-gray-500">Syncing…</span>}
      {!isPending && result?.ok === true && <span className="text-sm text-green-600">Synced {result.count} post{result.count === 1 ? '' : 's'}.</span>}
      {!isPending && result?.ok === false && <span className="text-sm text-red-600">{result.error}</span>}
    </div>
  );
}
