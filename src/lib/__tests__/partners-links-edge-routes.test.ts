// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({
  createPublicClient,
  createServerClient,
}));

const {
  GET: getPartners,
  POST: postPartner,
  DELETE: deletePartner,
} = await import('@/app/api/partners/route');
const {
  GET: getCoalitionLinks,
  POST: postCoalitionLink,
  DELETE: deleteCoalitionLink,
} = await import('@/app/api/coalition-links/route');

describe('Partners & Coalition Links Edge API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/partners', () => {
    it('GET returns partner list', async () => {
      createPublicClient.mockReturnValue({
        from: () => ({
          select: () => ({
            order: async () => ({
              data: [
                {
                  slug: 'partner-1',
                  name: 'Grassroots Org',
                  category: 'Allies',
                  description: 'Allies description',
                  url: 'https://example.com',
                  sort_order: 10,
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const res = await getPartners();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.partners).toHaveLength(1);
    });

    it('POST rejects unauthenticated users with 401', async () => {
      createServerClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null } }) },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/partners', {
        method: 'POST',
        body: JSON.stringify({ name: 'Org' }),
      }) as unknown as NextRequest;

      const res = await postPartner(req);
      expect(res.status).toBe(401);
    });

    it('POST saves partner when user is admin', async () => {
      const mockSaved = {
        slug: 'indivisible-nat',
        name: 'Indivisible National',
        category: 'Movement',
        description: 'National team',
        url: 'https://indivisible.org',
        sort_order: 10,
      };

      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                or: () => ({
                  single: async () => ({ data: { is_admin: true } }),
                }),
              }),
            };
          }
          return {
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: mockSaved, error: null }),
              }),
            }),
          };
        },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/partners', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Indivisible National',
          category: 'Movement',
          description: 'National team',
          url: 'https://indivisible.org',
          sort_order: 10,
        }),
      }) as unknown as NextRequest;

      const res = await postPartner(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.partner.name).toBe('Indivisible National');
    });

    it('DELETE deletes partner by slug when user is admin', async () => {
      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                or: () => ({
                  single: async () => ({ data: { is_admin: true } }),
                }),
              }),
            };
          }
          return {
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/partners?slug=partner-1', {
        method: 'DELETE',
      }) as unknown as NextRequest;

      const res = await deletePartner(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('/api/coalition-links', () => {
    it('GET returns coalition links list', async () => {
      createPublicClient.mockReturnValue({
        from: () => ({
          select: () => ({
            order: async () => ({
              data: [
                {
                  slug: 'link-1',
                  name: 'Voter Registration',
                  category: 'Tools',
                  url: 'https://register.ca.gov',
                  description: 'Online registration',
                  badge: 'Official',
                  sort_order: 10,
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const res = await getCoalitionLinks();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.links).toHaveLength(1);
    });

    it('POST rejects unauthenticated users with 401', async () => {
      createServerClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null } }) },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links', {
        method: 'POST',
        body: JSON.stringify({ name: 'Link' }),
      }) as unknown as NextRequest;

      const res = await postCoalitionLink(req);
      expect(res.status).toBe(401);
    });

    it('POST saves coalition link when user is admin', async () => {
      const mockSaved = {
        slug: 'ca-voter-reg',
        name: 'California Voter Reg',
        category: 'Voter Resources',
        url: 'https://registertovote.ca.gov',
        description: 'Register online',
        badge: 'Official SOS',
        sort_order: 10,
      };

      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                or: () => ({
                  single: async () => ({ data: { is_admin: true } }),
                }),
              }),
            };
          }
          return {
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: mockSaved, error: null }),
              }),
            }),
          };
        },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links', {
        method: 'POST',
        body: JSON.stringify({
          name: 'California Voter Reg',
          category: 'Voter Resources',
          url: 'https://registertovote.ca.gov',
          description: 'Register online',
          badge: 'Official SOS',
          sort_order: 10,
        }),
      }) as unknown as NextRequest;

      const res = await postCoalitionLink(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.link.name).toBe('California Voter Reg');
    });

    it('DELETE deletes coalition link by slug when user is admin', async () => {
      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                or: () => ({
                  single: async () => ({ data: { is_admin: true } }),
                }),
              }),
            };
          }
          return {
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links?slug=link-1', {
        method: 'DELETE',
      }) as unknown as NextRequest;

      const res = await deleteCoalitionLink(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
