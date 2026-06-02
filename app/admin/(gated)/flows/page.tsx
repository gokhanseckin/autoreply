import Link from 'next/link';
import { serviceClient } from '@/lib/db/client';
import { setFlowArchived } from './actions';
import { languageLabel, triggerLabel } from './flow-labels';

export default async function FlowsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const archived = sp.status === 'archived';
  const db = serviceClient();
  const { data: flows } = await db
    .from('flows')
    .select('id,name,language,trigger_type,archived,ig_accounts(name,ig_business_account_id)')
    .eq('archived', archived)
    .order('updated_at', { ascending: false });

  const activeTab = archived ? 'archived' : 'active';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Flows</h1>
        <Link href="/admin/flows/new" className="bg-black px-3 py-2 text-sm text-white">New</Link>
      </div>

      <div className="inline-flex rounded border bg-white text-sm">
        <Link href="/admin/flows" className={`px-3 py-2 ${activeTab === 'active' ? 'bg-black text-white' : 'text-gray-700'}`}>Active</Link>
        <Link href="/admin/flows?status=archived" className={`border-l px-3 py-2 ${activeTab === 'archived' ? 'bg-black text-white' : 'text-gray-700'}`}>Archived</Link>
      </div>

      <ul className="divide-y rounded border">
        {flows?.map((f: any) => (
          <li key={f.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <Link href={`/admin/flows/${f.id}`} className="block truncate font-medium">
                {f.name}
              </Link>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                {f.ig_accounts?.name && <span>@{f.ig_accounts.name}</span>}
                <span>{triggerLabel(f.trigger_type)}</span>
                <span>{languageLabel(f.language)}</span>
                {f.archived && <span>archived</span>}
              </div>
            </div>
            <form action={setFlowArchived.bind(null, f.id, !f.archived)}>
              <button className="rounded border px-3 py-2 text-xs">
                {f.archived ? 'Unarchive' : 'Archive'}
              </button>
            </form>
          </li>
        ))}
        {flows?.length === 0 && (
          <li className="p-6 text-sm text-gray-500">{archived ? 'No archived flows.' : 'No active flows.'}</li>
        )}
      </ul>
    </section>
  );
}
