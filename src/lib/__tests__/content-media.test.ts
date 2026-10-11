import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentMediaRow } from '@/types/content-media';

const mockAdminClient = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

const mockStorageChain = {
  upload: vi.fn(),
  remove: vi.fn(),
};

let mockRequireAdmin: any;
let _mockMeasureImageSize: ReturnType<typeof vi.fn>;
let _mockCryptoRandomValues: ReturnType<typeof vi.fn>;

function createChain() {
  const chain: any = {
    filters: [],
    orders: [],
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn((col: string, val: unknown) => { chain.filters.push({ kind: 'eq', col, val }); return chain; }),
    neq: vi.fn().mockImplementation(() => chain),
    lte: vi.fn((col: string, val: unknown) => { chain.filters.push({ kind: 'lte', col, val }); return chain; }),
    is: vi.fn().mockImplementation(() => chain),
    like: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    ilike: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    delete: vi.fn().mockImplementation(() => chain),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    limit: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    or: vi.fn().mockImplementation(() => chain),
  };
  return chain;
}

function setupMocks() {
  mockRequireAdmin = vi.fn().mockResolvedValue({ adminClient: mockAdminClient });
  mockAdminClient.from.mockReset();
  mockAdminClient.from.mockImplementation(() => {
    const c = createChain();
    // Default: published content exists for assertContentPublished
    c.maybeSingle.mockResolvedValue({ data: { id: 42 }, error: null });
    return c;
  });
  mockAdminClient.storage.from.mockReset();
  mockAdminClient.storage.from.mockImplementation(() => ({ ...mockStorageChain }));
  mockStorageChain.upload.mockReset();
  mockStorageChain.remove.mockReset();
}

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

vi.mock('@/lib/supabase', () => ({
  getStorageUrl: (path: string) =>
    `https://test.supabase.co/storage/v1/object/public/media/${path}`,
}));

vi.mock('@/lib/image-size', () => ({
  measureImageSize: () => ({ width: 800, height: 600 }),
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  },
}));

beforeEach(() => {
  setupMocks();
});

