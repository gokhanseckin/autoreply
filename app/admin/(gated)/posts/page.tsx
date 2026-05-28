import { serviceClient } from '@/lib/db/client';
import { syncPosts, toggleMonitor } from './actions';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const sp = await searchParams;
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name').order('created_at', { ascending: false });
  const accountId = sp.account ?? accounts?.[0]?.id;
  const { data: posts } = accountId
    ? await db.from('posts').select('*').eq('ig_account_id', accountId).order('created_at', { ascending: false })
    : { data: [] };
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <form>
          <select defaultValue={accountId} className="border p-2" name="account">
            {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="submit" className="ml-2 text-sm underline">Switch</button>
        </form>
        {accountId && (
          <form action={syncPosts.bind(null, accountId)}>
            <button className="border px-3 py-2 text-sm">Sync from Meta</button>
          </form>
        )}
      </div>
      <ul className="divide-y border rounded">
        {posts?.map(p => (
          <li key={p.id} className="p-3 flex justify-between gap-3">
            <a className="flex-1 truncate" href={p.permalink ?? '#'} target="_blank" rel="noreferrer">{p.caption_excerpt ?? p.ig_media_id}</a>
            <form action={toggleMonitor.bind(null, p.id, !p.monitored)}>
              <button className={`px-2 py-1 text-xs ${p.monitored ? 'bg-green-100' : 'bg-gray-100'}`}>{p.monitored ? 'monitored' : 'off'}</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
