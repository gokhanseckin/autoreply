'use client';

import { useActionState } from 'react';
import { replaceAccountToken, type ReplaceAccountTokenResult } from './actions';

export function TokenReplacementForm({ accountId }: { accountId: string }) {
  const [result, formAction, pending] = useActionState<ReplaceAccountTokenResult | null, FormData>(
    replaceAccountToken,
    null,
  );

  return (
    <form action={formAction} className="flex max-w-sm flex-col items-end gap-1">
      <input type="hidden" name="account_id" value={accountId} />
      <div className="flex gap-1">
        <input
          type="password"
          name="page_access_token"
          placeholder="New long-lived token"
          autoComplete="off"
          className="min-w-0 border px-2 py-1 text-xs"
          required
        />
        <button className="whitespace-nowrap border px-2 py-1 text-xs disabled:opacity-50" disabled={pending}>
          {pending ? 'Verifying…' : 'Replace token'}
        </button>
      </div>
      {result?.ok === true && <span className="text-right text-xs text-green-700">{result.message}</span>}
      {result?.ok === false && <span className="max-w-sm text-right text-xs text-red-600">{result.error}</span>}
    </form>
  );
}
