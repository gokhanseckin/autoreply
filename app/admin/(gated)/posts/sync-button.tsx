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
        className="rounded border border-neutral-300 bg-transparent px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50 disabled:text-neutral-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:disabled:text-neutral-500"
      >
        Sync from Meta
      </button>
      {isPending && <span className="text-sm text-neutral-500 dark:text-neutral-400">Syncing…</span>}
      {!isPending && result?.ok === true && <span className="text-sm text-emerald-700 dark:text-emerald-300">Synced {result.count} post{result.count === 1 ? '' : 's'}.</span>}
      {!isPending && result?.ok === false && <span className="text-sm text-red-700 dark:text-red-300">{result.error}</span>}
    </div>
  );
}
