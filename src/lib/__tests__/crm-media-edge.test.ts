import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('server-only', () => ({}));

const mockStorageFrom = {
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
};

const mockAdminClient = {
  from: vi.fn(),
  storage: {
    from: vi.fn(() => mockStorageFrom),
  },
};

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({
    adminClient: mockAdminClient,
    adminUserId: 'admin-uuid-test',
    adminEmail: 'admin@indivisiblefairoaks.org',
  })),
}));

import {
  deleteCRMMedia,
  getCRMEdgeFunctionHealth,
  getCRMMediaFiles,
  uploadCRMMedia,
} from '@/lib/actions/crm';
import { env } from '@/lib/env';

describe('CRM Supabase S3 Storage Media & Edge Function API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCRMMediaFiles', () => {
    it('scans the requested folder and filters out placeholders', async () => {
      mockStorageFrom.list.mockResolvedValueOnce({
        data: [
          {
            name: 'protest-march.jpg',
            id: 'crm/protest-march.jpg',
            created_at: '2026-10-01T12:00:00Z',
            metadata: { size: 1048576, mimetype: 'image/jpeg' },
          },
          {
            name: '.emptyFolderPlaceholder',
            id: 'placeholder',
          },
        ],
        error: null,
      });

      const res = await getCRMMediaFiles({ folder: 'crm' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].name).toBe('protest-march.jpg');
      expect(res.items[0].folder).toBe('crm');
      expect(res.items[0].size).toBe(1048576);
      expect(res.items[0].mimeType).toBe('image/jpeg');
      expect(res.items[0].url).toContain('crm/protest-march.jpg');
    });

    it('filters by search term case-insensitively', async () => {
      mockStorageFrom.list.mockResolvedValueOnce({
        data: [
          {
            name: 'rally-flyer.png',
            id: 'crm/rally-flyer.png',
            created_at: '2026-10-02T12:00:00Z',
            metadata: { size: 500000, mimetype: 'image/png' },
          },
          {
            name: 'canvassing-map.png',
            id: 'crm/canvassing-map.png',
            created_at: '2026-10-03T12:00:00Z',
            metadata: { size: 300000, mimetype: 'image/png' },
          },
        ],
        error: null,
      });

      const res = await getCRMMediaFiles({ folder: 'crm', search: 'RALLY' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].name).toBe('rally-flyer.png');
    });

    it('sorts newest first across the scanned folders', async () => {
      // The comparator only runs with two or more rows: single-item seeds
      // leave it uncovered, which is exactly how the functions floor went red.
      mockStorageFrom.list.mockResolvedValueOnce({
        data: [
          {
            name: 'older.jpg',
            id: 'crm/older.jpg',
            created_at: '2026-10-01T12:00:00Z',
            metadata: { size: 100, mimetype: 'image/jpeg' },
          },
          {
            name: 'newer.jpg',
            id: 'crm/newer.jpg',
            created_at: '2026-10-03T12:00:00Z',
            metadata: { size: 100, mimetype: 'image/jpeg' },
          },
        ],
        error: null,
      });

      const res = await getCRMMediaFiles({ folder: 'crm' });
      expect(res.items.map((item) => item.name)).toEqual(['newer.jpg', 'older.jpg']);
    });
  });

  describe('uploadCRMMedia', () => {
    it('rejects upload when no file is present', async () => {
      const fd = new FormData();
      const res = await uploadCRMMedia(fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('No file provided');
    });

    it('rejects SVG files to prevent stored XSS', async () => {
      const fd = new FormData();
      const svgFile = new File(['<svg><script>alert(1)</script></svg>'], 'vector.svg', {
        type: 'image/svg+xml',
      });
      fd.append('file', svgFile);

      const res = await uploadCRMMedia(fd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('SVG is prohibited');
    });

    it('rejects files exceeding the 5MB ceiling', async () => {
      const fd = new FormData();
      const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'giant.png', {
        type: 'image/png',
      });
      fd.append('file', largeFile);

      const res = await uploadCRMMedia(fd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('5MB or smaller');
    });

    it('successfully uploads valid images under crm/ namespace', async () => {
      mockStorageFrom.upload.mockResolvedValueOnce({
        data: { path: 'crm/banner-abc.png' },
        error: null,
      });

      const fd = new FormData();
      const validPng = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'banner.png', {
        type: 'image/png',
      });
      fd.append('file', validPng);

      const res = await uploadCRMMedia(fd);
      expect(res.success).toBe(true);
      expect(res.data?.folder).toBe('crm');
      expect(res.data?.mimeType).toBe('image/png');
      expect(res.data?.path).toMatch(/^crm\/banner-[a-z0-9]+\.png$/);
    });

    it('falls back to a generic message when the upload throws a non-Error', async () => {
      mockStorageFrom.upload.mockRejectedValueOnce('storage quota exceeded');

      const fd = new FormData();
      const validPng = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'banner.png', {
        type: 'image/png',
      });
      fd.append('file', validPng);

      const res = await uploadCRMMedia(fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to upload media');
    });

    it('surfaces the storage error message when the upload is rejected', async () => {
      mockStorageFrom.upload.mockResolvedValueOnce({
        data: null,
        error: { message: 'bucket quota exceeded' },
      });

      const fd = new FormData();
      const validPng = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'banner.png', {
        type: 'image/png',
      });
      fd.append('file', validPng);

      const res = await uploadCRMMedia(fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('bucket quota exceeded');
    });
  });

  describe('deleteCRMMedia', () => {
    /**
     * The namespace guard used to be `crm/` only, which refused every delete
     * the media library made possible: the dialog the visual editor and the
     * content editor both open defaults to `content/`, so its delete button
     * answered "not allowed" for a file the same dialog had just uploaded. A
     * guard that refuses its own uploads protects nothing, so the guard is now
     * "one of the three folders, with the right reference check for that
     * folder".
     */
    it('refuses a namespace that is not a media folder', async () => {
      const res = await deleteCRMMedia('secret/crucial-page.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toContain('restricted to the crm, content, products media folders');
      expect(mockStorageFrom.remove).not.toHaveBeenCalled();
    });

    it('refuses path traversal attempts', async () => {
      const res = await deleteCRMMedia('crm/../sensitive.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toContain('restricted to the crm, content, products media folders');
      expect(mockStorageFrom.remove).not.toHaveBeenCalled();
    });

    it('removes a content/ asset no page or revision references', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          like: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          eq: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      }));
      mockStorageFrom.remove.mockResolvedValueOnce({
        data: [{ name: 'content/crucial-page.jpg' }],
        error: null,
      });

      const res = await deleteCRMMedia('content/crucial-page.jpg');
      expect(res.success).toBe(true);
      expect(mockStorageFrom.remove).toHaveBeenCalledWith(['content/crucial-page.jpg']);
    });

    it('refuses a content/ asset a live page still references', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          like: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [{ id: 7 }], error: null }),
          })),
          eq: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      }));

      const res = await deleteCRMMedia('content/crucial-page.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toContain('still used by a page or one of its revisions');
      expect(mockStorageFrom.remove).not.toHaveBeenCalled();
    });

    it('removes allowed crm/ assets no broadcast references', async () => {
      // `mediaReferenceReason` checks broadcasts + content + revisions for a
      // `crm/` path, so all three reads resolve empty here.
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          like: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      }));
      mockStorageFrom.remove.mockResolvedValueOnce({
        data: [{ name: 'crm/test.jpg' }],
        error: null,
      });

      const res = await deleteCRMMedia('crm/test.jpg');
      expect(res.success).toBe(true);
      expect(mockStorageFrom.remove).toHaveBeenCalledWith(['crm/test.jpg']);
    });

    it('surfaces the storage error message when the removal itself fails', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          like: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      }));
      mockStorageFrom.remove.mockResolvedValueOnce({
        data: null,
        error: { message: 'storage backend unreachable' },
      });

      const res = await deleteCRMMedia('crm/test.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toBe('storage backend unreachable');
    });

    it('refuses deletion while a saved broadcast references the image', async () => {
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          like: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [{ id: 'broadcast-1' }], error: null }),
          })),
        })),
      });

      const res = await deleteCRMMedia('crm/rally-banner.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toContain('still used in a saved broadcast');
      expect(mockStorageFrom.remove).not.toHaveBeenCalled();
    });

    it('fails safely when the reference check itself errors', async () => {
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          like: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: null, error: new Error('db down') }),
          })),
        })),
      });

      const res = await deleteCRMMedia('crm/rally-banner.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Could not verify');
      expect(mockStorageFrom.remove).not.toHaveBeenCalled();
    });

    it('returns an error when requireAdmin throws', async () => {
      const { requireAdmin } = await import('@/lib/admin-auth');
      vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('auth failed'));

      const res = await deleteCRMMedia('crm/test.jpg');
      expect(res.success).toBe(false);
      expect(res.error).toBe('auth failed');
      expect(mockStorageFrom.remove).not.toHaveBeenCalled();
    });
  });

  describe('getCRMEdgeFunctionHealth', () => {
    it('returns backend, storage, and edge function status', async () => {
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ error: null, data: [{ id: '1' }] }),
        })),
      });

      mockStorageFrom.list.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const status = await getCRMEdgeFunctionHealth();
      expect(status.database).toBe(true);
      expect(status.storage).toBe(true);
      expect(typeof status.edgeFunction).toBe('boolean');
    });

    it('falls back to a generic message when requireAdmin throws a non-Error', async () => {
      const { requireAdmin } = await import('@/lib/admin-auth');
      vi.mocked(requireAdmin).mockRejectedValueOnce('admin probe exploded');

      const status = await getCRMEdgeFunctionHealth();
      expect(status.database).toBe(false);
      expect(status.storage).toBe(false);
      expect(status.error).toBe('Failed to query CRM health');
    });

    describe('with CRM_BROADCAST_FUNCTION_URL set', () => {
      const originalUrl = env.CRM_BROADCAST_FUNCTION_URL;

      beforeEach(() => {
        env.CRM_BROADCAST_FUNCTION_URL = 'https://test-function.supabase.co';
      });

      afterEach(() => {
        if (originalUrl === undefined) {
          env.CRM_BROADCAST_FUNCTION_URL = undefined;
        } else {
          env.CRM_BROADCAST_FUNCTION_URL = originalUrl;
        }
        vi.unstubAllGlobals();
      });

      it('probes the edge function and reports ready', async () => {
        mockAdminClient.from.mockReturnValueOnce({
          select: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ error: null, data: [{ id: '1' }] }),
          })),
        });
        mockStorageFrom.list.mockResolvedValueOnce({ data: [], error: null });

        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ready: true, missing: [] }),
          })
        );

        const status = await getCRMEdgeFunctionHealth();
        expect(status.edgeFunction).toBe(true);
        expect(status.edgeFunctionDetails?.ready).toBe(true);
        expect(status.edgeFunctionDetails?.endpoint).toBe('https://test-function.supabase.co');
      });

      it('reports HTTP error when the probe returns non-ok', async () => {
        mockAdminClient.from.mockReturnValueOnce({
          select: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ error: null, data: [{ id: '1' }] }),
          })),
        });
        mockStorageFrom.list.mockResolvedValueOnce({ data: [], error: null });

        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
          })
        );

        const status = await getCRMEdgeFunctionHealth();
        expect(status.edgeFunction).toBe(false);
        expect(status.edgeFunctionDetails?.ready).toBe(false);
        expect(status.edgeFunctionDetails?.missing).toContain('HTTP_503');
      });

      it('reports unreachable when the probe throws', async () => {
        mockAdminClient.from.mockReturnValueOnce({
          select: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ error: null, data: [{ id: '1' }] }),
          })),
        });
        mockStorageFrom.list.mockResolvedValueOnce({ data: [], error: null });

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        const status = await getCRMEdgeFunctionHealth();
        expect(status.edgeFunction).toBe(false);
        expect(status.edgeFunctionDetails?.ready).toBe(false);
        expect(status.edgeFunctionDetails?.missing).toContain('UNREACHABLE_OR_TIMEOUT');
      });
    });
  });
});
