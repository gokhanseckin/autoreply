'use server';
import { serviceClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';
import { isAdminRequest, requireAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/auth/require-admin';

const LANGUAGES = new Set(['tr', 'en']);
const TRIGGER_TYPES = new Set(['comment', 'dm', 'story_reply']);

type SaveResult = { ok: true } | { ok: false; error: string };

function parseKeywords(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function revalidateFlowAdmin(flowId?: string) {
  revalidatePath('/admin/flows');
  revalidatePath('/admin/posts');
  revalidatePath('/admin/stats');
  if (flowId) revalidatePath(`/admin/flows/${flowId}`);
}

function formatFlowStepIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  const messages = issues.map((issue) => {
    const field = String(issue.path.at(-1) ?? '');
    if (field === 'label') return 'Label must be 20 characters or fewer.';
    if (field === 'destination_url' || field === 'url') return 'Destination URL must be a valid URL.';
    if (field === 'text') return 'Message text is required.';
    if (field === 'id') return 'Each block needs an internal id.';
    if (field === 'buttons') return 'A message can have at most 3 buttons.';
    if (field === 'next_id') return 'Choose a valid next block or end the flow.';
    return issue.message;
  });
  return Array.from(new Set(messages)).join('\n');
}

export async function createFlow(form: FormData) {
  await requireAdmin();
  const db = serviceClient();
  const keywords = parseKeywords(form.get('trigger_keywords'));
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
): Promise<SaveResult> {
  if (!(await isAdminRequest())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
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
  revalidateFlowAdmin(flowId);
  return { ok: true };
}

export async function saveFlowBuilderSteps(
  flowId: string,
  steps: unknown,
): Promise<SaveResult> {
  if (!(await isAdminRequest())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const result = FlowStepsSchema.safeParse(steps);
  if (!result.success) {
    return { ok: false, error: formatFlowStepIssues(result.error.issues) };
  }
  const db = serviceClient();
  const { error } = await db
    .from('flows')
    .update({ steps: result.data, updated_at: new Date().toISOString() })
    .eq('id', flowId);
  if (error) return { ok: false, error: `DB error: ${error.message}` };
  revalidateFlowAdmin(flowId);
  return { ok: true };
}

export async function saveFlowSettings(flowId: string, form: FormData) {
  await requireAdmin();
  const name = String(form.get('name') ?? '').trim();
  const language = String(form.get('language'));
  const triggerType = String(form.get('trigger_type'));
  const triggerKeywords = parseKeywords(form.get('trigger_keywords'));
  if (!name) {
    throw new Error('Flow name is required');
  }
  if (!LANGUAGES.has(language)) {
    throw new Error('Unsupported flow language');
  }
  if (!TRIGGER_TYPES.has(triggerType)) {
    throw new Error('Unsupported flow trigger type');
  }
  if (triggerKeywords.length === 0) {
    throw new Error('Add at least one keyword');
  }

  const db = serviceClient();
  const { error } = await db
    .from('flows')
    .update({
      name,
      language,
      trigger_type: triggerType,
      trigger_keywords: triggerKeywords,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId);
  if (error) throw error;

  if (triggerType !== 'comment') {
    const { error: deleteError } = await db.from('flow_posts').delete().eq('flow_id', flowId);
    if (deleteError) throw deleteError;
  }

  revalidateFlowAdmin(flowId);
}

export async function setFlowArchived(flowId: string, archived: boolean) {
  await requireAdmin();
  const db = serviceClient();
  const { error } = await db
    .from('flows')
    .update({ archived, updated_at: new Date().toISOString() })
    .eq('id', flowId);
  if (error) throw error;

  revalidateFlowAdmin(flowId);
}
