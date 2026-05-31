import { serviceClient } from '@/lib/db/client';
import { createFlow } from '../actions';

export default async function NewFlow() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name');
  return (
    <form action={createFlow} className="space-y-2 max-w-md">
      <input name="name" placeholder="Flow name" className="w-full border p-2" required />
      <select name="ig_account_id" className="w-full border p-2">{accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select name="language" className="w-full border p-2"><option>tr</option><option>en</option></select>
      <select name="trigger_type" className="w-full border p-2"><option value="comment">comment</option><option value="dm">dm</option><option value="story_reply">story_reply</option></select>
      <input name="trigger_keywords" placeholder="comma-separated keywords" className="w-full border p-2" required />
      <button className="bg-black text-white px-3 py-2">Create</button>
    </form>
  );
}
