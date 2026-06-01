import { notFound } from 'next/navigation';
import { serviceClient } from '@/lib/db/client';
import { StepsEditor } from './StepsEditor';
import { saveFlowSettings } from '../actions';

export default async function EditFlow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serviceClient();
  const { data: flow } = await db.from('flows').select('*').eq('id', id).maybeSingle();
  if (!flow) notFound();
  const saveSettings = saveFlowSettings.bind(null, flow.id);
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">{flow.name}</h1>
      <div className="text-sm text-gray-500">{flow.trigger_type} · {flow.language} · keywords: {flow.trigger_keywords.join(', ')}</div>
      <form action={saveSettings} className="flex flex-wrap items-end gap-2 rounded border p-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Footer language</span>
          <select name="language" defaultValue={flow.language} className="border px-2 py-2">
            <option value="tr">Turkish - Gizlilik</option>
            <option value="en">English - Privacy</option>
          </select>
        </label>
        <button className="bg-black text-white px-3 py-2 text-sm">Save settings</button>
      </form>
      <StepsEditor flowId={flow.id} initialSteps={(flow.steps ?? []) as any[]} />
    </section>
  );
}
