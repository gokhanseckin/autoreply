import sodium from 'libsodium-wrappers';

let ready: Promise<void> | null = null;
async function init() {
  if (!ready) ready = sodium.ready;
  await ready;
}

function key(): Uint8Array {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) throw new Error('ENCRYPTION_KEY env var missing');
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes');
  return new Uint8Array(k);
}

export async function encryptSecret(plain: string): Promise<Uint8Array> {
  await init();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ct = sodium.crypto_secretbox_easy(sodium.from_string(plain), nonce, key());
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return out;
}

export async function decryptSecret(blob: Uint8Array): Promise<string> {
  await init();
  const nb = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = blob.subarray(0, nb);
  const ct = blob.subarray(nb);
  const plain = sodium.crypto_secretbox_open_easy(ct, nonce, key());
  return sodium.to_string(plain);
}

/**
 * Decode a Supabase bytea column to raw bytes.
 * PostgREST returns bytea as `\xHEXSTRING`; legacy code paths may store base64.
 * Accepts a Uint8Array passthrough for tests.
 */
export function decodeBytea(value: string | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return new Uint8Array(Buffer.from(value.slice(2), 'hex'));
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  throw new Error('decodeBytea: unsupported value');
}

/** Encode raw bytes for insertion into a Supabase bytea column via PostgREST. */
export function encodeBytea(bytes: Uint8Array): string {
  return '\\x' + Buffer.from(bytes).toString('hex');
}
