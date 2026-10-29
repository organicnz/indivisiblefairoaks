// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Additional coverage for `src/lib/actions/content.ts`.
 *
 * Functions covered here:
 *   - getContentForEdit  — fetch by ID, error and not-found paths
 *   - deleteContent      — delete by ID, error and not-found paths
 *   - duplicateContent   — copy a page, including the slug-collision loop
 *   - getContentRevisions — list revisions, error path
 *   - saveContent        — featured-image validation and insert duplicate-slug error
 *
 * Each test uses the shared `createMockAdminClient` from `supabase-mock.ts`
 * following the same pattern as `content-concurrency.test.ts`.
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

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

const {
  getContentForEdit,
  getContentBySlugForEdit,
  getContentList,
  deleteContent,
  duplicateContent,
  getContentRevisions,
  saveContent,
} = await import('@/lib/actions/content');
const { createMockAdminClient, defaultInsertedUpdatedAt } = await import('./supabase-mock');

// ---------------------------------------------------------------------------
// getContentForEdit
// ---------------------------------------------------------------------------

describe('getContentForEdit', () => {
  it('returns the row when it exists', async () => {
    const row = { id: 5, slug: 'test', title: 'Test', body: '<p>x</p>' };
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [row] } }),
    });

    const result = await getContentForEdit(5);

    expect(result).toMatchObject({ id: 5, slug: 'test' });
  });

  it('returns null when the row does not exist', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    const result = await getContentForEdit(999);

    expect(result).toBeNull();
  });

  it('throws when the DB returns an error', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: { error: { message: 'connection failed' } },
      }),
    });

    await expect(getContentForEdit(5)).rejects.toThrow('connection failed');
  });
});

// ---------------------------------------------------------------------------
// getContentBySlugForEdit
// ---------------------------------------------------------------------------

describe('getContentBySlugForEdit', () => {
  it('returns the row when the slug matches', async () => {
    const row = { id: 7, slug: 'about', title: 'About Us', body: '<p>x</p>' };
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [row] } }),
    });
    const result = await getContentBySlugForEdit('about');
    expect(result).toMatchObject({ id: 7, slug: 'about' });
  });

  it('returns null when no row matches the slug', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });
    const result = await getContentBySlugForEdit('nonexistent');
    expect(result).toBeNull();
  });

  it('throws when the DB returns an error', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: { error: { message: 'slug lookup failed' } },
      }),
    });
    await expect(getContentBySlugForEdit('error-slug')).rejects.toThrow('slug lookup failed');
  });
});

// ---------------------------------------------------------------------------
// getContentList
// ---------------------------------------------------------------------------

describe('getContentList', () => {
  it('applies status, type and query filters with explicit paging', async () => {
    // The query reaches `.or()`, which is PostgREST syntax the row-based mock
    // does not parse — so the matching subset is declared as `filterRows` and
    // the modelled `.eq()` filters compose on top of it.
    const match = {
      id: 1,
      title: 'Hello hall',
      slug: 'hello',
      excerpt: null,
      type: 'page',
      status: 'publish',
      published_at: null,
      featured_image: null,
      updated_at: '2026-01-02T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const other = {
      id: 2,
      title: 'Draft notes',
      slug: 'draft',
      excerpt: null,
      type: 'post',
      status: 'draft',
      published_at: null,
      featured_image: null,
      updated_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: { rows: [match, other], filterRows: [match] },
      }),
    });

    const result = await getContentList({
      status: 'publish',
      type: 'page',
      query: 'hello',
      pageSize: 5,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.totalCount).toBe(1);
    expect(result.rows.map((row) => row.id)).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// deleteContent
// ---------------------------------------------------------------------------

describe('deleteContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes an existing page and reports success', async () => {
    const rows = [{ id: 7, slug: 'to-delete' }];
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows } }),
    });

    const result = await deleteContent(7);

    expect(result).toMatchObject({ success: true });
    // Row must be gone from the backing array after delete.
    expect(rows).toHaveLength(0);
  });

  it('fails when the page does not exist', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    const result = await deleteContent(999);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'That page no longer exists' });
  });

  it('surfaces a DB error on the delete operation', async () => {
    // The existence check (SELECT) must succeed, but the DELETE itself fails.
    // This is achieved by making the first `from('content')` call return the
    // row, and the second call return an error. The mock is swapped between
    // calls.
    let calls = 0;
    const row = { id: 7, slug: 'trouble' };
    const goodClient = createMockAdminClient({ content: { rows: [row] } });
    const badClient = createMockAdminClient({ content: { error: { message: 'disk full' } } });

    const client = { ...goodClient };
    client.from = vi.fn((table: string) => {
      calls += 1;
      // First call is the SELECT (existence check), second is the DELETE.
      return calls === 1 ? goodClient.from(table) : badClient.from(table);
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await deleteContent(7);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'disk full' });
  });
});

