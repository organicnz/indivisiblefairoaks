// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The aggregate source-report reads use `getIceCrawlStore()`, which is built
 * with the service-role key. That bypasses the anon RLS policy:
 *
 *   using (publication_status = 'published' and rights_status = 'confirmed'
 *          and published_at <= now())
 *
 * so every public query has to apply all three predicates itself. These tests
 * fail if a draft, an unconfirmed summary, or a scheduled (future-dated) report
 * leaks through the archive, a count, a city summary, or the Near-me list.
 */
const placesStore = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/ice-crawl-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ice-crawl-store')>();
  return { ...actual, getIceCrawlStore: () => placesStore.current };
});
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import {
  getPublishedSourceReportCitySummary,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
  type IceCrawlStore,
} from '@/lib/ice-crawl-store';
import { getSourceReportPlaces } from '@/lib/queries/ice-source-report-places';
import { createMockAdminClient } from './supabase-mock';

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';

function report(overrides: Record<string, unknown>) {
  return {
    source_name: 'Example News',
    source_url: 'https://example.com/ice',
    source_title: null,
    source_published_at: null,
    source_retrieved_at: PAST,
    title: 'ICE enforcement report',
    text_content: 'A source-attributed report about ICE enforcement activity.',
    city: 'Sacramento',
    state_code: 'CA',
    kind: 'enforcement',
    extraction_method: 'feed',
    dedupe_key: 'report',
    published_at: PAST,
    publication_status: 'published',
    provenance: 'crawl',
    rights_status: 'confirmed',
    refined_text: null,
    refined_at: null,
    ...overrides,
  };
}

const rows = [
  report({ id: 'past-sacramento', city: 'Sacramento', state_code: 'CA' }),
  report({ id: 'past-portland', city: 'Portland', state_code: 'OR', dedupe_key: 'portland' }),
  report({
    id: 'future-fresno',
    city: 'Fresno',
    state_code: 'CA',
    published_at: FUTURE,
    dedupe_key: 'fresno',
  }),
  report({
    id: 'unconfirmed-discovery',
    city: 'Oakland',
    state_code: 'CA',
    dedupe_key: 'unconfirmed',
    provenance: 'discovery',
    rights_status: 'unconfirmed',
    summary: 'An attributed summary that still needs a human rights confirmation.',
  }),
  report({
    id: 'rights-confirmed-draft',
    city: 'San Jose',
    state_code: 'CA',
    dedupe_key: 'held-draft',
    publication_status: 'draft',
  }),
];

function makeStore() {
  return createMockAdminClient({
    ice_source_reports: { rows: structuredClone(rows) },
  }) as unknown as IceCrawlStore;
}

beforeEach(() => {
  placesStore.current = makeStore();
});

describe('public source-report reads honour published_at and rights_status', () => {
  it('excludes a future-dated report from the archive', async () => {
    const reports = await getPublishedSourceReports(makeStore(), 50);
    expect(reports.map((row) => row.id)).toEqual(['past-sacramento', 'past-portland']);
  });

  it('excludes an unconfirmed discovery summary from the archive', async () => {
    const reports = await getPublishedSourceReports(makeStore(), 50);
    expect(reports.map((row) => row.id)).not.toContain('unconfirmed-discovery');
  });

  it('excludes a rights-confirmed draft from the archive', async () => {
    const reports = await getPublishedSourceReports(makeStore(), 50);
    expect(reports.map((row) => row.id)).not.toContain('rights-confirmed-draft');
  });

  it('excludes a future-dated, unconfirmed, or draft report from exact counts', async () => {
    expect(await getPublishedSourceReportCount(makeStore())).toBe(2);
  });

  it('excludes a future-dated city from the city summary', async () => {
    const futureOnly = await getPublishedSourceReportCitySummary(makeStore(), 'Fresno', 'CA');
    expect(futureOnly.total).toBe(0);
    expect(futureOnly.recent).toEqual([]);

    const published = await getPublishedSourceReportCitySummary(makeStore(), 'Sacramento', 'CA');
    expect(published.total).toBe(1);
    expect(published.recent.map((row) => row.id)).toEqual(['past-sacramento']);
  });

  it('excludes a future-dated city from the Near-me place list', async () => {
    const places = await getSourceReportPlaces();
    expect(places).toEqual([
      { city: 'Sacramento', stateCode: 'CA', count: 1 },
      { city: 'Portland', stateCode: 'OR', count: 1 },
    ]);
  });

  it('excludes a rights-confirmed draft from the Near-me place list', async () => {
    const places = await getSourceReportPlaces();
    expect(places.map((place) => place.city)).not.toContain('San Jose');
  });
});
