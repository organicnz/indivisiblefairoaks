import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const uploadToStorage = vi.hoisted(() => vi.fn());
const fromTable = vi.hoisted(() => vi.fn());

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

const MEDIA_BASE = 'https://project.supabase.co/storage/v1/object/public/media/';

/** Rows a lookup should return, keyed `table` or `table:like` / `table:eq`. */
const refs: Record<string, unknown[]> = {};

/**
 * A PostgREST builder stub. `like` and `eq` are what tell the three reference
 * queries apart, so it records which one was used, and `limit` is terminal: the
 * action always ends each query with `.limit(1)`, so that is where the promise
 * comes from. Resolving there rather than implementing `then` keeps this a plain
 * object — a thenable would need a `then` member, which Biome's `noThenProperty`
 * reads as a promise with a missing rejection callback.
 */
class ReferenceBuilder {
  private mode = '';

  constructor(private readonly table: string) {}

  select = vi.fn(() => this);
  like = vi.fn(() => {
    this.mode = 'like';
    return this;
  });
  eq = vi.fn(() => {
    this.mode = 'eq';
    return this;
  });
  limit = vi.fn(() =>
    Promise.resolve({ data: refs[`${this.table}:${this.mode}`] ?? [], error: null })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(refs)) delete refs[key];
  requireAdmin.mockResolvedValue({
    adminClient: {
      storage: { from: () => ({ remove, upload: uploadToStorage }) },
      from: fromTable,
    },
  });
  uploadToStorage.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  fromTable.mockImplementation((table: string) => new ReferenceBuilder(table));
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
    refs['content:like'] = [{ id: 3 }];
    expect(await deleteContentImage(`${MEDIA_BASE}content/shared.png`)).toEqual({
      deleted: false,
      retained: 'referenced',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps a file that is still a featured image', async () => {
    refs['content:eq'] = [{ id: 4 }];
    expect(await deleteContentImage(`${MEDIA_BASE}content/hero.png`)).toEqual({
      deleted: false,
      retained: 'referenced',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps a file a revision points at, so a restore cannot 404', async () => {
    // The subtle one: no live row references the file, but a revision does, and
    // removing it would break the only route back from a bad publish.
    refs['content_revisions:like'] = [{ id: 11 }];
    expect(await deleteContentImage(`${MEDIA_BASE}content/old.png`)).toEqual({
      deleted: false,
      retained: 'referenced',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('reports a storage error without claiming the file is gone', async () => {
    remove.mockResolvedValue({ error: { message: 'nope' } });
    expect(await deleteContentImage(`${MEDIA_BASE}content/x.png`)).toEqual({ deleted: false });
  });
});
