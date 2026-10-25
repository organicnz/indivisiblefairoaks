// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for `uploadContentImage` and `deleteContentImage` in
 * `src/lib/actions/content.ts`.
 *
 * Both functions were entirely uncovered. This file covers all 8 branches of
 * `deleteContentImage` and all 6 branches of `uploadContentImage`.
 */

const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [], set: vi.fn() })),
}));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'https://indivisiblefairoaks.org',
  },
}));
vi.mock('@/lib/supabase', () => ({
  getStorageUrl: (path: string) =>
    `https://project.supabase.co/storage/v1/object/public/media/${path}`,
}));
vi.mock('@/lib/image-size', () => ({
  measureImageSize: vi.fn(() => ({ width: 800, height: 600 })),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

const { uploadContentImage, deleteContentImage, saveContent, restoreContentRevision } =
  await import('@/lib/actions/content');
const { createMockAdminClient: createMockClient, defaultInsertedUpdatedAt } = await import(
  './supabase-mock'
);

// ---------------------------------------------------------------------------
// Storage URL constants used throughout both suites
// ---------------------------------------------------------------------------

/** The storage base that `deleteContentImage` computes from `env`. */
const BASE = 'https://project.supabase.co/storage/v1/object/public/media/';

/** A path that satisfies every guard in `deleteContentImage`. */
const SAFE_PATH = 'content/rally-abc12345.jpg';

/** The full public URL for `SAFE_PATH`. */
const SAFE_URL = `${BASE}${SAFE_PATH}`;

// ---------------------------------------------------------------------------
// Helper: build an adminClient with a storage stub attached
// ---------------------------------------------------------------------------

function makeClient(
  tables: Parameters<typeof createMockClient>[0],
  storage: { upload?: ReturnType<typeof vi.fn>; remove?: ReturnType<typeof vi.fn> } = {}
) {
  const upload = storage.upload ?? vi.fn().mockResolvedValue({ error: null });
  const remove = storage.remove ?? vi.fn().mockResolvedValue({ error: null });
  const base = createMockClient(tables);
  return {
    ...base,
    storage: { from: vi.fn(() => ({ upload, remove })) },
    _storageMocks: { upload, remove },
  };
}

// ---------------------------------------------------------------------------
// deleteContentImage — 8 branches
// ---------------------------------------------------------------------------

describe('deleteContentImage', () => {
  beforeEach(() => vi.clearAllMocks());

  // (a) Non-storage URL — foreign host
  it('(a) returns retained:foreign for a URL that does not start with the storage base', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContentImage('https://external.example.com/img.jpg');

    expect(result).toEqual({ deleted: false, retained: 'foreign' });
    // Storage must not be touched at all.
    expect(client._storageMocks.remove).not.toHaveBeenCalled();
  });

  // (b) URL from our bucket but path does not start with `content/`
  it('(b) returns retained:foreign for a path outside the content/ prefix', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    // A valid storage URL, but pointing at a non-content folder
    const url = `${BASE}products/hero-123.png`;
    const result = await deleteContentImage(url);

    expect(result).toEqual({ deleted: false, retained: 'foreign' });
    expect(client._storageMocks.remove).not.toHaveBeenCalled();
  });

  // (c) Path traversal — contains `..`
  it('(c) returns retained:foreign when the path contains ..', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const url = `${BASE}content/../sensitive/secret.jpg`;
    const result = await deleteContentImage(url);

    expect(result).toEqual({ deleted: false, retained: 'foreign' });
    expect(client._storageMocks.remove).not.toHaveBeenCalled();
  });

  // (d) Path referenced in content.body
  it('(d) returns retained:referenced when path appears in content.body', async () => {
    const client = makeClient({
      content: {
        rows: [
          { id: 1, body: `<img src="${SAFE_URL}">`, featured_image: null },
          { id: 2, body: '<p>other</p>', featured_image: null },
        ],
      },
      content_revisions: { rows: [] },
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContentImage(SAFE_URL);

    expect(result).toEqual({ deleted: false, retained: 'referenced' });
    expect(client._storageMocks.remove).not.toHaveBeenCalled();
  });

  // (e) Path referenced as content.featured_image
  it('(e) returns retained:referenced when URL matches content.featured_image', async () => {
    const client = makeClient({
      content: {
        rows: [{ id: 1, body: null, featured_image: SAFE_URL }],
      },
      content_revisions: { rows: [] },
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContentImage(SAFE_URL);

    expect(result).toEqual({ deleted: false, retained: 'referenced' });
    expect(client._storageMocks.remove).not.toHaveBeenCalled();
  });

  // (f) Path referenced in content_revisions.body
  it('(f) returns retained:referenced when path appears in content_revisions.body', async () => {
    const client = makeClient({
      content: {
        // Live content has no reference — so the check reaches revisions
        rows: [{ id: 1, body: '<p>no image here</p>', featured_image: null }],
      },
      content_revisions: {
        rows: [{ id: 99, content_id: 1, body: `<img src="${SAFE_URL}">` }],
      },
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContentImage(SAFE_URL);

    expect(result).toEqual({ deleted: false, retained: 'referenced' });
    expect(client._storageMocks.remove).not.toHaveBeenCalled();
  });

  // (g) Unreferenced — storage remove succeeds
  it('(g) deletes and returns deleted:true when the path is unreferenced', async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    const client = makeClient(
      {
        content: { rows: [{ id: 1, body: null, featured_image: null }] },
        content_revisions: { rows: [] },
      },
      { remove: removeMock }
    );
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContentImage(SAFE_URL);

    expect(result).toEqual({ deleted: true });
    expect(removeMock).toHaveBeenCalledWith([SAFE_PATH]);
  });

  // (h) Unreferenced — storage remove returns an error
  it('(h) returns deleted:false when storage remove fails', async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: { message: 'bucket unavailable' } });
    const client = makeClient(
      {
        content: { rows: [] },
        content_revisions: { rows: [] },
      },
      { remove: removeMock }
    );
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContentImage(SAFE_URL);

    expect(result).toEqual({ deleted: false });
    expect(removeMock).toHaveBeenCalledWith([SAFE_PATH]);
  });
});

// ---------------------------------------------------------------------------
// uploadContentImage — 6 branches
// ---------------------------------------------------------------------------

describe('uploadContentImage', () => {
  beforeEach(() => vi.clearAllMocks());

  // (a) formData.get('file') is not a File
  it('(a) throws "No file provided" when the form field is missing', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    // No 'file' field at all
    await expect(uploadContentImage(fd)).rejects.toThrow('No file provided');
  });

  it('(a) throws "No file provided" when the form field is a string', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    fd.set('file', 'not-a-file');
    await expect(uploadContentImage(fd)).rejects.toThrow('No file provided');
  });

  // (b) Invalid MIME type
  it('(b) throws for a non-image MIME type such as application/pdf', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    fd.set('file', new File(['content'], 'doc.pdf', { type: 'application/pdf' }));
    await expect(uploadContentImage(fd)).rejects.toThrow(
      'Image must be JPEG, PNG, WebP or GIF. SVG is not allowed.'
    );
    expect(client._storageMocks.upload).not.toHaveBeenCalled();
  });

  it('(b) throws for image/svg+xml even though it starts with "image/"', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    fd.set('file', new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' }));
    await expect(uploadContentImage(fd)).rejects.toThrow(
      'Image must be JPEG, PNG, WebP or GIF. SVG is not allowed.'
    );
  });

  // (c) File over 5MB
  it('(c) throws "Image must be 5MB or smaller" for a 6MB file', async () => {
    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    const fd = new FormData();
    fd.set('file', bigFile);
    await expect(uploadContentImage(fd)).rejects.toThrow('Image must be 5MB or smaller');
    expect(client._storageMocks.upload).not.toHaveBeenCalled();
  });

  // (d) Storage upload error
  it('(d) throws the storage error message when the upload fails', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: { message: 'disk full' } });
    const client = makeClient({}, { upload: uploadMock });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    fd.set('file', new File(['data'], 'photo.jpg', { type: 'image/jpeg' }));
    await expect(uploadContentImage(fd)).rejects.toThrow('disk full');
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  // (e) Happy path — measureImageSize returns dimensions
  it('(e) returns url, width and height on a successful upload', async () => {
    const { measureImageSize } = await import('@/lib/image-size');
    vi.mocked(measureImageSize).mockReturnValue({ width: 800, height: 600 });

    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    fd.set('file', new File(['data'], 'rally.png', { type: 'image/png' }));
    const result = await uploadContentImage(fd);

    expect(result.url).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/media\/content\/rally-[0-9a-f]{8}\.png$/
    );
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(client._storageMocks.upload).toHaveBeenCalledTimes(1);
  });

  // (f) measureImageSize returns null — dimensions come back as null
  it('(f) returns width:null, height:null when the image header is unreadable', async () => {
    const { measureImageSize } = await import('@/lib/image-size');
    vi.mocked(measureImageSize).mockReturnValueOnce(null);

    const client = makeClient({});
    requireAdmin.mockResolvedValue({ adminClient: client });

    const fd = new FormData();
    fd.set('file', new File(['data'], 'photo.webp', { type: 'image/webp' }));
    const result = await uploadContentImage(fd);

    expect(result.url).toContain('/content/');
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveContent — non-23505 insert error (generic DB failure on insert)
// ---------------------------------------------------------------------------

describe('saveContent — non-23505 insert error', () => {
  it('surfaces a generic DB error from a failed insert', async () => {
    // The 23505 branch is already covered in content-actions.test.ts.
    // This covers the fallthrough: a non-constraint error on insert.
    const client = makeClient({});
    // Wire the DB query builder to return an error that is NOT a 23505.
    const base = createMockClient({
      content: { rows: [], error: { message: 'connection reset', code: '08006' } },
    });
    Object.assign(client, base);
    client.from = base.from;
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await saveContent({
      title: 'Insert error page',
      slug: 'insert-error-page',
      status: 'draft',
      type: 'page',
      metadata: {},
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'connection reset' });
  });
});

// ---------------------------------------------------------------------------
// restoreContentRevision — covers lines 438-461
// ---------------------------------------------------------------------------

describe('restoreContentRevision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails when the revision does not exist', async () => {
    const client = makeClient({
      content_revisions: { rows: [] },
      content: { rows: [] },
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await restoreContentRevision(7, 99);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'That revision no longer exists' });
  });

  it('fails when the revision DB query errors', async () => {
    const client = makeClient({
      content_revisions: { error: { message: 'revision query failed' } },
      content: { rows: [] },
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await restoreContentRevision(7, 99);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'revision query failed' });
  });

  it('restores a revision by writing its body back through saveContent', async () => {
    const contentRow = {
      id: 7,
      slug: 'town-hall',
      title: 'Town Hall',
      body: '<p>current</p>',
      status: 'publish',
      type: 'page',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const revisionRow = {
      id: 3,
      content_id: 7,
      title: 'Town Hall',
      slug: 'town-hall',
      body: '<p>old body</p>',
      excerpt: null,
      type: 'page',
      status: 'publish',
      featured_image: null,
      published_at: '2026-01-01T00:00:00.000Z',
      metadata: {},
    };

    // `restoreContentRevision` fetches from `content_revisions`, then calls
    // `saveContent` which does multiple queries against `content`.
    // Wire `requireAdmin` to a client that serves both tables.
    const tableClient = createMockClient({
      content: {
        rows: [contentRow],
        onInsert: defaultInsertedUpdatedAt(),
      },
      content_revisions: { rows: [revisionRow] },
    });
    requireAdmin.mockResolvedValue({ adminClient: tableClient });

    const result = await restoreContentRevision(7, 3);

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    expect(result.data.id).toBe(7);
  });
});
