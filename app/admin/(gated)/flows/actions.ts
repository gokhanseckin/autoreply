'use server';
import { serviceClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';

export async function createFlow(form: FormData) {
  const db = serviceClient();
  const keywords = String(form.get('trigger_keywords')).split(',').map(s => s.trim()).filter(Boolean);
  const { data } = await db.from('flows').insert({
    name: String(form.get('name')),
    ig_account_id: String(form.get('ig_account_id')),
    language: String(form.get('language')),
    trigger_type: String(form.get('trigger_type')) as any,
    trigger_keywords: keywords,
    steps: [],
  }).select().single();
  redirect(`/admin/flows/${data!.id}`);
}

export async function saveFlowSteps(
  flowId: string,
  stepsJson: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let raw: unknown;
  try {
    raw = JSON.parse(stepsJson);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const result = FlowStepsSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    return { ok: false, error: `Schema validation failed:\n${issues}` };
  }
  const db = serviceClient();
  const { error } = await db
    .from('flows')
    .update({ steps: result.data, updated_at: new Date().toISOString() })
    .eq('id', flowId);
  if (error) return { ok: false, error: `DB error: ${error.message}` };
  return { ok: true };
}
