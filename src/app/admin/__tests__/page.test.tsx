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
  ends_at: string | null;
  is_hidden?: boolean;
  [key: string]: unknown;
}

function matchesFreshnessClause(row: EventRow, clause: string): boolean {
  const isNull = clause.match(/^(ends_at|starts_at)\.is\.null$/);
  if (isNull) return row[isNull[1]] === null;

  const gte = clause.match(/^(ends_at|starts_at)\.gte\.(.+)$/);
  if (!gte) return false;

  const value = row[gte[1]];
  return typeof value === 'string' && Date.parse(value) >= Date.parse(gte[2]);
}

/**
 * A focused stand-in for the events query builder.
 *
 * It applies the hidden filter, the end-time/undated freshness filter, and
 * ordering the dashboard relies on. Applying the freshness clauses here means
 * a fixture cannot be kept alive by the rendering layer after the query would
 * have rejected it.
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
      const groups = expression.match(/and\([^)]*\)|[^,]+/g) ?? [];
      filtered = filtered.filter((row) =>
        groups.some((group) => {
          const clauses = group.startsWith('and(')
            ? group.slice('and('.length, -1).split(',')
            : [group];
          return clauses.every((clause) => matchesFreshnessClause(row, clause));
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

async function renderDashboard(events: EventRow[]) {
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
      from: vi.fn((table: string) => (table === 'events' ? eventsBuilder : base.from(table))),
    },
  });

  return {
    html: renderToStaticMarkup(await AdminDashboardPage()),
    eventsBuilder,
  };
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

  it('excludes hidden and past rows while keeping future and recurring rows', async () => {
    const events: EventRow[] = [
      {
        slug: 'past-rally',
        title: 'Past Rally',
        date_label: 'November 10',
        time_label: '6:00 PM',
        location_name: 'Old Hall',
        starts_at: '2026-11-10T18:00:00.000Z',
        ends_at: '2026-11-10T20:00:00.000Z',
        is_hidden: false,
      },
      {
        slug: 'hidden-rally',
        title: 'Hidden Rally',
        date_label: 'December 1',
        time_label: '6:00 PM',
        location_name: 'Secret Hall',
        starts_at: '2026-12-01T18:00:00.000Z',
        ends_at: '2026-12-01T20:00:00.000Z',
        is_hidden: true,
      },
      {
        slug: 'upcoming-rally',
        title: 'Upcoming Rally',
        date_label: 'December 5',
        time_label: '6:00 PM',
        location_name: 'Town Square',
        starts_at: '2026-12-05T18:00:00.000Z',
        ends_at: '2026-12-05T20:00:00.000Z',
        is_hidden: false,
      },
      {
        slug: 'recurring-choir',
        title: 'Recurring Choir',
        date_label: 'Every Wednesday',
        time_label: '7:00 PM',
        location_name: 'Church Hall',
        starts_at: null,
        ends_at: null,
        is_hidden: false,
      },
      {
        slug: 'recurring-future',
        title: 'Recurring Future',
        date_label: 'Every Wednesday',
        time_label: '7:00 PM',
        location_name: 'Church Hall',
        starts_at: '2026-12-02T19:00:00.000Z',
        ends_at: '2026-12-02T20:00:00.000Z',
        is_hidden: false,
      },
    ];

    const { html, eventsBuilder } = await renderDashboard(events);

    // The query must select the end instant and ask for the end-time freshness
    // filter (with undated rows retained) and the ordering the page depends on.
    expect(eventsBuilder.select).toHaveBeenCalledWith(
      'slug, title, date_label, time_label, location_name, starts_at, ends_at'
    );
    expect(eventsBuilder.eq).toHaveBeenCalledWith('is_hidden', false);
    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `ends_at.gte.${NOW.toISOString()},and(ends_at.is.null,starts_at.gte.${NOW.toISOString()}),and(ends_at.is.null,starts_at.is.null)`
    );
    expect(eventsBuilder.order).toHaveBeenCalledWith('starts_at', {
      ascending: true,
      nullsFirst: false,
    });
    expect(eventsBuilder.limit).toHaveBeenCalledWith(5);

    // The rendered panel must show the future one-off and both recurring rows,
    // and must not leak either excluded row.
    expect(html).toContain('Upcoming Rally');
    expect(html).toContain('Recurring Choir');
    expect(html).toContain('Recurring Future');
    expect(html).not.toContain('Past Rally');
    expect(html).not.toContain('Hidden Rally');
  });

  it('keeps an event whose start has passed but whose end has not', async () => {
    const events: EventRow[] = [
      {
        slug: 'ongoing-rally',
        title: 'Ongoing Rally',
        date_label: 'Tuesday, November 17, 2026',
        time_label: '2:00 AM - 12:00 PM',
        location_name: 'Town Square',
        starts_at: '2026-11-17T10:00:00.000Z',
        ends_at: '2026-11-17T20:00:00.000Z',
        is_hidden: false,
      },
      {
        slug: 'ended-rally',
        title: 'Ended Rally',
        date_label: 'Tuesday, November 17, 2026',
        time_label: '12:00 AM - 1:00 AM',
        location_name: 'Old Hall',
        starts_at: '2026-11-17T08:00:00.000Z',
        ends_at: '2026-11-17T09:00:00.000Z',
        is_hidden: false,
      },
      {
        slug: 'stale-recurring',
        title: 'Stale Recurring',
        date_label: 'Every Wednesday',
        time_label: '7:00 PM',
        location_name: 'Church Hall',
        starts_at: '2026-10-07T19:00:00.000Z',
        ends_at: '2026-10-07T20:00:00.000Z',
        is_hidden: false,
      },
    ];

    const { html } = await renderDashboard(events);

    expect(html).toContain('Ongoing Rally');
    expect(html).not.toContain('Ended Rally');
    expect(html).not.toContain('Stale Recurring');
  });
});
