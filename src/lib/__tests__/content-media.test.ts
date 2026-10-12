import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentMediaInsert, ContentMediaRow } from '@/types/content-media';
import { createMockAdminClient, type MockTableConfig } from './supabase-mock';

const { mockRequireAdmin } = vi.hoisted(() => ({ mockRequireAdmin: vi.fn() }));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

vi.mock('@/lib/supabase', () => ({
  getStorageUrl: (path: string) =>
    `https://test.supabase.co/storage/v1/object/public/media/${path}`,
}));

vi.mock('@/lib/image-size', () => ({
  measureImageSize: vi.fn(() => ({ width: 800, height: 600 })),
}));

/** The storage object the actions talk to — one per `configure` call. */
let storageMocks: {
  upload: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
/**
 * Wire `requireAdmin` to a row-based client over `tables`.
 *
 * This suite used to hand-roll a chain per test, and the roll was *wrong in
 * both directions at once*: `maybeSingle()` answered a no-match read with an
 * `error`, which let `assertContentPublished`'s "throw on error" guard pass
 * every green test while the real client — and therefore production — returned
 * `{ data: null, error: null }` for a draft. The shared mock reproduces the
 * real semantics, so the suite now catches what the old one papered over.
 */
function configure(
  tables: Record<string, MockTableConfig>,
  storage?: { upload?: unknown; remove?: unknown }
): { upload: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } {
  const upload = vi.fn().mockResolvedValue(storage?.upload ?? { error: null });
  const remove = vi.fn().mockResolvedValue(storage?.remove ?? { error: null });
  storageMocks = { upload, remove };
  const client = {
    ...createMockAdminClient(tables),
    storage: { from: vi.fn(() => ({ upload, remove })) },
  };
  mockRequireAdmin.mockResolvedValue({ adminClient: client });
  return { upload, remove };
}

/** A live content row the `assertContentPublished` gate must let through. */
function publishedRow(
  id: number,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id,
    status: 'publish',
    published_at: '2026-01-01T00:00:00.000Z',
    body: null,
    featured_image: null,
    ...overrides,
  };
}

/** One `content_media` row, named the way the suite refers to it. */
function mediaRow(overrides: Partial<ContentMediaRow> = {}): ContentMediaRow {
  const path = overrides.path ?? 'content/42-abc.jpg';
  return {
    id: 'test-id',
    content_id: 42,
    name: 'hero.jpg',
    path,
    url: `https://test.supabase.co/storage/v1/object/public/media/${path}`,
    mime_type: 'image/jpeg',
    size: 102400,
    width: 800,
    height: 600,
    alt_text: null,
    caption: null,
    folder: 'content',
    sort_order: 0,
    created_at: '2026-01-01T00:00:01.000Z',
    updated_at: '2026-01-01T00:00:01.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockRequireAdmin.mockReset();
  mockRequireAdmin.mockResolvedValue({
    adminClient: {
      ...createMockAdminClient({}),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
    },
  });
  storageMocks = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
});

