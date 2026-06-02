import { notFound } from 'next/navigation';
import { serviceClient } from '@/lib/db/client';
import { StepsEditor } from './StepsEditor';
import { saveFlowSettings, setFlowArchived } from '../actions';

export default async function EditFlow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serviceClient();
  const { data: flow } = await db.from('flows').select('*').eq('id', id).maybeSingle();
  if (!flow) notFound();
  const saveSettings = saveFlowSettings.bind(null, flow.id);
  const toggleArchived = setFlowArchived.bind(null, flow.id, !flow.archived);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{flow.name}</h1>
            {flow.archived && <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">archived</span>}
          </div>
          <div className="mt-1 text-sm text-gray-500">{flow.trigger_type} · {flow.language} · keywords: {flow.trigger_keywords.join(', ')}</div>
        </div>
        <form action={toggleArchived}>
          <button className="rounded border px-3 py-2 text-sm">
            {flow.archived ? 'Unarchive' : 'Archive'}
          </button>
        </form>
      </div>

      <form action={saveSettings} className="grid gap-3 rounded border p-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Name</span>
          <input name="name" defaultValue={flow.name} className="border px-2 py-2" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Footer language</span>
          <select name="language" defaultValue={flow.language} className="border px-2 py-2">
            <option value="tr">Turkish - Gizlilik</option>
            <option value="en">English - Privacy</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Trigger</span>
          <select name="trigger_type" defaultValue={flow.trigger_type} className="border px-2 py-2">
            <option value="comment">Post comment</option>
            <option value="dm">DM keyword</option>
            <option value="story_reply">Story reply - any story</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Keywords</span>
          <input name="trigger_keywords" defaultValue={flow.trigger_keywords.join(', ')} className="border px-2 py-2" required />
        </label>
        <div className="md:col-span-2 lg:col-span-4">
          <button className="bg-black px-3 py-2 text-sm text-white">Save settings</button>
        </div>
      </form>
      <StepsEditor flowId={flow.id} initialSteps={(flow.steps ?? []) as any[]} />
    </section>
  );
}
