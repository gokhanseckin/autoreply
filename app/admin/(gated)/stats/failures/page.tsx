import { serviceClient } from '@/lib/db/client';

export default async function FailuresPage() {
  const db = serviceClient();
  const { data: rows } = await db.from('messages_log').select('id,ig_account_id,contact_id,message_type,error,sent_at').not('error', 'is', null).order('sent_at', { ascending: false }).limit(100);
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Failures (last 100)</h1>
      <ul className="divide-y border rounded text-xs font-mono">
        {rows?.map(r => (
          <li key={r.id} className="p-3">
            <div>{new Date(r.sent_at).toISOString()} — {r.message_type}</div>
            <pre className="overflow-auto bg-gray-50 p-2 mt-1">{JSON.stringify(r.error, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
