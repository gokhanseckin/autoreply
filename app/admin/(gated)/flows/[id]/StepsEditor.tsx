'use client';
import { useState } from 'react';
import { saveFlowSteps } from '../actions';

export function StepsEditor({ flowId, initialSteps }: { flowId: string; initialSteps: unknown[] }) {
  const [json, setJson] = useState(JSON.stringify(initialSteps, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  async function save() {
    setErr(null); setOk(false);
    try { await saveFlowSteps(flowId, json); setOk(true); } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Edit the steps JSON directly. Validated by Zod on save.</p>
      <textarea className="w-full h-96 font-mono text-xs border p-2" value={json} onChange={(e) => setJson(e.target.value)} />
      <div className="flex items-center gap-3">
        <button onClick={save} className="bg-black text-white px-3 py-2">Save</button>
        {err && <span className="text-red-600 text-sm">{err}</span>}
        {ok && <span className="text-green-700 text-sm">Saved</span>}
      </div>
    </div>
  );
}
