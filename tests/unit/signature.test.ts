import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyMetaSignature } from '@/lib/meta/signature';

const secret = process.env.META_APP_SECRET!;
const body = JSON.stringify({ object: 'instagram', entry: [] });
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('verifyMetaSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifyMetaSignature(body, sig)).toBe(true);
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
});
