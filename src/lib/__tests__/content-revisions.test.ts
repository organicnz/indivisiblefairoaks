import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { restoreContentRevision } = await import('@/lib/actions/content');
const { createMockAdminClient, touchUpdatedAt } = await import('./supabase-mock');

const HERO = 'https://indivisiblefairoaks.org/media/hero.jpg';

/**
 * The row a restore writes back to. Separate from the revision being restored,
 * because conflating them is how a test ends up asserting the restore copied
 * the *current* state instead of the historic one.
 */
const contentRow: Record<string, unknown> = {
  id: 7,
  slug: 'test-page',
  title: 'Current title',
  body: '<p>Current</p>',
  status: 'draft',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const revisionRow: Record<string, unknown> = {
  id: 99,
  content_id: 7,
  title: 'Test page',
  slug: 'test-page',
  body: '<p>Hello</p>',
  excerpt: null,
  type: 'page',
  status: 'draft',
  featured_image: HERO,
  metadata: {},
  created_at: new Date().toISOString(),
  created_by: null,
  published_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Restores are stateful per-revision; reset the two fields these tests vary.
  revisionRow.status = 'draft';
  revisionRow.published_at = null;
  contentRow.updated_at = '2026-01-01T00:00:00.000Z';
  requireAdmin.mockResolvedValue({
    adminClient: createMockAdminClient({
      content_revisions: { rows: [revisionRow] },
      content: { rows: [contentRow], onUpdate: touchUpdatedAt() },
    }),
  });
});

describe('restoreContentRevision', () => {
  it('writes the revision hero back instead of clearing it', async () => {
    const result = await restoreContentRevision(7, 99);

    expect(result).toMatchObject({ success: true });
    expect(contentRow.featured_image).toBe(HERO);
  });

  /**
   * Restoring a revision must not re-date the post.
   *
   * `saveContent` re-stamps `published_at = now()` whenever a published page is
   * written without one, so a restore that omitted the date re-dated a March
   * post to today and jumped it to the top of `/news`. `setContentStatus` was
   * written specifically to stop un-publishing from reordering the feed, and
   * this routed straight around it. `content_revisions.published_at` arrives via
   * migration 20260930120000.
   */
  it('restores the publish date rather than re-stamping it as today', async () => {
    revisionRow.status = 'publish';
    revisionRow.published_at = '2026-03-14T18:00:00.000Z';

    const result = await restoreContentRevision(7, 99);

    expect(result).toMatchObject({ success: true });
    expect(contentRow.published_at).toBe('2026-03-14T18:00:00.000Z');
    // The absence of a fresh "now" is the whole point: anything else here would
    // put a restored March post at the top of the news feed.
    expect(contentRow.published_at).not.toBe(undefined);
  });

  it('leaves published_at alone for a draft, which has no date to keep', async () => {
    revisionRow.status = 'draft';
    revisionRow.published_at = null;

    const result = await restoreContentRevision(7, 99);

    expect(result).toMatchObject({ success: true });
    expect(contentRow.published_at).toBeNull();
  });
});
