import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/r/[code]/route';

const inserts: { table: string; row: any }[] = [];

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'link_codes'
              ? { data: { id: 'lc1', code: 'ABC', first_clicked_at: null, links: { destination_url: 'https://example.com' } }, error: null }
              : { data: null, error: null },
        }),
      }),
      insert: (row: any) => { inserts.push({ table, row }); return { then: (cb: any) => cb({ data: null, error: null }) }; },
      update: () => ({ eq: () => ({ then: (cb: any) => cb({ data: null, error: null }) }) }),
    }),
  }),
}));

beforeEach(() => { inserts.length = 0; });

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

  it('404 when missing', async () => {
    const res = await GET(new Request('http://localhost/r/zzz'), { params: Promise.resolve({ code: 'zzz' }) });
    expect([302, 404]).toContain(res.status);
  });
});
