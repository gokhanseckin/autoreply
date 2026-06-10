import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/r/[code]/route';

const inserts: { table: string; row: any }[] = [];
const dbState = vi.hoisted(() => ({ destination: 'https://example.com', failClicks: false }));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'link_codes'
              ? { data: { id: 'lc1', code: 'ABC', first_clicked_at: null, links: { destination_url: dbState.destination } }, error: null }
              : { data: null, error: null },
        }),
      }),
      insert: (row: any) => {
        if (table === 'clicks' && dbState.failClicks) throw new Error('clicks table down');
        inserts.push({ table, row });
        return { then: (cb: any) => cb({ data: null, error: null }) };
      },
      update: () => ({ eq: () => ({ then: (cb: any) => cb({ data: null, error: null }) }) }),
    }),
  }),
}));

beforeEach(() => {
  inserts.length = 0;
  dbState.destination = 'https://example.com';
  dbState.failClicks = false;
});

describe('GET /r/[code]', () => {
  it('302 redirects when code exists', async () => {
    const res = await GET(new Request('http://localhost/r/ABC'), { params: Promise.resolve({ code: 'ABC' }) });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/^https:\/\/example\.com\/?$/);
  });

  it('logs a click row with a stable string ip_hash', async () => {
    await GET(new Request('http://localhost/r/ABC', { headers: { 'x-forwarded-for': '9.9.9.9' } }), { params: Promise.resolve({ code: 'ABC' }) });
    const click = inserts.find(i => i.table === 'clicks');
    expect(click).toBeDefined();
    expect(typeof click!.row.ip_hash).toBe('string');
    expect(click!.row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to redirect to a non-http(s) destination', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const destination of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      dbState.destination = destination;
      const res = await GET(new Request('http://localhost/r/ABC'), { params: Promise.resolve({ code: 'ABC' }) });
      expect(res.status, `should block ${destination}`).toBe(404);
      expect(res.headers.get('location')).toBeNull();
    }
    expect(errorSpy.mock.calls.map(([, p]) => String(p)).join('\n')).toContain('unsafe_destination');
    errorSpy.mockRestore();
  });

  it('still redirects when click tracking fails, but logs the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    dbState.failClicks = true;
    const res = await GET(new Request('http://localhost/r/ABC'), { params: Promise.resolve({ code: 'ABC' }) });
    expect(res.status).toBe(302);
    expect(errorSpy.mock.calls.map(([, p]) => String(p)).join('\n')).toContain('click_tracking_failed');
    errorSpy.mockRestore();
  });

  it('404 when missing', async () => {
    const res = await GET(new Request('http://localhost/r/zzz'), { params: Promise.resolve({ code: 'zzz' }) });
    expect([302, 404]).toContain(res.status);
  });
});
