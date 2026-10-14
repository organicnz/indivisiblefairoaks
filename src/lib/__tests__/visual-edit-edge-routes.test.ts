import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServerClient = vi.hoisted(() => vi.fn());
const getVisualPageContext = vi.hoisted(() => vi.fn());
const getContentForEdit = vi.hoisted(() => vi.fn());
const getContentBySlugForEdit = vi.hoisted(() => vi.fn());
const saveContent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({
  createServerClient,
}));

vi.mock('@/lib/actions/visual', () => ({
  getVisualPageContext,
}));

vi.mock('@/lib/actions/content', () => ({
  getContentForEdit,
  getContentBySlugForEdit,
  saveContent,
}));

const { GET: getContext } = await import('@/app/api/visual-edit/context/route');
const { GET: getContent, POST: postContent } = await import('@/app/api/visual-edit/content/route');

describe('Visual Edit Edge API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/visual-edit/context', () => {
    it('rejects unauthenticated requests with 401', async () => {
      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: null } }),
        },
      });

      const req = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/context?pathname=/about'
      ) as unknown as NextRequest;
      const res = await getContext(req);
      expect(res.status).toBe(401);
    });

    it('returns visual page context when user is admin', async () => {
      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: () => ({
          select: () => ({
            or: () => ({
              single: async () => ({ data: { is_admin: true } }),
            }),
          }),
        }),
      });

      const mockCtx = {
        content: { id: 10, title: 'About Us', slug: 'about' },
        revisions: [],
        revisionsTruncated: false,
        media: { items: [], folders: ['content'] },
        backend: { database: true, storage: true, edgeFunction: true },
        crmStats: { totalContacts: 120 },
        segments: [],
        segmentsTruncated: false,
        catalog: { products: 5, galleryPhotos: 8, events: 3 },
      };

      getVisualPageContext.mockResolvedValue(mockCtx);

      const req = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/context?pathname=/about'
      ) as unknown as NextRequest;
      const res = await getContext(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.content.title).toBe('About Us');
      expect(json.crmStats.totalContacts).toBe(120);
    });
  });

  describe('/api/visual-edit/content', () => {
    it('GET fetches content by slug for admin', async () => {
      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: () => ({
          select: () => ({
            or: () => ({
              single: async () => ({ data: { is_admin: true } }),
            }),
          }),
        }),
      });

      getContentBySlugForEdit.mockResolvedValue({
        id: 42,
        slug: 'choir',
        title: 'Resistance Choir',
        body: '<p>Singing for democracy</p>',
      });

      const req = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/content?slug=choir'
      ) as unknown as NextRequest;
      const res = await getContent(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.content.title).toBe('Resistance Choir');
      expect(getContentBySlugForEdit).toHaveBeenCalledWith('choir');
    });

    it('POST saves content via saveContent action', async () => {
      createServerClient.mockResolvedValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-1' } } }),
        },
        from: () => ({
          select: () => ({
            or: () => ({
              single: async () => ({ data: { is_admin: true } }),
            }),
          }),
        }),
      });

      saveContent.mockResolvedValue({
        success: true,
        data: { id: 42, updatedAt: '2026-10-14T12:00:00Z' },
      });

      const req = new Request('https://indivisiblefairoaks.org/api/visual-edit/content', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Resistance Choir',
          slug: 'choir',
          body: '<p>Singing for democracy</p>',
        }),
      }) as unknown as NextRequest;

      const res = await postContent(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(42);
    });
  });
});
