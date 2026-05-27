import { serviceClient } from '@/lib/db/client';
import { eraseContact } from './actions';

export default async function ContactsPage() {
  const db = serviceClient();
  const { data: contacts } = await db.from('contacts').select('id,ig_username,ig_user_id,language,last_seen_at').order('last_seen_at', { ascending: false }).limit(200);
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Contacts</h1>
      <ul className="divide-y border rounded">
        {contacts?.map(c => (
          <li key={c.id} className="p-3 flex justify-between gap-3 items-center">
            <span>{c.ig_username ?? c.ig_user_id} <span className="text-xs text-gray-500">{c.language ?? ''}</span></span>
            <form action={eraseContact.bind(null, c.id)}>
              <button className="text-red-600 text-xs underline">Delete data</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
