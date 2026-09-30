import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
const fromTable = vi.hoisted(() => vi.fn());

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

const HERO = 'https://indivisiblefairoaks.org/media/hero.jpg';

const revisionRow = {
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
};

let updatedRow: Record<string, unknown> | null = null;

/** Minimal PostgREST stub: only the calls `restoreContentRevision` makes. */
class FakeTable {
  private columns = '';
  private filters: Record<string, unknown> = {};

  constructor(private readonly table: string) {}

  select(columns = '') {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  async maybeSingle() {
    if (this.table === 'content_revisions') return { data: revisionRow, error: null };
    if (this.table === 'content') {
      if (this.columns.includes('slug') && 'id' in this.filters) {
        return { data: { slug: 'test-page' }, error: null };
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  update(payload: Record<string, unknown>) {
    updatedRow = payload;
    return { eq: () => Promise.resolve({ error: null }) };
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  updatedRow = null;
  requireAdmin.mockResolvedValue({ adminClient: { from: fromTable } });
  fromTable.mockImplementation((table: string) => new FakeTable(table));
});

describe('restoreContentRevision', () => {
  it('writes the revision hero back instead of clearing it', async () => {
    const result = await restoreContentRevision(7, 99);

    expect(result).toMatchObject({ success: true });
    expect(updatedRow?.featured_image).toBe(HERO);
  });
});
