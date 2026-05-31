// Exercises IG permissions so App Review "testing" counters register.
// Run: set -a; source .env.local; set +a; npx tsx scripts/ig-permission-test.ts
import { decryptSecret, decodeBytea } from '@/lib/db/encryption';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function main() {
  const r = await fetch(`${URL}/rest/v1/ig_accounts?select=name,page_access_token_enc&name=eq.kenjutsudojo`, { headers: H });
  const [acc] = await r.json();
  const tok = await decryptSecret(decodeBytea(acc.page_access_token_enc));
  const g = async (p: string) => {
    const x = await fetch(`https://graph.instagram.com/v23.0/${p}${p.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(tok)}`);
    return `${x.status} ${(await x.text()).slice(0, 240)}`;
  };

  // instagram_business_manage_messages -> conversations
  console.log('conversations:', await g('me/conversations?platform=instagram'));

  // instagram_business_manage_comments -> read comments on a media
  const mRes = await fetch(`https://graph.instagram.com/v23.0/me/media?fields=id,comments_count&limit=10&access_token=${encodeURIComponent(tok)}`);
  const data = (await mRes.json())?.data ?? [];
  const withComments = data.find((m: any) => (m.comments_count ?? 0) > 0) ?? data[0];
  if (withComments) {
    console.log('comments on', withComments.id, ':', await g(`${withComments.id}/comments?fields=id,text`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