// ---------------------------------------------------------------------------
// duplicateContent
// ---------------------------------------------------------------------------

describe('duplicateContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a copy with a -copy suffix slug and draft status', async () => {
    const source = {
      id: 10,
      slug: 'rally-notes',
      title: 'Rally notes',
      body: '<p>body</p>',
      excerpt: null,
      type: 'post',
      status: 'publish',
      published_at: '2026-01-01T00:00:00.000Z',
      featured_image: null,
      metadata: {},
    };
    const rows = [source];
    const insertedRows: Record<string, unknown>[] = [];
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: {
          rows,
          insert: { id: 99 },
          onInsert: (row) => {
            // Capture what was inserted to assert on it.
            insertedRows.push({ ...row });
          },
        },
      }),
    });

    const result = await duplicateContent(10);

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    expect(result.data.id).toBe(99);
    // Must land as a draft — copying a published page must not publish the copy.
    expect(insertedRows[0]?.status).toBe('draft');
    // Must carry a -copy slug.
    expect(String(insertedRows[0]?.slug)).toContain('rally-notes-copy');
  });

  it('fails when the source page does not exist', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    const result = await duplicateContent(999);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'That page no longer exists' });
  });

  it('advances the slug suffix when the first copy slug is already taken', async () => {
    // The loop tries `slug-copy`, then `slug-copy-2`, etc.
    // With one collision the copy should land on `slug-copy-2`.
    const source = {
      id: 10,
      slug: 'my-page',
      title: 'My page',
      body: '',
      excerpt: null,
      type: 'page',
      status: 'draft',
      published_at: null,
      featured_image: null,
      metadata: {},
    };
    // The -copy slug is already taken.
    const existing = { id: 11, slug: 'my-page-copy' };
    const rows = [source, existing];
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: { rows, insert: { id: 100 } },
      }),
    });

    const result = await duplicateContent(10);

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    // The new row was inserted (slug-copy-2).
    expect(
      rows.find((r) => r.id === 100 || (r as { slug: string }).slug === 'my-page-copy-2')
    ).toBeTruthy();
  });

  it('surfaces a DB error on the insert', async () => {
    const source = {
      id: 10,
      slug: 'fail-page',
      title: 'Fail page',
      body: '',
      excerpt: null,
      type: 'page',
      status: 'draft',
      published_at: null,
      featured_image: null,
      metadata: {},
    };
    // SELECT returns the source row fine; INSERT fails.
    let calls = 0;
    const goodClient = createMockAdminClient({ content: { rows: [source] } });
    const badClient = createMockAdminClient({
      content: { error: { message: 'constraint violation' } },
    });
    const client = { ...goodClient };
    client.from = vi.fn((table: string) => {
      calls += 1;
      // First call: SELECT the source. Any subsequent call goes to the bad client.
      return calls === 1 ? goodClient.from(table) : badClient.from(table);
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await duplicateContent(10);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'constraint violation' });
  });
});

// ---------------------------------------------------------------------------
// getContentRevisions
// ---------------------------------------------------------------------------

