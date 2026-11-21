// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApi = vi.hoisted(() => vi.fn());
const getVisualPageContext = vi.hoisted(() => vi.fn());
const getContentForEdit = vi.hoisted(() => vi.fn());
const getContentBySlugForEdit = vi.hoisted(() => vi.fn());
const saveContent = vi.hoisted(() => vi.fn());
const getCRMMediaFiles = vi.hoisted(() => vi.fn());
const uploadCRMMedia = vi.hoisted(() => vi.fn());
const deleteCRMMedia = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-api-auth', () => ({ requireAdminApi }));

vi.mock('@/lib/actions/visual', () => ({
  getVisualPageContext,
}));

vi.mock('@/lib/actions/content', () => ({
  getContentForEdit,
  getContentBySlugForEdit,
  saveContent,
}));

vi.mock('@/lib/actions/crm', () => ({
  getCRMMediaFiles,
  uploadCRMMedia,
  deleteCRMMedia,
}));

const { GET: getContext } = await import('@/app/api/visual-edit/context/route');
const { GET: getContent, POST: postContent } = await import('@/app/api/visual-edit/content/route');
const {
  GET: getMedia,
  POST: postMedia,
  DELETE: deleteMedia,
} = await import('@/app/api/visual-edit/media/route');

function adminSession() {
  return {
    ok: true as const,
    session: {
      supabase: {},
      adminClient: {},
      adminUserId: 'admin-1',
      adminEmail: 'admin@example.com',
    },
  };
}

function failure(
  status: 401 | 403 | 503,
  error: string,
  mfaRequired = false,
  mfaEnrollmentRequired = false
): {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
} {
  return {
    ok: false,
    status,
    error,
    ...(mfaRequired ? { mfaRequired: true } : {}),
    ...(mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
  };
}

const aal1Failure = () => failure(403, 'MFA verification required. Please complete 2FA.', true);

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminApi.mockResolvedValue(adminSession());
  getContentForEdit.mockResolvedValue({ id: 7, slug: 'about', title: 'About' });
  getContentBySlugForEdit.mockResolvedValue({
    id: 42,
    slug: 'choir',
    title: 'Resistance Choir',
    body: '<p>Singing for democracy</p>',
  });
  saveContent.mockResolvedValue({
    success: true,
    data: { id: 42, updatedAt: '2026-10-14T12:00:00Z' },
  });
  getCRMMediaFiles.mockResolvedValue({ items: [], folders: ['crm'] });
  uploadCRMMedia.mockResolvedValue({ success: true, data: { path: 'crm/rally.jpg' } });
  deleteCRMMedia.mockResolvedValue({ success: true });
});

