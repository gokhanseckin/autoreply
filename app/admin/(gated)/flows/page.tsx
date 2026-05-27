import Link from 'next/link';
import { serviceClient } from '@/lib/db/client';

export default async function FlowsPage() {
  const db = serviceClient();
  const { data: flows } = await db.from('flows').select('id,name,language,trigger_type,archived,ig_account_id').order('updated_at', { ascending: false });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Flows</h1>
        <Link href="/admin/flows/new" className="bg-black text-white px-3 py-2 text-sm">New</Link>
      </div>
      <ul className="divide-y border rounded">
        {flows?.map(f => (
          <li key={f.id} className="p-3 flex justify-between gap-3">
            <Link href={`/admin/flows/${f.id}`} className="flex-1 truncate">{f.name}</Link>
            <span className="text-xs text-gray-500">{f.trigger_type} · {f.language}{f.archived ? ' · archived' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
