import { decryptSecret, decodeBytea } from '@/lib/db/encryption';
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H={apikey:KEY,Authorization:`Bearer ${KEY}`};
async function main(){
  const r=await fetch(`${URL}/rest/v1/ig_accounts?select=name,page_access_token_enc&name=eq.kenjutsudojo`,{headers:H});
  const [acc]=await r.json();
  const tok=await decryptSecret(decodeBytea(acc.page_access_token_enc));
  // graph.instagram.com debug_token / me?fields=...permissions not standard; use /me with token and inspect via /me?fields
  const me=await fetch(`https://graph.instagram.com/v23.0/me?fields=id,username&access_token=${encodeURIComponent(tok)}`);
  console.log('me:', me.status, await me.text());
  // Try a manage_comments WRITE-ish read that strictly needs the scope: list comments already worked. Try mentions/insights? 
  // Inspect token scopes via the IG token introspection
  const dbg=await fetch(`https://graph.instagram.com/v23.0/me?fields=id&access_token=${encodeURIComponent(tok)}`);
  console.log('token tail:', tok.slice(-6), 'len', tok.length);
}
main().catch(e=>{console.error(e);process.exit(1);});
