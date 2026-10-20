// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Optimistic concurrency on the content editor.
 *
 * Two organizers editing one page is the normal case for a volunteer group, and
 * the editor was last-write-wins: the second save discarded the first one's work
 * with no signal, on the one surface whose entire purpose is to look after
 * written work. The revision history made it *recoverable*, which is a poor
 * consolation for an author who never learns they overwrote anyone.
 *
 * The guard is a precondition: the editor sends the `updated_at` it loaded, and
 * the UPDATE only matches if the row still carries it. These tests cover the
 * three things that can go wrong with a precondition of this shape — and all
 * three fail *silently*, which is why they need to exist.
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

const { saveContent } = await import('@/lib/actions/content');
const { createMockAdminClient, defaultInsertedUpdatedAt, touchUpdatedAt } = await import(
  './supabase-mock'
);

/** The version the editor loaded, and therefore the one it will claim. */
const LOADED_AT = '2026-05-01T09:00:00.000Z';

let row: Record<string, unknown>;

const edit = {
  id: 7,
  title: 'Town hall recap',
  slug: 'town-hall-recap',
  body: '<p>Notes</p>',
  type: 'page' as const,
  status: 'draft' as const,
  metadata: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  row = {
    id: 7,
    slug: 'town-hall-recap',
    title: 'Town hall recap',
    body: '<p>Notes</p>',
    status: 'draft',
    // The other organizer is mid-edit: the loaded version is already stale
    // before our first save in some of these tests.
    updated_at: LOADED_AT,
  };
  requireAdmin.mockResolvedValue({
    adminClient: createMockAdminClient({
      content: {
        rows: [row],
        onUpdate: touchUpdatedAt(),
        onInsert: defaultInsertedUpdatedAt(),
      },
    }),
  });
});

describe('saveContent, concurrent edits', () => {
  it('writes when the row still carries the version the editor loaded', async () => {
    const result = await saveContent({ ...edit, expectedUpdatedAt: LOADED_AT });

    expect(result).toMatchObject({ success: true });
    expect(row.title).toBe('Town hall recap');
  });

  it('refuses when a colleague saved in between, and writes nothing', async () => {
    // The colleague's save moves the version. This is the whole feature.
    row.updated_at = '2026-05-01T10:15:00.000Z';

    const result = await saveContent({
      ...edit,
      title: 'My rewrite',
      expectedUpdatedAt: LOADED_AT,
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      error: expect.stringContaining('Someone else saved this page'),
    });
    // Not merely refused: refused *without touching the row*. A guard that
    // reported the conflict and then overwrote anyway would be worse than none.
    expect(row.title).toBe('Town hall recap');
    expect(row.updated_at).toBe('2026-05-01T10:15:00.000Z');
  });

  it('returns the version it wrote, so the next save is not a conflict with itself', async () => {
    const first = await saveContent({ ...edit, expectedUpdatedAt: LOADED_AT });
    expect(first.success).toBe(true);
    if (!first.success) return;

    // The editor has to learn the new version from the response. Generating a
    // timestamp in JavaScript instead would be a second clock disagreeing with
    // the trigger's, and the guard would fire against the author's own work.
    expect(first.data.updatedAt).toBe(row.updated_at);
    expect(first.data.updatedAt).not.toBe(LOADED_AT);

    // Consecutive saves — which is exactly what autosave does every 2.5s — must
    // keep succeeding. A guard that made the second save fail would be worse
    // than no guard, because it would block the author who was not in conflict.
    const second = await saveContent({ ...edit, expectedUpdatedAt: first.data.updatedAt });
    expect(second).toMatchObject({ success: true });

    const third = await saveContent({
      ...edit,
      expectedUpdatedAt: second.success ? second.data.updatedAt : null,
    });
    expect(third).toMatchObject({ success: true });
  });

  it('gives two editors the same version, so only the second one is refused', async () => {
    const colleague = await saveContent({
      ...edit,
      title: 'Colleague first',
      expectedUpdatedAt: LOADED_AT,
    });
    expect(colleague).toMatchObject({ success: true });

    // The second editor is still holding the version they loaded.
    const mine = await saveContent({
      ...edit,
      title: 'Mine second',
      expectedUpdatedAt: LOADED_AT,
    });
    expect(mine.success).toBe(false);
    expect(row.title).toBe('Colleague first');
  });

  it('writes with no precondition, so a caller that does not know the version is not locked out', async () => {
    // Restore, tests, and anything older than the guard. Omitting the argument
    // must mean "no precondition", not "assert the row has no timestamp".
    row.updated_at = '2026-05-02T11:00:00.000Z';
    const result = await saveContent({ ...edit, expectedUpdatedAt: undefined });
    expect(result).toMatchObject({ success: true });
    expect(row.title).toBe('Town hall recap');
  });

  it('matches a null version with .is(), not .eq()', async () => {
    // A row whose `updated_at` was never set — possible for anything inserted
    // before the trigger existed. `.eq('updated_at', null)` is `updated_at=eq.null`
    // in PostgREST, which matches *nothing*, so a guard written that way would
    // report a conflict for a page nobody else had touched. `.is()` is the
    // null-aware form, and the two are not interchangeable.
    row.updated_at = null;

    const matching = await saveContent({ ...edit, expectedUpdatedAt: null });
    expect(matching).toMatchObject({ success: true });

    // And now that the trigger has stamped it, a stale null claim must fail
    // rather than quietly overwrite.
    const stale = await saveContent({
      ...edit,
      title: 'Overwriting',
      expectedUpdatedAt: null,
    });
    expect(stale.success).toBe(false);
    expect(row.title).toBe('Town hall recap');
  });

  it('reports a deleted page as a conflict rather than as a silent no-op', async () => {
    // The row is gone. `maybeSingle()` returns null for the write, and the
    // author is told to reload — which is the correct instruction whether it was
    // deleted or overwritten, and vastly better than a success message for a
    // write that did nothing.
    // Emptied in place: the mock captured this object when it was created, so
    // reassigning the local would leave it serving a row that no longer exists.
    for (const key of Object.keys(row)) delete row[key];

    const result = await saveContent({ ...edit, expectedUpdatedAt: LOADED_AT });
    expect(result.success).toBe(false);
  });

  it('creates without claiming a version, so a new page never conflicts with itself', async () => {
    const result = await saveContent({
      ...edit,
      id: undefined,
      title: 'Brand new page',
      slug: 'brand-new-page',
    });

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    // Returned for the same reason as on update: the editor keeps it as the
    // precondition for the next write, so the first autosave after creating a
    // page does not collide with the insert that created it.
    expect(result.data.updatedAt).toBeTruthy();
  });
});

