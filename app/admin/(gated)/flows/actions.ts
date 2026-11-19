'use server';
import { serviceClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';
import { isAdminRequest, requireAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/auth/require-admin';
import { decryptSecret } from '@/lib/db/encryption';
import { parsePublicReplyForm } from '@/lib/flow-engine/public-replies';
import type { TablesUpdate } from '@/lib/db/types';

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
    if (field === 'accept_label' || field === 'decline_label') return 'Button labels must be 20 characters or fewer.';
    if (field === 'label') return 'Label must be 20 characters or fewer.';
    if (field === 'destination_url' || field === 'url') return 'Destination URL must be a valid link starting with http:// or https://.';
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
  const triggerType = String(form.get('trigger_type'));
  const { data } = await db.from('flows').insert({
    name: String(form.get('name')),
    ig_account_id: String(form.get('ig_account_id')),
    language: String(form.get('language')),
    trigger_type: triggerType,
    trigger_keywords: keywords,
    steps: [],
    public_reply_enabled: triggerType === 'comment',
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

export async function saveFlowSettings(flowId: string, form: FormData): Promise<SaveResult> {
  await requireAdmin();
  const name = String(form.get('name') ?? '').trim();
  const language = String(form.get('language'));
  const triggerType = String(form.get('trigger_type'));
  const triggerKeywords = parseKeywords(form.get('trigger_keywords'));
  if (!name) {
    return { ok: false, error: 'Flow name is required.' };
  }
  if (!LANGUAGES.has(language)) {
    return { ok: false, error: 'Unsupported flow language.' };
  }
  if (!TRIGGER_TYPES.has(triggerType)) {
    return { ok: false, error: 'Unsupported flow trigger type.' };
  }
  if (triggerKeywords.length === 0) {
    return { ok: false, error: 'Add at least one keyword.' };
  }

  let publicReplySettings: Pick<TablesUpdate<'flows'>, 'public_reply_enabled' | 'public_reply_options'> = {};
  if (triggerType === 'comment') {
    const replies = parsePublicReplyForm(form);
    if (!replies.ok) return replies;
    publicReplySettings = {
      public_reply_enabled: form.get('public_reply_enabled') === 'on',
      public_reply_options: replies.options,
    };
  }

  const db = serviceClient();
  const { error } = await db
    .from('flows')
    .update({
      name,
      language,
      trigger_type: triggerType,
      trigger_keywords: triggerKeywords,
      ...publicReplySettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId);
  if (error) return { ok: false, error: `DB error: ${error.message}` };

  if (triggerType !== 'comment') {
    const { error: deleteError } = await db.from('flow_posts').delete().eq('flow_id', flowId);
    if (deleteError) return { ok: false, error: `DB error: ${deleteError.message}` };
  }

  revalidateFlowAdmin(flowId);
  return { ok: true };
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

type ResendEvent = { id: string; name: string };
type ListEventsResult = { ok: true; events: ResendEvent[] } | { ok: false; error: string };

// Populates the admin "Resend automation event" dropdown. Reads the account's
// encrypted Resend key, then calls Resend's List Events API. Returns an empty
// list (not an error) when the account isn't configured for Resend.
export async function listResendEvents(accountId: string): Promise<ListEventsResult> {
  if (!(await isAdminRequest())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const db = serviceClient();
  const { data: account, error } = await db
    .from('ig_accounts')
    .select('email_provider_config')
    .eq('id', accountId)
    .maybeSingle();
  if (error) return { ok: false, error: `DB error: ${error.message}` };

  const cfg = (account as { email_provider_config?: unknown } | null)
    ?.email_provider_config as { kind?: string; api_key_enc?: string } | null;
  if (!cfg || cfg.kind !== 'resend' || typeof cfg.api_key_enc !== 'string') {
    return { ok: true, events: [] };
  }

  try {
    const apiKey = await decryptSecret(new Uint8Array(Buffer.from(cfg.api_key_enc, 'base64')));
    const res = await fetch('https://api.resend.com/events', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    const json = await res.json();
    const events: ResendEvent[] = Array.isArray(json?.data)
      ? json.data.map((e: { id: unknown; name: unknown }) => ({ id: String(e.id), name: String(e.name) }))
      : [];
    return { ok: true, events };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
