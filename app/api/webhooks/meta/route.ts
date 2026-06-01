import { NextResponse } from 'next/server';
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
  console.info('[webhook:meta]', JSON.stringify({
    event: 'post_received',
    hasSignature: !!header,
    bodyLength: raw.length,
    hasMetaAppSecret: !!process.env.META_APP_SECRET,
    hasInstagramAppSecret: !!process.env.INSTAGRAM_APP_SECRET,
  }));
  if (!verifyMetaSignature(raw, header)) {
    console.error('[webhook:meta]', JSON.stringify({
      event: 'signature_rejected',
      hasSignature: !!header,
      signaturePrefix: header?.slice(0, 15) ?? null,
      bodyLength: raw.length,
      hasMetaAppSecret: !!process.env.META_APP_SECRET,
      hasInstagramAppSecret: !!process.env.INSTAGRAM_APP_SECRET,
    }));
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