function makeMediaRow(
  overrides: Partial<{ sort_order: number; id: string; path: string; content_id: number }> = {}
): ContentMediaRow {
  return {
    id: overrides.id ?? 'test-id',
    content_id: overrides.content_id ?? 42,
    name: 'hero.jpg',
    path: overrides.path ?? 'content/42-abc123.jpg',
    url: 'https://test.supabase.co/storage/v1/object/public/media/content/42-abc123.jpg',
    mime_type: 'image/jpeg',
    size: 102400,
    width: 800,
    height: 600,
    alt_text: null,
    caption: null,
    folder: 'content',
    sort_order: overrides.sort_order ?? 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('content-media actions', () => {
  describe('getContentMedia', () => {
    it('returns media items ordered by sort_order then created_at', async () => {
      const { getContentMedia } = await import('@/lib/actions/content-media');
      const rows = [makeMediaRow({ sort_order: 1 }), makeMediaRow({ sort_order: 0 })];
      const chain = createChain();
      chain.order.mockReturnThis();
      chain._then.mockImplementation((cb: (res: { data: typeof rows; error: null }) => unknown) =>
        cb({ data: rows, error: null })
      );
      mockAdminClient.from.mockImplementation(() => chain);

      const result = await getContentMedia(42);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].sort_order).toBe(0);
    });

    it('throws if content row is unpublished', async () => {
      const { getContentMedia } = await import('@/lib/actions/content-media');
      const chain = createChain();
      chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
      mockAdminClient.from.mockImplementation(() => chain);

      await expect(getContentMedia(99)).rejects.toThrow('Content row not found or unpublished');
    });
  });

  describe('createContentMediaRow', () => {
    it('validates input and creates row', async () => {
      const { createContentMediaRow } = await import('@/lib/actions/content-media');
      const input = {
        content_id: 42,
        name: 'test.jpg',
        path: 'content/42-xyz.jpg',
        mime_type: 'image/jpeg',
        size: 50000,
        width: 800,
        height: 600,
        alt_text: 'Alt',
        caption: 'Caption',
        folder: 'content',
        sort_order: 5,
      };
      const chain = createChain();
      chain.single.mockResolvedValue({ data: { ...input, id: 'new-id' }, error: null });
      mockAdminClient.from.mockImplementation(() => chain);

      const result = await createContentMediaRow(input as any);
      expect(result.success).toBe(true);
      expect(result.data?.sort_order).toBe(5);
    });

    it('rejects invalid input', async () => {
      const { createContentMediaRow } = await import('@/lib/actions/content-media');
      const result = await createContentMediaRow({ content_id: -1 } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('content_id');
    });
  });

  describe('updateContentMediaRow', () => {
    it('updates alt_text and caption', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      const patch = { alt_text: 'New alt', caption: 'New caption' };
      const chain = createChain();
      chain.maybeSingle.mockResolvedValueOnce({ data: { content_id: 42 }, error: null });
      chain.single.mockResolvedValueOnce({
        data: { id: 'test-id', alt_text: 'New alt', caption: 'New caption' },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => chain);

      const result = await updateContentMediaRow('test-id', patch);
      expect(result.success).toBe(true);
      expect(result.data?.alt_text).toBe('New alt');
    });

    it('rejects invalid patch', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      const result = await updateContentMediaRow('id', { sort_order: -1 } as any);
      expect(result.success).toBe(false);
    });

    it('returns not found if row missing', async () => {
      const { updateContentMediaRow } = await import('@/lib/actions/content-media');
      const chain = createChain();
      chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockAdminClient.from.mockImplementation(() => chain);

      const result = await updateContentMediaRow('missing', { alt_text: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Media row not found');
    });
  });

  describe('deleteContentMediaRow', () => {
    it('deletes when path has no other references', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      const fetchChain = createChain();
      fetchChain.maybeSingle.mockResolvedValueOnce({
        data: { path: 'content/42-abc.jpg', content_id: 42 },
        error: null,
      });

      const checkChain = createChain();
      checkChain.maybeSingle.mockResolvedValue({ data: { id: 42 }, error: null });
      checkChain.ilike.mockResolvedValue({ data: [], error: null });
      checkChain.eq.mockResolvedValue({ data: [], error: null });

      mockAdminClient.from
        .mockImplementationOnce(() => fetchChain)
        .mockImplementation(() => checkChain);

      mockAdminClient.storage.from.mockImplementation(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }));

      const deleteChain = createChain();
      deleteChain.delete.mockResolvedValue({ error: null });
      mockAdminClient.from.mockImplementation(() => deleteChain);

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(true);
    });

    it('blocks delete when path in content.body', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      const fetchChain = createChain();
      fetchChain.maybeSingle.mockResolvedValueOnce({
        data: { path: 'content/42-abc.jpg', content_id: 42 },
        error: null,
      });

      const checkChain = createChain();
      checkChain.ilike.mockResolvedValue({ data: [{ id: 1 }], error: null });

      mockAdminClient.from
        .mockImplementationOnce(() => fetchChain)
        .mockImplementation(() => checkChain);

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('content body');
      expect(result.data?.retained).toBe('referenced');
    });

    it('blocks delete when path is featured_image', async () => {
      const { deleteContentMediaRow } = await import('@/lib/actions/content-media');
      const fetchChain = createChain();
      fetchChain.maybeSingle.mockResolvedValueOnce({
        data: { path: 'content/42-abc.jpg', content_id: 42 },
        error: null,
      });

      const checkChain = createChain();
      checkChain.maybeSingle.mockResolvedValue({ data: { id: 42 }, error: null });
      checkChain.ilike.mockResolvedValue({ data: [], error: null });
      checkChain.eq.mockResolvedValue({ data: [{ id: 1 }], error: null });

      mockAdminClient.from
        .mockImplementationOnce(() => fetchChain)
        .mockImplementation(() => checkChain);

      const result = await deleteContentMediaRow('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('featured_image');
    });
  });

  describe('uploadAndCreateContentMedia', () => {
    it('uploads file and creates row', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      const file = new File(['test'], 'hero.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const chain = createChain();
      // Two assertContentPublished calls (one in uploadAndCreateContentMedia, one in createContentMediaRow)
      chain.maybeSingle.mockResolvedValueOnce({ data: { id: 'c1' }, error: null });
      chain.maybeSingle.mockResolvedValueOnce({ data: { id: 'c1' }, error: null });
      chain.single.mockResolvedValueOnce({ data: { id: 'new-media' }, error: null });
      mockAdminClient.from.mockImplementation(() => chain);
      mockAdminClient.storage.from.mockImplementation(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      }));

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success, result.error ?? 'no error').toBe(true);
    });

    it('rejects non-image files', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      const chain = createChain();
      chain.maybeSingle.mockResolvedValue({ data: { id: 'c1' }, error: null });
      mockAdminClient.from.mockImplementation(() => chain);

      const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only JPEG, PNG, WebP, GIF');
    });

    it('rejects oversized files', async () => {
      const { uploadAndCreateContentMedia } = await import('@/lib/actions/content-media');
      const chain = createChain();
      chain.maybeSingle.mockResolvedValue({ data: { id: 'c1' }, error: null });
      mockAdminClient.from.mockImplementation(() => chain);

      const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.jpg', {
        type: 'image/jpeg',
      });
      const formData = new FormData();
      formData.append('file', bigFile);

      const result = await uploadAndCreateContentMedia(formData, 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('5 MB');
    });
  });
});
