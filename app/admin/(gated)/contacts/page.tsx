import { serviceClient } from '@/lib/db/client';
import { eraseContact } from './actions';

export default async function ContactsPage() {
  const db = serviceClient();
  const { data: contacts } = await db.from('contacts').select('id,ig_username,ig_user_id,language,last_seen_at').order('last_seen_at', { ascending: false }).limit(200);
  const contactIds = contacts?.map((c) => c.id) ?? [];
  const { data: subscribers } = contactIds.length > 0
    ? await db
      .from('email_subscribers')
      .select('contact_id,email,status,created_at')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
    : { data: [] as { contact_id: string | null; email: string; status: string; created_at: string }[] };

  const latestEmailByContact = new Map<string, { email: string; status: string }>();
  for (const subscriber of subscribers ?? []) {
    if (subscriber.contact_id && !latestEmailByContact.has(subscriber.contact_id)) {
      latestEmailByContact.set(subscriber.contact_id, {
        email: subscriber.email,
        status: subscriber.status,
      });
    }
  }

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Contacts</h1>
      <ul className="divide-y border rounded">
        {contacts?.map(c => {
          const capturedEmail = latestEmailByContact.get(c.id);
          return (
            <li key={c.id} className="p-3 flex justify-between gap-3 items-center">
              <div className="min-w-0">
                <div className="truncate">
                  {c.ig_username ?? c.ig_user_id} <span className="text-xs text-gray-500">{c.language ?? ''}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  {capturedEmail ? (
                    <>
                      <span className="font-medium text-gray-700">{capturedEmail.email}</span>
                      <span>{capturedEmail.status}</span>
                    </>
                  ) : (
                    <span>No email captured</span>
                  )}
                </div>
              </div>
              <form action={eraseContact.bind(null, c.id)}>
                <button className="text-red-600 text-xs underline">Delete data</button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
