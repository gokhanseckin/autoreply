import { notFound } from 'next/navigation';
import { serviceClient } from '@/lib/db/client';
import { StepsEditor } from './StepsEditor';
import { setFlowArchived } from '../actions';
import { languageLabel, triggerLabel } from '../flow-labels';
import { readPublicReplyOptions } from '@/lib/flow-engine/public-replies';
import { FlowSettingsForm } from './FlowSettingsForm';

function accountName(value: unknown): string | null {
  // Supabase returns the embedded `ig_accounts` relation as an object for a
  // to-one FK, but tolerate an array shape too so a typings change can't crash.
  const rel = Array.isArray(value) ? value[0] : value;
  if (rel && typeof rel === 'object' && 'name' in rel) {
    const name = (rel as { name?: unknown }).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

function accountProviderKind(value: unknown): string {
  const rel = Array.isArray(value) ? value[0] : value;
  const cfg = rel && typeof rel === 'object' ? (rel as { email_provider_config?: unknown }).email_provider_config : null;
  if (cfg && typeof cfg === 'object' && 'kind' in cfg) {
    const kind = (cfg as { kind?: unknown }).kind;
    return typeof kind === 'string' ? kind : 'none';
  }
  return 'none';
}

export default async function EditFlow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serviceClient();
  const { data: flow } = await db
    .from('flows')
    .select('*, ig_accounts(name, email_provider_config)')
    .eq('id', id)
    .maybeSingle();
  if (!flow) notFound();
  const account = accountName((flow as { ig_accounts?: unknown }).ig_accounts);
  const providerKind = accountProviderKind((flow as { ig_accounts?: unknown }).ig_accounts);
  const toggleArchived = setFlowArchived.bind(null, flow.id, !flow.archived);
  const settings = {
    name: flow.name,
    language: flow.language,
    triggerType: flow.trigger_type,
    keywords: flow.trigger_keywords.join(', '),
    publicReplyEnabled: flow.public_reply_enabled ?? false,
    publicReplyOptions: readPublicReplyOptions(flow.public_reply_options),
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{flow.name}</h1>
            {flow.archived && <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">archived</span>}
          </div>
          {account && (
            <div className="mt-1 text-sm font-medium text-gray-700">Account: {account}</div>
          )}
          <div className="mt-1 text-sm text-gray-500">
            {triggerLabel(flow.trigger_type)} · {languageLabel(flow.language)} · keywords: {flow.trigger_keywords.join(', ')}
          </div>
        </div>
        <form action={toggleArchived}>
          <button className="rounded border px-3 py-2 text-sm">
            {flow.archived ? 'Unarchive' : 'Archive'}
          </button>
        </form>
      </div>

      <FlowSettingsForm key={JSON.stringify(settings)} flowId={flow.id} initial={settings} />
      <StepsEditor
        flowId={flow.id}
        initialSteps={(flow.steps ?? []) as any[]}
        language={(flow.language === 'en' ? 'en' : 'tr')}
        accountId={flow.ig_account_id}
        providerKind={providerKind}
      />
    </section>
  );
}