describe('Visual Edit Edge API Routes', () => {
  describe('shared admin/MFA gate', () => {
    it.each([
      { status: 401 as const, error: 'Unauthenticated', mfaRequired: false },
      { status: 403 as const, error: 'Admin privileges required', mfaRequired: false },
      {
        status: 403 as const,
        error: 'MFA verification required. Please complete 2FA.',
        mfaRequired: true,
      },
      {
        status: 403 as const,
        error: 'MFA enrollment required. Set up an authenticator app to continue.',
        mfaRequired: false,
        mfaEnrollmentRequired: true,
      },
      {
        status: 503 as const,
        error: 'Could not verify admin access. Try again.',
        mfaRequired: false,
      },
    ])(
      'maps $status $error to a JSON response',
      async ({ status, error, mfaRequired, mfaEnrollmentRequired }) => {
        requireAdminApi.mockResolvedValue(
          failure(status, error, mfaRequired, mfaEnrollmentRequired)
        );

        const req = new Request(
          'https://indivisiblefairoaks.org/api/visual-edit/context?pathname=/about'
        ) as unknown as NextRequest;
        const res = await getContext(req);

        expect(res.status).toBe(status);
        const json = await res.json();
        expect(json).toEqual({
          error,
          ...(mfaRequired ? { mfaRequired: true } : {}),
          ...(mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
        });
        expect(getVisualPageContext).not.toHaveBeenCalled();
      }
    );

    it('stops all visual-edit handlers before their actions when the session is AAL1', async () => {
      requireAdminApi.mockResolvedValue(aal1Failure());

      const contextReq = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/context?pathname=/about'
      ) as unknown as NextRequest;
      const contentReq = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/content?slug=choir'
      ) as unknown as NextRequest;
      const saveReq = new Request('https://indivisiblefairoaks.org/api/visual-edit/content', {
        method: 'POST',
        body: JSON.stringify({ title: 'Changed', slug: 'choir' }),
      }) as unknown as NextRequest;
      const mediaReq = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/media'
      ) as unknown as NextRequest;
      const uploadReq = new Request('https://indivisiblefairoaks.org/api/visual-edit/media', {
        method: 'POST',
        body: new FormData(),
      });
      const deleteReq = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/media?path=crm%2Fphoto.jpg',
        { method: 'DELETE' }
      );

      const responses = await Promise.all([
        getContext(contextReq),
        getContent(contentReq),
        postContent(saveReq),
        getMedia(mediaReq),
        postMedia(uploadReq),
        deleteMedia(deleteReq),
      ]);

      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ mfaRequired: true });
      }
      expect(getVisualPageContext).not.toHaveBeenCalled();
      expect(getContentForEdit).not.toHaveBeenCalled();
      expect(getContentBySlugForEdit).not.toHaveBeenCalled();
      expect(saveContent).not.toHaveBeenCalled();
      expect(getCRMMediaFiles).not.toHaveBeenCalled();
      expect(uploadCRMMedia).not.toHaveBeenCalled();
      expect(deleteCRMMedia).not.toHaveBeenCalled();
    });
  });

  describe('/api/visual-edit/context', () => {
    it('rejects unauthenticated requests with 401', async () => {
      requireAdminApi.mockResolvedValue(failure(401, 'Unauthenticated'));

      const req = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/context?pathname=/about'
      ) as unknown as NextRequest;
      const res = await getContext(req);
      expect(res.status).toBe(401);
    });

    it('returns visual page context when user is admin', async () => {
      const mockCtx = {
        content: { id: 10, title: 'About Us', slug: 'about' },
        revisions: [],
        revisionsTruncated: false,
        media: { items: [], folders: ['content'] },
        backend: { database: true, storage: true, edgeFunction: true },
        crmStats: { totalContacts: 120 },
        segments: [],
        segmentsTruncated: false,
        catalog: { galleryPhotos: 8, events: 3 },
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
      expect(getVisualPageContext).toHaveBeenCalledWith({
        pathname: '/about',
        slug: undefined,
        contentId: undefined,
      });
    });
  });

  describe('/api/visual-edit/content', () => {
    it('GET fetches content by slug for admin', async () => {
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

  describe('/api/visual-edit/media', () => {
    it('GET lists media for admin', async () => {
      getCRMMediaFiles.mockResolvedValue({
        items: [{ path: 'crm/rally.jpg' }],
        folders: ['crm'],
      });

      const req = new Request('https://indivisiblefairoaks.org/api/visual-edit/media?folder=crm');
      const res = await getMedia(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        media: [{ path: 'crm/rally.jpg' }],
        folders: ['crm'],
      });
      expect(getCRMMediaFiles).toHaveBeenCalledWith({
        folder: 'crm',
        search: undefined,
        limit: 100,
      });
    });

    it('POST uploads media for admin', async () => {
      const req = new Request('https://indivisiblefairoaks.org/api/visual-edit/media', {
        method: 'POST',
        body: new FormData(),
      });
      const res = await postMedia(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        success: true,
        media: { path: 'crm/rally.jpg' },
      });
      expect(uploadCRMMedia).toHaveBeenCalledWith(expect.any(FormData));
    });

    it('POST carries an audit warning back to the caller', async () => {
      uploadCRMMedia.mockResolvedValueOnce({
        success: true,
        data: { path: 'crm/rally.jpg' },
        warning: 'The media file was uploaded, but its audit record was lost.',
      });
      const req = new Request('https://indivisiblefairoaks.org/api/visual-edit/media', {
        method: 'POST',
        body: new FormData(),
      });

      const res = await postMedia(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        success: true,
        media: { path: 'crm/rally.jpg' },
        warning: 'The media file was uploaded, but its audit record was lost.',
      });
    });

    it('DELETE removes media for admin', async () => {
      const req = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/media?path=crm%2Fphoto.jpg',
        { method: 'DELETE' }
      );
      const res = await deleteMedia(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ success: true });
      expect(deleteCRMMedia).toHaveBeenCalledWith('crm/photo.jpg');
    });

    it('DELETE carries an audit warning back to the caller', async () => {
      deleteCRMMedia.mockResolvedValueOnce({
        success: true,
        warning: 'The media file was deleted, but its audit record was lost.',
      });
      const req = new Request(
        'https://indivisiblefairoaks.org/api/visual-edit/media?path=crm%2Fphoto.jpg',
        { method: 'DELETE' }
      );

      const res = await deleteMedia(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        success: true,
        warning: 'The media file was deleted, but its audit record was lost.',
      });
    });
  });
});
