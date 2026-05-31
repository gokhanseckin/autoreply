import { serviceClient } from '@/lib/db/client';
import { AccountForm } from './account-form';

export default async function AccountsPage() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('*').order('created_at', { ascending: false });
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Instagram Accounts</h1>
      <AccountForm />
      <ul className="divide-y border rounded">
        {accounts?.map(a => (
          <li key={a.id} className="p-3 flex justify-between">
            <span>{a.name} <span className="text-gray-500">({a.ig_business_account_id})</span></span>
            <span className="text-xs text-gray-500">{a.default_language}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
