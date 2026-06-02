'use client';

import { useActionState } from 'react';
import { repairWebhookSubscription, type WebhookSubscriptionResult } from './actions';

export function WebhookRepairForm({ accountId }: { accountId: string }) {
  const [result, formAction, pending] = useActionState<WebhookSubscriptionResult | null, FormData>(repairWebhookSubscription, null);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="account_id" value={accountId} />
      <button className="border px-2 py-1 text-xs disabled:opacity-50" disabled={pending}>
        {pending ? 'Reconnecting...' : 'Reconnect webhooks'}
      </button>
      {result?.ok === true && <span className="text-xs text-green-700">{result.message}</span>}
      {result?.ok === false && <span className="max-w-xs text-right text-xs text-red-600">{result.error}</span>}
    </form>
  );
}