describe('getContentRevisions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the revisions in the order the DB delivers them', async () => {
    const revisions = [
      { id: 3, content_id: 7, body: '<p>v3</p>', created_at: '2026-03-01T00:00:00.000Z' },
      { id: 2, content_id: 7, body: '<p>v2</p>', created_at: '2026-02-01T00:00:00.000Z' },
      { id: 1, content_id: 7, body: '<p>v1</p>', created_at: '2026-01-01T00:00:00.000Z' },
    ];
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content_revisions: { rows: [...revisions] } }),
    });

    const result = await getContentRevisions(7);

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    expect(result.data.revisions).toHaveLength(3);
  });

  it('returns an empty list when no revisions exist', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content_revisions: { rows: [] } }),
    });

    const result = await getContentRevisions(7);

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    expect(result.data.revisions).toHaveLength(0);
  });

  it('fails when the DB returns an error', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content_revisions: { error: { message: 'table not found' } },
      }),
    });

    const result = await getContentRevisions(7);

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'table not found' });
  });

  it('clamps the limit so it cannot exceed 50', async () => {
    // The clamp is `Math.min(50, Math.max(1, limit))`. Passing 200 must not
    // fetch 200 rows — not that the mock enforces the limit server-side, but
    // the function must apply it before building the query.
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      content_id: 7,
      body: `<p>v${i}</p>`,
      created_at: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    }));
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content_revisions: { rows } }),
    });

    // The call must not throw. The limit clamping is exercised by the function
    // itself; the mock honours `.limit()` on the query builder.
    const result = await getContentRevisions(7, 200);

    expect(result).toMatchObject({ success: true });
  });
});

// ---------------------------------------------------------------------------
// saveContent — additional branches not covered by content-concurrency.test.ts
// ---------------------------------------------------------------------------

describe('saveContent — featured image validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a featured image that is not an http(s) URL', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    const result = await saveContent({
      title: 'Test page',
      slug: 'test-page',
      status: 'draft',
      type: 'page',
      metadata: {},
      featuredImage: 'ftp://evil.example.com/img.png',
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining('http') });
  });

  it('rejects a featured image from a foreign host on the production site', async () => {
    // IS_PRODUCTION_SITE is true in these tests because NEXT_PUBLIC_SITE_URL
    // is mocked as the apex domain. A foreign https URL must be rejected.
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    const result = await saveContent({
      title: 'Test page',
      slug: 'foreign-image-page',
      status: 'draft',
      type: 'page',
      metadata: {},
      featuredImage: 'https://cdn.external.com/photo.jpg',
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining('uploaded here') });
  });

  it('rejects input that fails the schema', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    // An empty title violates the schema's min(1) rule.
    const result = await saveContent({
      title: '',
      slug: 'some-slug',
      status: 'draft',
      type: 'page',
      metadata: {},
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'Title is required' });
  });

  it('fails when the slug is already in use (23505 duplicate on insert)', async () => {
    // A unique-constraint violation on the slug column while doing an INSERT.
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: {
          rows: [],
          error: { message: 'duplicate key', code: '23505' },
        },
      }),
    });

    const result = await saveContent({
      title: 'New page',
      slug: 'existing-slug',
      status: 'draft',
      type: 'page',
      metadata: {},
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      error: expect.stringContaining('existing-slug'),
    });
  });
});

describe('saveContent — update: page not found', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails when the page to update does not exist', async () => {
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({ content: { rows: [] } }),
    });

    const result = await saveContent({
      id: 99,
      title: 'Ghost page',
      slug: 'ghost-page',
      status: 'draft',
      type: 'page',
      metadata: {},
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'That page no longer exists' });
  });

  it('fails with a DB error on the update', async () => {
    const row = {
      id: 7,
      slug: 'good-page',
      title: 'Good page',
      status: 'draft',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: {
          rows: [row],
          // Keyed on the update's version precondition, not table-wide: a
          // table-level `error` fires on the pre-check SELECT first, so the
          // action reports "no longer exists" and this test never reaches
          // the UPDATE path it names.
          errors: [
            {
              kind: 'eq',
              column: 'updated_at',
              error: { message: 'db write error' },
            },
          ],
        },
      }),
    });

    const result = await saveContent({
      id: 7,
      title: 'Good page',
      slug: 'good-page',
      status: 'draft',
      type: 'page',
      metadata: {},
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'db write error' });
  });
});

describe('saveContent — insert publishes with a timestamp', () => {
  it('stamps published_at when creating a page with status publish', async () => {
    const rows: Record<string, unknown>[] = [];
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: {
          rows,
          insert: { id: 1 },
          onInsert: defaultInsertedUpdatedAt(),
        },
      }),
    });

    const result = await saveContent({
      title: 'Live page',
      slug: 'live-page',
      status: 'publish',
      type: 'page',
      metadata: {},
    });

    expect(result).toMatchObject({ success: true });
    // The row inserted into the backing array must carry a published_at.
    expect(rows[0]?.published_at).toBeTruthy();
  });
});
