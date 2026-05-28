import { serviceClient } from '@/lib/db/client';
import { setPostFlows, syncPosts } from './actions';
import { AccountSwitcher } from './account-switcher';
import { SyncButton } from './sync-button';
import { PostFlowsPicker } from './post-flows-picker';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const sp = await searchParams;
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name').order('created_at', { ascending: false });
  const accountId = sp.account ?? accounts?.[0]?.id;
  const { data: posts } = accountId
    ? await db
        .from('posts')
        .select('id,caption_excerpt,permalink,ig_media_id,posted_at,flow_posts(flow_id)')
        .eq('ig_account_id', accountId)
        .order('posted_at', { ascending: false, nullsFirst: false })
    : { data: [] };
  const { data: flows } = accountId
    ? await db
        .from('flows')
        .select('id,name,trigger_type,trigger_keywords,archived,flow_posts(post_id)')
        .eq('ig_account_id', accountId)
        .eq('archived', false)
        .order('updated_at', { ascending: false })
    : { data: [] };

  const flowsForPicker = (flows ?? []).map(f => ({ id: f.id, name: f.name }));
  const campaigns = (flows ?? []).filter(f => Array.isArray(f.flow_posts) && f.flow_posts.length > 0);

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
        {campaigns.length > 0 ? (
          <ul className="divide-y border rounded">
            {campaigns.map(c => (
              <li key={c.id} className="p-3 flex justify-between gap-3">
                <a href={`/admin/flows/${c.id}`} className="font-medium underline truncate">{c.name}</a>
                <span className="text-xs text-gray-500">
                  {c.flow_posts!.length} post{c.flow_posts!.length === 1 ? '' : 's'} · {c.trigger_keywords?.join(', ')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No live campaigns. Attach a post to a flow below.</p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">All Posts</h2>
        <ul className="divide-y border rounded">
          {posts?.map(p => {
            const attached = (p.flow_posts ?? []).map((fp: any) => fp.flow_id);
            return (
              <li key={p.id} className="p-3 flex justify-between items-center gap-3">
                <a className="flex-1 truncate" href={p.permalink ?? '#'} target="_blank" rel="noreferrer">
                  {p.caption_excerpt ?? p.ig_media_id}
                </a>
                <span className="text-xs text-gray-500 tabular-nums">{p.posted_at ? fmtDate(p.posted_at) : '—'}</span>
                <PostFlowsPicker
                  postId={p.id}
                  allFlows={flowsForPicker}
                  attached={attached}
                  onSave={setPostFlows}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
