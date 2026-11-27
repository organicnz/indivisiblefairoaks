// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());
const requireAdminApi = vi.hoisted(() => vi.fn());
const revalidateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createPublicClient }));
vi.mock('@/lib/admin-api-auth', () => ({ requireAdminApi }));
vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }));

const audits: Record<string, unknown>[] = [];

function adminSession(supabase: { from: (table: string) => unknown }) {
  const client = {
    from: (table: string) => {
      if (table === 'admin_audit_log') {
        return {
          insert: async (row: Record<string, unknown>) => {
            audits.push(row);
            return { error: null };
          },
        };
      }
      return supabase.from(table);
    },
  };
  return {
    ok: true as const,
    session: {
      supabase: client,
      adminClient: client,
      adminUserId: 'admin-1',
      adminEmail: 'admin@example.com',
      mfaLevel: 'aal2' as const,
    },
  };
}

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
    audits.length = 0;
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
      requireAdminApi.mockResolvedValue({ ok: false, status: 401, error: 'Unauthenticated' });

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

      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: mockSaved, error: null }),
              }),
            }),
          }),
        })
      );

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
      expect(audits[0]).toMatchObject({
        actor_user_id: 'admin-1',
        action: 'partner.save',
        target_type: 'partner',
        target_id: 'indivisible-nat',
        target_label: 'Indivisible National',
        mfa_level: 'aal2',
        outcome: 'success',
      });
    });

    it('DELETE deletes partner by slug when user is admin', async () => {
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/partners?slug=partner-1', {
        method: 'DELETE',
      }) as unknown as NextRequest;

      const res = await deletePartner(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(audits[0]).toMatchObject({
        action: 'partner.delete',
        target_type: 'partner',
        target_id: 'partner-1',
        outcome: 'success',
        after: { deleted: true },
      });
    });

    it('POST audits a failed partner save', async () => {
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: 'partners table is locked' },
                }),
              }),
            }),
          }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/partners', {
        method: 'POST',
        body: JSON.stringify({ name: 'Locked Partner', url: 'https://example.com' }),
      }) as unknown as NextRequest;

      const res = await postPartner(req);
      expect(res.status).toBe(500);
      expect(audits[0]).toMatchObject({
        action: 'partner.save',
        target_id: 'locked-partner',
        outcome: 'failure',
        error: 'partners table is locked',
      });
    });

    it('DELETE audits a failed partner delete', async () => {
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: { message: 'partners delete failed' } }),
            }),
          }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/partners?slug=partner-1', {
        method: 'DELETE',
      }) as unknown as NextRequest;

      const res = await deletePartner(req);
      expect(res.status).toBe(500);
      expect(audits[0]).toMatchObject({
        action: 'partner.delete',
        target_id: 'partner-1',
        outcome: 'failure',
        error: 'partners delete failed',
      });
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
      requireAdminApi.mockResolvedValue({ ok: false, status: 401, error: 'Unauthenticated' });

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

      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: mockSaved, error: null }),
              }),
            }),
          }),
        })
      );

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
      expect(revalidateTag).toHaveBeenCalledWith('coalition-links', { expire: 0 });
      expect(revalidatePath).toHaveBeenCalledWith('/links');
      expect(audits[0]).toMatchObject({
        action: 'coalition_link.save',
        target_type: 'coalition_link',
        target_id: 'ca-voter-reg',
        target_label: 'California Voter Reg',
        outcome: 'success',
      });
    });

    it('POST renames an existing coalition link in place instead of upserting a duplicate', async () => {
      const update = vi.fn(() => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { slug: 'ca-voter-registration', name: 'California Voter Reg' },
              error: null,
            }),
          }),
        }),
      }));
      const upsert = vi.fn();
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({ update, upsert }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'ca-voter-registration',
          original_slug: 'ca-voter-reg',
          name: 'California Voter Reg',
          category: 'Voter Resources',
          url: 'https://registertovote.ca.gov',
        }),
      }) as unknown as NextRequest;

      const res = await postCoalitionLink(req);
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'ca-voter-registration' })
      );
      expect(upsert).not.toHaveBeenCalled();
      expect(audits[0]).toMatchObject({
        action: 'coalition_link.save',
        target_id: 'ca-voter-registration',
        outcome: 'success',
        metadata: { original_slug: 'ca-voter-reg' },
      });
    });

    it('DELETE deletes coalition link by slug when user is admin', async () => {
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links?slug=link-1', {
        method: 'DELETE',
      }) as unknown as NextRequest;

      const res = await deleteCoalitionLink(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(revalidateTag).toHaveBeenCalledWith('coalition-links', { expire: 0 });
      expect(revalidatePath).toHaveBeenCalledWith('/links');
      expect(audits[0]).toMatchObject({
        action: 'coalition_link.delete',
        target_type: 'coalition_link',
        target_id: 'link-1',
        outcome: 'success',
        after: { deleted: true },
      });
    });

    it('POST audits a duplicate coalition-link save', async () => {
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: 'duplicate key value', code: '23505' },
                }),
              }),
            }),
          }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links', {
        method: 'POST',
        body: JSON.stringify({ name: 'Duplicate Link', url: 'https://example.com' }),
      }) as unknown as NextRequest;

      const res = await postCoalitionLink(req);
      expect(res.status).toBe(409);
      expect(audits[0]).toMatchObject({
        action: 'coalition_link.save',
        target_id: 'duplicate-link',
        outcome: 'failure',
        error: '"duplicate-link" is already used by another link.',
      });
    });

    it('DELETE audits a failed coalition-link delete', async () => {
      requireAdminApi.mockResolvedValue(
        adminSession({
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: { message: 'coalition delete failed' } }),
            }),
          }),
        })
      );

      const req = new Request('https://indivisiblefairoaks.org/api/coalition-links?slug=link-1', {
        method: 'DELETE',
      }) as unknown as NextRequest;

      const res = await deleteCoalitionLink(req);
      expect(res.status).toBe(500);
      expect(audits[0]).toMatchObject({
        action: 'coalition_link.delete',
        target_id: 'link-1',
        outcome: 'failure',
        error: 'coalition delete failed',
      });
    });
  });
});
