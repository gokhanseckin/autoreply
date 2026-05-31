// Subscribes each ig_account to Meta app webhooks for comments + messages.
// Run: set -a; source .env.local; set +a; npx tsx scripts/subscribe-ig-apps.ts
import { decryptSecret, decodeBytea } from '@/lib/db/encryption';

const FIELDS = 'comments,messages,messaging_postbacks,message_reactions';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function main() {
  const res = await fetch(`${URL}/rest/v1/ig_accounts?select=id,name,ig_business_account_id,page_access_token_enc`, { headers: H });
  const accounts: Array<{ id: string; name: string; ig_business_account_id: string; page_access_token_enc: string }> = await res.json();
  if (!accounts?.length) { console.log('No accounts'); return; }

  for (const acc of accounts) {
    const token = await decryptSecret(decodeBytea(acc.page_access_token_enc));
    const subUrl = `https://graph.instagram.com/v23.0/me/subscribed_apps?subscribed_fields=${encodeURIComponent(FIELDS)}&access_token=${encodeURIComponent(token)}`;
    const subRes = await fetch(subUrl, { method: 'POST' });
    console.log(`[${acc.name}] subscribe ${subRes.status} ${await subRes.text()}`);

    const check = await fetch(`https://graph.instagram.com/v23.0/me/subscribed_apps?access_token=${encodeURIComponent(token)}`);
    console.log(`  current:`, JSON.stringify(await check.json()));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