/**
 * "Did that write actually happen?"
 *
 * A distinct failure from a precondition conflict, and it is quieter. PostgREST
 * reports an UPDATE that matched no rows as `error: null` — indistinguishable from
 * success unless the row is asked for. So an action can validate, report
 * success, revalidate a cache for a page, and show an author a "Published" toast
 * having changed nothing.
 *
 * `setContentStatus` read the row, then wrote it back with a bare
 * `.update(...).eq('id', id)`. The CRM's own `setCRMTaskStatus` and
 * `deleteCRMTask` both ask for the row back; this one did not, which is what
 * makes it an oversight rather than a decision.
 */
const { setContentStatus } = await import('@/lib/actions/content');

describe('setContentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    row = {
      id: 7,
      slug: 'town-hall-recap',
      title: 'Town hall recap',
      status: 'draft',
      published_at: null,
      updated_at: LOADED_AT,
    };
    requireAdmin.mockResolvedValue({
      adminClient: createMockAdminClient({
        content: { rows: [row], onUpdate: touchUpdatedAt() },
      }),
    });
  });

  it('publishes, and reports the version it wrote', async () => {
    const result = await setContentStatus(7, 'publish');

    expect(result).toMatchObject({ success: true });
    expect(row.status).toBe('publish');
  });

  it('keeps the original publication date when un-publishing', async () => {
    // Un-publishing a draft must not bump a restored post back to the top of
    // `/news`. `setContentStatus` exists for exactly this.
    row.status = 'publish';
    row.published_at = '2026-03-14T18:00:00.000Z';

    const result = await setContentStatus(7, 'draft');

    expect(result).toMatchObject({ success: true });
    expect(row.published_at).toBe('2026-03-14T18:00:00.000Z');
    expect(row.status).toBe('draft');
  });

  it('fails rather than reporting success when the write matched no row', async () => {
    // The row is read successfully, then deleted, then written. Without
    // `.select()` on the UPDATE the write is invisible and this returns
    // `success: true` — and the author is told the page was published.
    //
    // The row is emptied on the *second* `from('content')` call, which is the
    // write. Emptying it on the first would make the existence check fail, and
    // the test would pass while proving nothing about the write.
    let calls = 0;
    const client = createMockAdminClient({
      content: { rows: [row], onUpdate: touchUpdatedAt() },
    });
    const build = client.from;
    client.from = vi.fn((table: string) => {
      calls += 1;
      if (table === 'content' && calls === 2) {
        for (const key of Object.keys(row)) delete row[key];
      }
      return build(table);
    });
    requireAdmin.mockResolvedValue({ adminClient: client });

    const result = await setContentStatus(7, 'publish');

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: 'That page no longer exists' });
  });
});
