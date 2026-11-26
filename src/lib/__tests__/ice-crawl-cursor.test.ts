// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock } from '@/lib/__tests__/fetch-mock';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]),
}));

vi.mock('@/lib/ice-crawl-store', () => ({
  deleteIceCrawlFrontier: vi.fn(async () => {}),
  getIceCrawlSource: vi.fn(async () => null),
  getIceCrawlStore: vi.fn(() => ({})),
  hasIceCrawlPageImage: vi.fn(async () => false),
  insertIceCrawlPageImages: vi.fn(async () => 0),
  insertIceSourceReports: vi.fn(async () => 0),
  listIceCityPoints: vi.fn(async () => []),
  listIceCrawlFrontier: vi.fn(async () => []),
  listIceCrawlSources: vi.fn(async () => []),
  recordIceCrawlTick: vi.fn(async () => {}),
  saveIceCrawlFrontier: vi.fn(async () => 1),
  updateIceCrawlPageReportCount: vi.fn(async () => {}),
  updateIceCrawlSource: vi.fn(async () => {}),
  upsertIceCrawlPage: vi.fn(async () => ({ id: 'page-1' })),
}));

import { crawlIceSource } from '@/lib/ice-crawl';
import { justiceReleasePageNumber, justiceReleasePageUrls } from '@/lib/ice-crawl-justice';
import { listIceCrawlFrontier, saveIceCrawlFrontier } from '@/lib/ice-crawl-store';
import type { IceCrawlSource } from '@/lib/ice-crawl-types';

const API_URL =
  'https://www.justice.gov/api/v1/press_releases.json?sort_by=created&sort_order=DESC';

const source: IceCrawlSource = {
  id: 'source-1',
  url: API_URL,
  label: 'Department of Justice',
  enabled: true,
  max_pages: 12,
  rights_confirmed_at: '2026-11-24T00:00:00.000Z',
  last_crawled_at: null,
  last_status: null,
  last_error: null,
  last_page_count: 0,
  last_report_count: 0,
  relevance_terms: ['ICE'],
  created_at: '2026-11-24T00:00:00.000Z',
  updated_at: '2026-11-24T00:00:00.000Z',
};

function pageUrl(page: number) {
  return justiceReleasePageUrls(API_URL, 1, page)[0] ?? API_URL;
}

function releasePage(page: number) {
  return JSON.stringify({
    metadata: { resultset: { count: '276726', pagesize: 20, page } },
    results: [
      {
        url: `https://www.justice.gov/opa/pr/release-${page}`,
        title: `Department announcement ${page}`,
        teaser: 'An unrelated announcement',
        body: '<p>An unrelated announcement.</p>',
        date: '1795521600',
      },
    ],
  });
}

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const raw =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(raw);
  if (url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /\n', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }
  if (url.pathname === '/api/v1/press_releases.json') {
    return new Response(releasePage(Number(url.searchParams.get('page') ?? '0')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('not found', { status: 404 });
});
installFetchMock(fetchMock);

const listFrontier = vi.mocked(listIceCrawlFrontier);
const saveFrontier = vi.mocked(saveIceCrawlFrontier);

beforeEach(() => {
  vi.clearAllMocks();
  listFrontier.mockResolvedValue([]);
  saveFrontier.mockResolvedValue(1);
  installFetchMock(fetchMock);
});

function savedPages() {
  return saveFrontier.mock.calls.flatMap((call) =>
    call[2].map((item) => justiceReleasePageNumber(item.url))
  );
}

describe('DOJ crawl cursor', () => {
  it('leaves one page-12 cursor after the newest window drains', async () => {
    const summary = await crawlIceSource(source, [], { deadline: Date.now() + 30_000 });

    expect(summary.pagesFetched).toBe(12);
    expect(savedPages()).toEqual([12]);
  });

  it('does not advance the cursor when the budget stops mid-window', async () => {
    const summary = await crawlIceSource(source, [], { deadline: Date.now() - 1 });

    expect(summary.pagesFetched).toBe(0);
    expect(savedPages()).not.toContain(12);
  });

  it('expands the cursor into the next 12-page window', async () => {
    listFrontier.mockResolvedValue([{ url: pageUrl(12), depth: 0 }]);
    fetchMock.mockClear();

    const summary = await crawlIceSource(source, [], { deadline: Date.now() + 30_000 });

    const fetchedPages = fetchMock.mock.calls
      .map((call) => {
        const input = call[0];
        const raw =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return new URL(raw);
      })
      .filter((url) => url.pathname === '/api/v1/press_releases.json')
      .map((url) => Number(url.searchParams.get('page') ?? '0'));

    expect(summary.pagesFetched).toBe(12);
    expect(fetchedPages).toEqual(Array.from({ length: 12 }, (_, index) => index + 12));
    expect(savedPages()).toEqual([24]);
  });
});