describe('content-media actions', () => {
  describe('getContentMedia', () => {
    it('returns media items ordered by sort_order then created_at', async () => {
      const { getContentMedia } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: {
          rows: [mediaRow({ id: 'late', sort_order: 1 }), mediaRow({ id: 'early', sort_order: 0 })],
        },
      });

      const result = await getContentMedia(42);
      expect(result.items.map((item) => item.id)).toEqual(['early', 'late']);
      expect(result.items[0].sort_order).toBe(0);
    });

    it('throws if content row is unpublished', async () => {
      const { getContentMedia } = await import('@/lib/actions/content-media');
      // A *draft* row, not an absent one: with RLS bypassed by the service
      // key this read matches nothing and answers `{ data: null, error: null }`
      // — the shape the old suite mocked as an error, which is exactly why the
      // gate never fired in production.
      configure({
        content: { rows: [publishedRow(42, { status: 'draft' })] },
        content_media: { rows: [] },
      });

      await expect(getContentMedia(42)).rejects.toThrow('Content row not found or unpublished');
    });

    it('throws if content row does not exist', async () => {
      const { getContentMedia } = await import('@/lib/actions/content-media');
      configure({ content: { rows: [] }, content_media: { rows: [] } });

      await expect(getContentMedia(99)).rejects.toThrow('Content row not found or unpublished');
    });

    it('throws when the media list query fails', async () => {
      const { getContentMedia } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [], error: { message: 'list blew up' } },
      });

      await expect(getContentMedia(42)).rejects.toThrow(
        'Failed to list content media: list blew up'
      );
    });
  });

  describe('createContentMediaRow', () => {
    it('validates input and creates row', async () => {
      const { createContentMediaRow } = await import('@/lib/actions/content-media');
      const input: ContentMediaInsert = {
        content_id: 42,
        name: 'test.jpg',
        path: 'content/42-xyz.jpg',
        url: 'https://test.supabase.co/storage/v1/object/public/media/content/42-xyz.jpg',
        mime_type: 'image/jpeg',
        size: 50000,
        width: 800,
        height: 600,
        alt_text: 'Alt',
        caption: 'Caption',
        folder: 'content',
        sort_order: 5,
      };
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [], insert: { id: 'new-id' } },
      });

      const result = await createContentMediaRow(input);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('new-id');
      expect(result.data?.sort_order).toBe(5);
    });

    it('rejects invalid input', async () => {
      const { createContentMediaRow } = await import('@/lib/actions/content-media');
      const result = await createContentMediaRow({
        content_id: -1,
      } as unknown as ContentMediaInsert);
      expect(result.success).toBe(false);
      expect(result.error).toContain('content_id');
    });

    it('reports an insert failure', async () => {
      const { createContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [], error: { message: 'insert blew up' } },
      });

      const result = await createContentMediaRow({
        content_id: 42,
        name: 'test.jpg',
        path: 'content/42-xyz.jpg',
        url: 'https://test.supabase.co/storage/v1/object/public/media/content/42-xyz.jpg',
        mime_type: 'image/jpeg',
        size: 50000,
        width: 800,
        height: 600,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('insert blew up');
    });

    it('refuses a draft content row', async () => {
      const { createContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42, { status: 'draft' })] },
        content_media: { rows: [] },
      });

      // A refused write throws — `assertContentPublished` is not caught inside
      // the action, and the caller (a server action's client) surfaces the
      // message. Asserting a structured `{ success: false }` here would be
      // asserting a path the action does not have.
      await expect(
        createContentMediaRow({
          content_id: 42,
          name: 'test.jpg',
          path: 'content/42-xyz.jpg',
          url: 'https://test.supabase.co/storage/v1/object/public/media/content/42-xyz.jpg',
          mime_type: 'image/jpeg',
          size: 50000,
          width: 800,
          height: 600,
        })
      ).rejects.toThrow('Content row not found or unpublished');
    });
  });

  describe('updateContentMediaRow', () => {
    it('updates alt_text and caption', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [mediaRow({ id: 'test-id', content_id: 42 })] },
      });

      const result = await updateContentMediaRow('test-id', {
        alt_text: 'New alt',
        caption: 'New caption',
      });
      expect(result.success).toBe(true);
      expect(result.data?.alt_text).toBe('New alt');
      expect(result.data?.caption).toBe('New caption');
    });

    it('rejects invalid patch', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      const result = await updateContentMediaRow('id', { sort_order: -1 });
      expect(result.success).toBe(false);
    });

    it('returns not found if row missing', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      configure({ content: { rows: [publishedRow(42)] }, content_media: { rows: [] } });

      const result = await updateContentMediaRow('missing', { alt_text: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Media row not found');
    });

    it('reports a fetch failure', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: {
          rows: [mediaRow({ id: 'test-id', content_id: 42 })],
          error: { message: 'fetch blew up' },
        },
      });

      const result = await updateContentMediaRow('test-id', { alt_text: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('fetch blew up');
    });
  });

  describe('deleteContentMediaRow', () => {
    const REFERENCED_PATH = 'content/42-abc.jpg';

    it('deletes when path has no other references', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      const { remove } = configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [mediaRow({ id: 'test-id', path: REFERENCED_PATH })] },
        content_revisions: { rows: [] },
      });

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(true);
      expect(remove).toHaveBeenCalledWith([REFERENCED_PATH]);
    });

    it('blocks delete when path in content.body', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: {
          rows: [
            publishedRow(42, {
              body: `<p><img src="https://test.supabase.co/storage/v1/object/public/media/${REFERENCED_PATH}" /></p>`,
            }),
          ],
        },
        content_media: { rows: [mediaRow({ id: 'test-id', path: REFERENCED_PATH })] },
        content_revisions: { rows: [] },
      });

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('content body');
      expect(result.data?.retained).toBe('referenced');
    });

    it('blocks delete when path is featured_image', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: {
          rows: [
            publishedRow(42, {
              featured_image: `https://test.supabase.co/storage/v1/object/public/media/${REFERENCED_PATH}`,
            }),
          ],
        },
        content_media: { rows: [mediaRow({ id: 'test-id', path: REFERENCED_PATH })] },
        content_revisions: { rows: [] },
      });

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('featured_image');
    });

    it('blocks delete when path is referenced by a revision', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [mediaRow({ id: 'test-id', path: REFERENCED_PATH })] },
        content_revisions: {
          rows: [
            {
              id: 1,
              body: `<img src="https://test.supabase.co/storage/v1/object/public/media/${REFERENCED_PATH}">`,
            },
          ],
        },
      });

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('content revisions');
    });

    it('surfaces a storage failure rather than deleting the row', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      configure(
        {
          content: { rows: [publishedRow(42)] },
          content_media: { rows: [mediaRow({ id: 'test-id', path: REFERENCED_PATH })] },
          content_revisions: { rows: [] },
        },
        { remove: { error: { message: 'bucket unavailable' } } }
      );

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('bucket unavailable');
    });

    it('returns not found if the media row is gone', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [] },
        content_revisions: { rows: [] },
      });

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Media row not found');
    });

    it('reports a fetch failure', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: {
          rows: [mediaRow({ id: 'test-id', path: REFERENCED_PATH })],
          error: { message: 'fetch blew up' },
        },
        content_revisions: { rows: [] },
      });

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('fetch blew up');
    });
  });

  describe('uploadAndCreateContentMedia', () => {
    it('uploads file and creates row', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      const { upload } = configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [], insert: { id: 'new-media' } },
      });

      const file = new File(['test'], 'hero.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success, result.error ?? 'no error').toBe(true);
      expect(result.data?.id).toBe('new-media');
      // The path carries a random suffix, so the prefix is the contract: the
      // row's url is derived from the storage path it was written to.
      expect(result.data?.path).toMatch(/^content\/42-[0-9a-f]{8}\.jpg$/);
      expect(result.data?.url).toBe(
        `https://test.supabase.co/storage/v1/object/public/media/${result.data?.path}`
      );
      expect(upload).toHaveBeenCalledTimes(1);
      expect(storageMocks.remove).not.toHaveBeenCalled();
    });

    it('rejects non-image files', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      configure({ content: { rows: [publishedRow(42)] }, content_media: { rows: [] } });

      const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only JPEG, PNG, WebP, GIF');
      expect(storageMocks.upload).not.toHaveBeenCalled();
    });

    it('rejects oversized files', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      configure({ content: { rows: [publishedRow(42)] }, content_media: { rows: [] } });

      const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.jpg', {
        type: 'image/jpeg',
      });
      const formData = new FormData();
      formData.append('file', bigFile);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('5 MB');
    });

    it('refuses a draft content row', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      configure({
        content: { rows: [publishedRow(42, { status: 'draft' })] },
        content_media: { rows: [] },
      });

      const file = new File(['test'], 'hero.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      await expect(uploadAndCreateContentMedia(formData, 42)).rejects.toThrow(
        'Content row not found or unpublished'
      );
      expect(storageMocks.upload).not.toHaveBeenCalled();
    });

    it('rejects a missing file', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      configure({ content: { rows: [publishedRow(42)] }, content_media: { rows: [] } });

      const result = await uploadAndCreateContentMedia(new FormData(), 42);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No file provided');
      expect(storageMocks.upload).not.toHaveBeenCalled();
    });

    it('surfaces a storage upload failure', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      configure(
        {
          content: { rows: [publishedRow(42)] },
          content_media: { rows: [], insert: { id: 'new-media' } },
        },
        { upload: { error: { message: 'disk full' } } }
      );

      const file = new File(['test'], 'hero.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('disk full');
    });

    it('stores null dimensions when the image cannot be measured', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      const { measureImageSize } = await import('@/lib/image-size');
      vi.mocked(measureImageSize).mockReturnValueOnce(null);
      configure({
        content: { rows: [publishedRow(42)] },
        content_media: { rows: [], insert: { id: 'new-media' } },
      });

      const file = new File(['test'], 'hero.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success, result.error ?? 'no error').toBe(true);
      expect(result.data?.width).toBeNull();
      expect(result.data?.height).toBeNull();
    });
  });
});
