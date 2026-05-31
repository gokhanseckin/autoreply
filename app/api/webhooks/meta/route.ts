import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { verifyMetaSignature } from '@/lib/meta/signature';
import { handleMetaWebhook } from './handler';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const header = req.headers.get('x-hub-signature-256');
  if (!verifyMetaSignature(raw, header)) {
    // TEMP DEBUG: log HMAC prefixes (not the secret) to diagnose mismatch.
    const expected = process.env.META_APP_SECRET
      ? createHmac('sha256', process.env.META_APP_SECRET).update(raw).digest('hex')
      : '(no secret)';
    console.error('[webhook] SIG FAIL', {
      providedPrefix: header?.slice(0, 14) ?? '(none)',
      expectedPrefix: 'sha256=' + expected.slice(0, 7),
      bodyLen: raw.length,
    });
    return new NextResponse('invalid signature', { status: 401 });
  }
  try {
    const result = await handleMetaWebhook(raw);
    return new NextResponse(result.body ?? '', { status: result.status });
  } catch (err) {
    console.error('webhook error', err);
    return new NextResponse('error logged', { status: 200 });
  }
}
