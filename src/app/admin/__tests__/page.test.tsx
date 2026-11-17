// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdminClient } from '@/lib/__tests__/supabase-mock';

const requireAdmin = vi.hoisted(() => vi.fn());
const getDataPoints = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: requireAdmin }));
vi.mock('@/lib/queries/civic', () => ({ getDataPoints }));
vi.mock('@/components/ui/DataPoint', () => ({
  DataPoint: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { default: AdminDashboardPage } = await import('@/app/admin/page');

const NOW = new Date('2026-11-17T12:00:00.000Z');

interface EventRow {
  slug: string;
  title: string;
  date_label: string;
  time_label: string;
  location_name: string;
  starts_at: string | null;
  is_hidden?: boolean;
  [key: string]: unknown;
}

/**
 * A focused stand-in for the events query builder.
 *
 * It applies the two filters the dashboard relies on instead of returning a
 * pre-filtered fixture: hidden rows must fail `eq`, and past rows must fail the
 * `starts_at >= now OR starts_at IS NULL` clause. A test that only declared the
 * expected rows could stay green while the query stopped filtering them.
 */
function createEventsBuilder(rows: EventRow[]) {
  let filtered = rows;

  const builder = {
    select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
      if (options?.head) {
        return Promise.resolve({ count: rows.length, error: null, data: null });
      }
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filtered = filtered.filter((row) => row[column] === value);
      return builder;
    }),
    or: vi.fn((expression: string) => {
      const clauses = expression.split(',');
      filtered = filtered.filter((row) =>
        clauses.some((clause) => {
          if (clause === 'starts_at.is.null') return row.starts_at === null;
          const gte = clause.match(/^starts_at\.gte\.(.+)$/);
          if (!gte) return false;
          return row.starts_at !== null && Date.parse(row.starts_at) >= Date.parse(gte[1]);
        })
      );
      return builder;
    }),
    order: vi.fn(
      (column: 'starts_at', options?: { ascending?: boolean; nullsFirst?: boolean }) => {
        filtered = [...filtered].sort((a, b) => {
          if (a[column] === null) return 1;
          if (b[column] === null) return -1;
          const delta = Date.parse(a[column]) - Date.parse(b[column]);
          return options?.ascending === false ? -delta : delta;
        });
        return builder;
      }
    ),
    limit: vi.fn(async (count: number) => ({
      data: filtered.slice(0, count),
      error: null,
    })),
  };

  return builder;
}

describe('AdminDashboardPage upcoming events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    getDataPoints.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('excludes hidden and past rows while keeping recurring null-start rows', async () => {
    const events: EventRow[] = [
      {
        slug: 'past-rally',
        title: 'Past Rally',
        date_label: 'November 10',
        time_label: '6:00 PM',
        location_name: 'Old Hall',
        starts_at: '2026-11-10T18:00:00.000Z',
        is_hidden: false,
      },
      {
        slug: 'hidden-rally',
        title: 'Hidden Rally',
        date_label: 'December 1',
        time_label: '6:00 PM',
        location_name: 'Secret Hall',
        starts_at: '2026-12-01T18:00:00.000Z',
        is_hidden: true,
      },
      {
        slug: 'upcoming-rally',
        title: 'Upcoming Rally',
        date_label: 'December 5',
        time_label: '6:00 PM',
        location_name: 'Town Square',
        starts_at: '2026-12-05T18:00:00.000Z',
        is_hidden: false,
      },
      {
        slug: 'recurring-choir',
        title: 'Recurring Choir',
        date_label: 'Every Wednesday',
        time_label: '7:00 PM',
        location_name: 'Church Hall',
        starts_at: null,
        is_hidden: false,
      },
    ];

    const eventsBuilder = createEventsBuilder(events);
    const base = createMockAdminClient({
      content: {
        rows: [
          {
            id: 1,
            title: 'A page',
            slug: 'a-page',
            status: 'publish',
            type: 'page',
            updated_at: '2026-11-16T00:00:00.000Z',
          },
        ],
      },
      profiles: { rows: [] },
    });

    requireAdmin.mockResolvedValue({
      adminClient: {
        from: vi.fn((table: string) =>
          table === 'events' ? eventsBuilder : base.from(table)
        ),
      },
    });

    const html = renderToStaticMarkup(await AdminDashboardPage());

    // The query must ask Supabase for the two filters the page depends on.
    expect(eventsBuilder.eq).toHaveBeenCalledWith('is_hidden', false);
    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `starts_at.gte.${NOW.toISOString()},starts_at.is.null`
    );
    expect(eventsBuilder.order).toHaveBeenCalledWith('starts_at', {
      ascending: true,
      nullsFirst: false,
    });
    expect(eventsBuilder.limit).toHaveBeenCalledWith(5);

    // The rendered panel must show the future one-off and the recurring row,
    // and must not leak either excluded row.
    expect(html).toContain('Upcoming Rally');
    expect(html).toContain('Recurring Choir');
    expect(html).not.toContain('Past Rally');
    expect(html).not.toContain('Hidden Rally');
  });
});
