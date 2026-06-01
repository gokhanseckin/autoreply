import { serviceClient } from '@/lib/db/client';
import { createFlow } from '../actions';

export default async function NewFlow() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name');
  return (
    <form action={createFlow} className="max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">New flow</h1>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Name</span>
        <input name="name" className="w-full border p-2" required />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Instagram account</span>
        <select name="ig_account_id" className="w-full border p-2">{accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Footer language</span>
          <select name="language" className="w-full border p-2"><option value="tr">Turkish - Gizlilik</option><option value="en">English - Privacy</option></select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Trigger</span>
          <select name="trigger_type" className="w-full border p-2"><option value="comment">Post comment</option><option value="dm">DM keyword</option><option value="story_reply">Story reply - any story</option></select>
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Keywords</span>
        <input name="trigger_keywords" className="w-full border p-2" required />
      </label>
      <button className="bg-black px-3 py-2 text-white">Create</button>
    </form>
  );
}
