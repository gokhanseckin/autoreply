'use client';
import { useActionState } from 'react';
import { addAccount, type AddAccountResult } from './actions';

export function AccountForm() {
  const [result, formAction, pending] = useActionState<AddAccountResult | null, FormData>(addAccount, null);
  return (
    <form action={formAction} className="space-y-2 max-w-md">
      <input name="name" placeholder="Display name" className="w-full border p-2" required />
      <input name="fb_page_id" placeholder="FB Page ID (optional)" className="w-full border p-2" />
      <input name="page_access_token" placeholder="Page Access Token (long-lived)" className="w-full border p-2" required />
      <select name="default_language" className="w-full border p-2"><option value="tr">tr</option><option value="en">en</option></select>
      <button className="bg-black text-white px-3 py-2 disabled:opacity-50" disabled={pending}>
        {pending ? 'Verifying…' : 'Add'}
      </button>
      {result?.ok === false && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.ok === true && (
        <p className="text-sm text-green-700">
          Added. Resolved IG account id <code>{result.igBusinessAccountId}</code>
          {result.username ? ` (@${result.username})` : ''}. Confirm this matches the <code>entry.id</code> in webhook logs.
        </p>
      )}
    </form>
  );
}
