import { serviceClient } from '@/lib/db/client';
import { syncPosts, toggleMonitor } from './actions';
import { AccountSwitcher } from './account-switcher';
import { SyncButton } from './sync-button';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const sp = await searchParams;
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name').order('created_at', { ascending: false });
  const accountId = sp.account ?? accounts?.[0]?.id;
  const { data: posts } = accountId
    ? await db.from('posts').select('*').eq('ig_account_id', accountId).order('posted_at', { ascending: false, nullsFirst: false })
    : { data: [] };
  const { data: campaigns } = accountId
    ? await db
        .from('flows')
        .select('id,name,post_id,trigger_keywords,posts(caption_excerpt,permalink)')
        .eq('ig_account_id', accountId)
        .eq('archived', false)
        .order('updated_at', { ascending: false })
    : { data: [] };
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <AccountSwitcher accounts={accounts ?? []} current={accountId} />
        {accountId && <SyncButton action={syncPosts.bind(null, accountId)} />}
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">Live Campaigns</h2>
        {campaigns && campaigns.length > 0 ? (
          <ul className="divide-y border rounded">
            {campaigns.map(c => {
              const post = Array.isArray(c.posts) ? c.posts[0] : c.posts;
              return (
                <li key={c.id} className="p-3 flex justify-between gap-3">
                  <div className="flex-1 truncate">
                    <a href={`/admin/flows/${c.id}`} className="font-medium underline">{c.name}</a>
                    {post?.caption_excerpt && <span className="ml-2 text-xs text-gray-500 truncate">{post.caption_excerpt}</span>}
                  </div>
                  <span className="text-xs text-gray-500">{c.trigger_keywords?.join(', ')}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No live campaigns.</p>
        )}
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">All Posts</h2>
        <ul className="divide-y border rounded">
          {posts?.map(p => (
            <li key={p.id} className="p-3 flex justify-between items-center gap-3">
              <a className="flex-1 truncate" href={p.permalink ?? '#'} target="_blank" rel="noreferrer">{p.caption_excerpt ?? p.ig_media_id}</a>
              <span className="text-xs text-gray-500 tabular-nums">{p.posted_at ? fmtDate(p.posted_at) : '—'}</span>
              <form action={toggleMonitor.bind(null, p.id, !p.monitored)}>
                <button className={`px-2 py-1 text-xs ${p.monitored ? 'bg-green-100' : 'bg-gray-100'}`}>{p.monitored ? 'monitored' : 'off'}</button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
