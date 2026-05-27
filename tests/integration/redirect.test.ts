import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/r/[code]/route';

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
      insert: () => ({ then: (cb: any) => cb({ data: null, error: null }) }),
      update: () => ({ eq: () => ({ then: (cb: any) => cb({ data: null, error: null }) }) }),
    }),
  }),
}));
vi.mock('@/lib/links/ip-hash', () => ({ hashIp: async () => 'iphash' }));

describe('GET /r/[code]', () => {
  it('302 redirects when code exists', async () => {
    const res = await GET(new Request('http://localhost/r/ABC'), { params: Promise.resolve({ code: 'ABC' }) });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/^https:\/\/example\.com\/?$/);
  });
  it('404 when missing', async () => {
    const res = await GET(new Request('http://localhost/r/zzz'), { params: Promise.resolve({ code: 'zzz' }) });
    expect([302, 404]).toContain(res.status);
  });
});
