import { serviceClient } from '@/lib/db/client';
import { addAccount } from './actions';

export default async function AccountsPage() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('*').order('created_at', { ascending: false });
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Instagram Accounts</h1>
      <form action={addAccount} className="space-y-2 max-w-md">
        <input name="name" placeholder="Display name" className="w-full border p-2" required />
        <input name="ig_business_account_id" placeholder="IG Business Account ID" className="w-full border p-2" required />
        <input name="fb_page_id" placeholder="FB Page ID" className="w-full border p-2" required />
        <input name="page_access_token" placeholder="Page Access Token (long-lived)" className="w-full border p-2" required />
        <select name="default_language" className="w-full border p-2"><option value="tr">tr</option><option value="en">en</option></select>
        <button className="bg-black text-white px-3 py-2">Add</button>
      </form>
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
