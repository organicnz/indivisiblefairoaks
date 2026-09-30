import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const uploadToStorage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('server-only', () => ({}));

// Reached transitively when this module is imported; the admin client is faked
// below, so the real one only needs to not explode during evaluation.
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [], set: vi.fn() })),
}));

// The storage URL is derived from env, so the bucket base has to be real for
// the "is this our own bucket" check to mean anything.
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'https://indivisiblefairoaks.org',
  },
}));

// `supabase-server.ts` reads process.env directly (not the validated module), and
// it is evaluated during the import below, so these must be set first.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

const { deleteContentImage, uploadContentImage } = await import('@/lib/actions/content');
const { createMockAdminClient } = await import('./supabase-mock');

const MEDIA_BASE = 'https://project.supabase.co/storage/v1/object/public/media/';

/**
 * The rows the reference queries will find.
 *
 * These are **rows, not canned results**, which is the point of moving off the
 * hand-rolled builder: the previous stub returned whatever a test put under
 * `content:like`, so a test passed whether or not the query named the right
 * column or the right value. A `body` that does not actually contain the file
 * path now fails to match, so these tests assert the query as well as the
 * outcome — which is what "checks every reference first" has to mean.
 */
const contentRows: Record<string, unknown>[] = [];
const revisionRows: Record<string, unknown>[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  // Emptied in place, never reassigned: the client is built below and holds
  // these arrays by reference, so `contentRows = [...]` would leave it serving
  // the empty array it captured and every reference check would report "no
  // references" — a false pass on the one thing this file exists to check.
  contentRows.length = 0;
  revisionRows.length = 0;
  requireAdmin.mockResolvedValue({
    adminClient: {
      storage: { from: () => ({ remove, upload: uploadToStorage }) },
      ...createMockAdminClient({
        content: { rows: contentRows },
        content_revisions: { rows: revisionRows },
      }),
    },
  });
  uploadToStorage.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
});

const fileForm = (name: string, type: string, bytes = 8) => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], name, { type }));
  return form;
};

describe('uploadContentImage', () => {
  it('rejects an SVG, which is stored XSS once served from the bucket', async () => {
    await expect(uploadContentImage(fileForm('x.svg', 'image/svg+xml'))).rejects.toThrow(/svg/i);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit', async () => {
    await expect(
      uploadContentImage(fileForm('big.png', 'image/png', 6 * 1024 * 1024))
    ).rejects.toThrow(/5MB/);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('rejects a non-image content type', async () => {
    await expect(uploadContentImage(fileForm('x.sh', 'application/x-sh'))).rejects.toThrow(
      /image/i
    );
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('rejects a form with no file', async () => {
    await expect(uploadContentImage(new FormData())).rejects.toThrow(/no file/i);
  });

  it('uploads under a content path with a random component, never the raw name', async () => {
    const result = await uploadContentImage(fileForm('My Rally Photo.png', 'image/png'));
    const path = uploadToStorage.mock.calls[0][0] as string;
    expect(path).toMatch(/^content\/my-rally-photo-[0-9a-f]{8}\.png$/);
    expect(result.url).toBe(`${MEDIA_BASE}${path}`);
  });

  it('never lets one organiser overwrite another upload of the same filename', async () => {
    const a = await uploadContentImage(fileForm('rally.jpg', 'image/jpeg'));
    const b = await uploadContentImage(fileForm('rally.jpg', 'image/jpeg'));
    expect(a.url).not.toBe(b.url);
    // `upsert: false` is the belt to that braces: the storage layer refuses too.
    for (const call of uploadToStorage.mock.calls) {
      expect(call[2]).toMatchObject({ upsert: false });
    }
  });

  it('surfaces a storage error rather than returning a URL that does not exist', async () => {
    uploadToStorage.mockResolvedValue({ error: { message: 'bucket not found' } });
    await expect(uploadContentImage(fileForm('x.png', 'image/png'))).rejects.toThrow(
      /bucket not found/
    );
  });
});

describe('deleteContentImage', () => {
  it('never touches a URL outside our own media bucket', async () => {
    for (const url of [
      'https://evil.example.com/x.png',
      'https://project.supabase.co/storage/v1/object/public/other-bucket/content/x.png',
    ]) {
      expect(await deleteContentImage(url)).toEqual({ deleted: false, retained: 'foreign' });
    }
    expect(remove).not.toHaveBeenCalled();
  });

  it('never traverses out of the content prefix', async () => {
    expect((await deleteContentImage(`${MEDIA_BASE}content/../../secrets.txt`)).deleted).toBe(
      false
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced upload', async () => {
    expect(await deleteContentImage(`${MEDIA_BASE}content/x.png`)).toEqual({ deleted: true });
    expect(remove).toHaveBeenCalledWith(['content/x.png']);
  });

  it('keeps a file another page body still points at', async () => {
    contentRows.push({ id: 3, body: `<p>See <img src="${MEDIA_BASE}content/shared.png"></p>` });
    expect(await deleteContentImage(`${MEDIA_BASE}content/shared.png`)).toEqual({
      deleted: false,
      retained: 'referenced',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps a file that is still a featured image', async () => {
    contentRows.push({ id: 4, featured_image: `${MEDIA_BASE}content/hero.png` });
    expect(await deleteContentImage(`${MEDIA_BASE}content/hero.png`)).toEqual({
      deleted: false,
      retained: 'referenced',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps a file a revision points at, so a restore cannot 404', async () => {
    // The subtle one: no live row references the file, but a revision does, and
    // removing it would break the only route back from a bad publish.
    revisionRows.push({ id: 11, body: `<img src="${MEDIA_BASE}content/old.png">` });
    expect(await deleteContentImage(`${MEDIA_BASE}content/old.png`)).toEqual({
      deleted: false,
      retained: 'referenced',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes a file no reference actually points at, even when rows exist', async () => {
    // The negative case, and it is the one that makes the three above mean
    // anything. A revision and a page exist, but neither *mentions this file*.
    //
    // Without it, deleting the `like` from a reference query leaves the suite
    // green: an unfiltered `.limit(1)` still matches the rows that are there, so
    // "still referenced" is reported for the wrong reason and a query that checks
    // nothing at all passes as a reference check. A guard that cannot tell
    // "matched the right row" from "matched a row" is not a guard.
    contentRows.push({
      id: 3,
      body: `<p>Unrelated: <img src="${MEDIA_BASE}content/other.png"></p>`,
    });
    revisionRows.push({ id: 11, body: `<img src="${MEDIA_BASE}content/another.png">` });

    expect(await deleteContentImage(`${MEDIA_BASE}content/x.png`)).toEqual({ deleted: true });
    expect(remove).toHaveBeenCalledWith(['content/x.png']);
  });

  it('reports a storage error without claiming the file is gone', async () => {
    remove.mockResolvedValue({ error: { message: 'nope' } });
    expect(await deleteContentImage(`${MEDIA_BASE}content/x.png`)).toEqual({ deleted: false });
  });
});
