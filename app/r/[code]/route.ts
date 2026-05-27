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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  try {
    const ipHash = await hashIp(ip);
    await db.from('clicks').insert({ link_code_id: data.id, ip_hash: ipHash, user_agent: ua });
    if (!data.first_clicked_at) {
      await db.from('link_codes').update({ first_clicked_at: new Date().toISOString() }).eq('id', data.id);
    }
  } catch {
    // best-effort logging
  }
  return NextResponse.redirect(data.links.destination_url, 302);
}
