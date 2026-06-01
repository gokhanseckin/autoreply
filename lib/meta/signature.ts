import crypto from 'node:crypto';

function webhookSecrets(): string[] {
  return [
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ].filter((secret): secret is string => !!secret);
}

export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const providedBuffer = Buffer.from(provided, 'hex');

  for (const secret of webhookSecrets()) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (crypto.timingSafeEqual(providedBuffer, Buffer.from(expected, 'hex'))) return true;
  }
  return false;
}
