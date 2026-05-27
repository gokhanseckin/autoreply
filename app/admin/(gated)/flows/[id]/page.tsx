import { notFound } from 'next/navigation';
import { serviceClient } from '@/lib/db/client';
import { StepsEditor } from './StepsEditor';

export default async function EditFlow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serviceClient();
  const { data: flow } = await db.from('flows').select('*').eq('id', id).maybeSingle();
  if (!flow) notFound();
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">{flow.name}</h1>
      <div className="text-sm text-gray-500">{flow.trigger_type} · {flow.language} · keywords: {flow.trigger_keywords.join(', ')}</div>
      <StepsEditor flowId={flow.id} initialSteps={(flow.steps ?? []) as any[]} />
    </section>
  );
}
