import crypto from 'node:crypto';

export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}
