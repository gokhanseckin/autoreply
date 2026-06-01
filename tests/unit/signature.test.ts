import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { verifyMetaSignature } from '@/lib/meta/signature';

const secret = process.env.META_APP_SECRET!;
const body = JSON.stringify({ object: 'instagram', entry: [] });
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('verifyMetaSignature', () => {
  afterEach(() => {
    delete process.env.INSTAGRAM_APP_SECRET;
  });

  it('accepts a valid signature', () => {
    expect(verifyMetaSignature(body, sig)).toBe(true);
  });

  it('accepts a valid signature from the optional Instagram app secret', () => {
    process.env.INSTAGRAM_APP_SECRET = 'instagram-test-app-secret';
    const instagramSig = 'sha256=' + crypto.createHmac('sha256', process.env.INSTAGRAM_APP_SECRET).update(body).digest('hex');

    expect(verifyMetaSignature(body, instagramSig)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(verifyMetaSignature(body, 'sha256=000')).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyMetaSignature(body, null)).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifyMetaSignature(body, 'sha1=abc')).toBe(false);
  });

  it('rejects non-hex signature bodies', () => {
    expect(verifyMetaSignature(body, `sha256=${'z'.repeat(64)}`)).toBe(false);
  });
});
