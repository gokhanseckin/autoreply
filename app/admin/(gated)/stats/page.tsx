import { serviceClient } from '@/lib/db/client';

export default async function StatsPage() {
  const db = serviceClient();
  const { data: flows } = await db.from('flows').select('id,name,language,trigger_type').eq('archived', false);

  const stats = await Promise.all((flows ?? []).map(async (f) => {
    const { data: linkIds } = await db.from('links').select('id').eq('flow_id', f.id);
    const ids = (linkIds ?? []).map(l => l.id);
    let sent = 0, clicked = 0;
    if (ids.length) {
      const { data: codes } = await db.from('link_codes').select('id,first_clicked_at').in('link_id', ids);
      sent = codes?.length ?? 0;
      clicked = codes?.filter(c => c.first_clicked_at).length ?? 0;
    }
    return { ...f, sent, clicked };
  }));

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Stats</h1>
      <table className="w-full border text-sm">
        <thead><tr><th className="text-left p-2">Flow</th><th className="p-2">Recipients w/ link</th><th className="p-2">Unique clicks</th><th className="p-2">CTR</th></tr></thead>
        <tbody>{stats.map(s => (
          <tr key={s.id} className="border-t">
            <td className="p-2">{s.name}</td>
            <td className="p-2 text-center">{s.sent}</td>
            <td className="p-2 text-center">{s.clicked}</td>
            <td className="p-2 text-center">{s.sent ? Math.round((s.clicked / s.sent) * 100) + '%' : '—'}</td>
          </tr>
        ))}</tbody>
      </table>
      <a href="/admin/stats/failures" className="text-sm underline">View failures →</a>
    </section>
  );
}
