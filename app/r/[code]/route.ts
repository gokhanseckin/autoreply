import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/db/client';
import { hashIp } from '@/lib/links/ip-hash';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = serviceClient();
  const { data, error } = await db
    .from('link_codes')
    .select('id, first_clicked_at, links!inner(destination_url)')
    .eq('code', code)
    .maybeSingle() as any;
  if (error || !data) return new NextResponse('not found', { status: 404 });

  // Defense in depth: the flow schema only admits http(s) URLs, but never
  // redirect to anything else even if a bad row reaches the table.
  const destination: string = data.links.destination_url;
  if (!/^https?:\/\//i.test(destination)) {
    console.error('[redirect]', JSON.stringify({ event: 'unsafe_destination_blocked', code }));
    return new NextResponse('not found', { status: 404 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  try {
    const ipHash = hashIp(ip);
    await db.from('clicks').insert({ link_code_id: data.id, ip_hash: ipHash, user_agent: ua });
    if (!data.first_clicked_at) {
      await db.from('link_codes').update({ first_clicked_at: new Date().toISOString() }).eq('id', data.id);
    }
  } catch (err) {
    // Click tracking must not block the redirect, but its failures are real signal.
    console.error('[redirect]', JSON.stringify({ event: 'click_tracking_failed', code, error: err instanceof Error ? err.message : String(err) }));
  }
  return NextResponse.redirect(destination, 302);
}
