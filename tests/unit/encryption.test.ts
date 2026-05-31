import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '@/lib/db/encryption';

describe('encryption', () => {
  it('round-trips a string', async () => {
    const enc = await encryptSecret('hello-world');
    expect(enc).toBeInstanceOf(Uint8Array);
    expect(await decryptSecret(enc)).toBe('hello-world');
  });

  it('produces different ciphertexts for the same plaintext (random nonce)', async () => {
    const a = await encryptSecret('same');
    const b = await encryptSecret('same');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects tampered ciphertext', async () => {
    const enc = await encryptSecret('payload');
    enc[enc.length - 1] ^= 1;
    await expect(decryptSecret(enc)).rejects.toThrow();
  });
});
