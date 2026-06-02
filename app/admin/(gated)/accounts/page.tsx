import { serviceClient } from '@/lib/db/client';
import { AccountForm } from './account-form';
import { WebhookRepairForm } from './webhook-repair-form';

export default async function AccountsPage() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('*').order('created_at', { ascending: false });
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Instagram Accounts</h1>
      <AccountForm />
      <ul className="divide-y border rounded">
        {accounts?.map(a => (
          <li key={a.id} className="flex justify-between gap-4 p-3">
            <span>{a.name} <span className="text-gray-500">({a.ig_business_account_id})</span></span>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs text-gray-500">{a.default_language}</span>
              <WebhookRepairForm accountId={a.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
