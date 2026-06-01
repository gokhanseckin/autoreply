import sodium from 'libsodium-wrappers';

const accountName = process.argv[2] ?? 'kenjutsudojo';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

function decodeBytea(value) {
  if (value.startsWith('\\x')) return new Uint8Array(Buffer.from(value.slice(2), 'hex'));
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function decryptSecret(value) {
  await sodium.ready;
  const key = Buffer.from(required('ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes');
  const blob = decodeBytea(value);
  const nonceBytes = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = blob.subarray(0, nonceBytes);
  const ciphertext = blob.subarray(nonceBytes);
  return sodium.to_string(sodium.crypto_secretbox_open_easy(ciphertext, nonce, new Uint8Array(key)));
}

async function graph(path, token, init) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://graph.instagram.com/v23.0/${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const text = await res.text();
  let json = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: res.ok, status: res.status, json };
}

async function graphFacebook(path, token, init) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://graph.facebook.com/v23.0/${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const text = await res.text();
  let json = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: res.ok, status: res.status, json };
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'access_token') {
      out[key] = '[redacted]';
    } else if (typeof item === 'string' && item.includes('access_token=')) {
      out[key] = item.replace(/access_token=[^&]+/g, 'access_token=[redacted]');
    } else {
      out[key] = sanitize(item);
    }
  }
  return out;
}

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const accountsRes = await fetch(
    `${url}/rest/v1/ig_accounts?select=id,name,ig_business_account_id,page_access_token_enc&name=eq.${encodeURIComponent(accountName)}`,
    { headers },
  );
  if (!accountsRes.ok) throw new Error(`Supabase account lookup failed: ${accountsRes.status} ${await accountsRes.text()}`);

  const accounts = await accountsRes.json();
  const account = accounts[0];
  if (!account) throw new Error(`No ig_accounts row found for name=${accountName}`);

  const token = await decryptSecret(account.page_access_token_enc);
  const me = sanitize(await graph('me?fields=id,user_id,username', token));
  const subscribed = sanitize(await graph('me/subscribed_apps', token));
  const conversations = sanitize(await graph('me/conversations?platform=instagram&limit=1', token));
  const appSubscriptions = sanitize(await graphFacebook(`${required('META_APP_ID')}/subscriptions`, `${required('META_APP_ID')}|${required('META_APP_SECRET')}`));

  const messagesRes = await fetch(
    `${url}/rest/v1/messages_log?select=direction,message_type,meta_message_id,sent_at,payload&ig_account_id=eq.${account.id}&order=sent_at.desc&limit=5`,
    { headers },
  );
  const recentMessages = messagesRes.ok ? await messagesRes.json() : { status: messagesRes.status, text: await messagesRes.text() };

  console.log(JSON.stringify({
    account: {
      name: account.name,
      storedBusinessId: account.ig_business_account_id,
      rowId: account.id,
    },
    me,
    subscribed,
    conversations,
    appSubscriptions,
    recentMessages: sanitize(recentMessages).map?.((row) => ({
      direction: row.direction,
      messageType: row.message_type,
      metaMessageId: row.meta_message_id,
      sentAt: row.sent_at,
      senderId: row.payload?.sender?.id ?? null,
      hasText: Boolean(row.payload?.message?.text),
      postbackPayload: row.payload?.postback?.payload ?? null,
    })) ?? recentMessages,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
