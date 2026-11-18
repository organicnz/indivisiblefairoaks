// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  insertIceCrawlDiscoveries,
  insertIceSourceReports,
  type IceCrawlStore,
} from '@/lib/ice-crawl-store';
import type { IceSourceReportInput } from '@/lib/ice-crawl-store';

function fakeUpsertStore() {
  const upsert = vi.fn((rows: unknown[]) => ({
    select: vi.fn(async () => ({
      data: rows.map((_, index) => ({ id: `row-${index}` })),
      error: null,
    })),
  }));
  const store = {
    from: vi.fn(() => ({ upsert })),
  } as unknown as IceCrawlStore;
  return { store, upsert };
}

function fakeRpcStore() {
  const rpc = vi.fn(
    async (_name: string, args: { p_rows: unknown[] }) => ({
      data: args.p_rows.length,
      error: null,
    })
  );
  const store = { rpc } as unknown as IceCrawlStore;
  return { store, rpc };
}

describe('ICE crawl store dedupe', () => {
  it('canonicalizes and deduplicates a discovery batch before writing', async () => {
    const { store, rpc } = fakeRpcStore();
    const inserted = await insertIceCrawlDiscoveries(store, [
      {
        url: 'https://www.example.com/ice/arrests?utm_source=newsletter',
        title: 'ICE arrests 12 in California - CBS News',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'bing:ICE arrests',
      },
      {
        url: 'https://example.com/ice/arrests',
        title: 'ICE arrests 12 in California',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'rss:cbs',
      },
      {
        url: 'https://example.com/unrelated',
        title: 'ICE arrests 12 in California',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'bing:ICE arrests',
      },
      {
        url: 'not-a-url',
        title: 'Invalid URL',
        publisher: null,
        published_at: null,
        discovery_query: 'bing:ICE arrests',
      },
    ]);

    expect(inserted).toBe(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toEqual({
      p_rows: [
      {
        url: 'https://example.com/ice/arrests',
        title: 'ICE arrests 12 in California - CBS News',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'bing:ICE arrests',
        story_key: 'ice arrests 12 in california|2026-11-18',
      },
      ],
    });
  });

  it('deduplicates report rows by dedupe key before upserting', async () => {
    const { store, upsert } = fakeUpsertStore();
    const report = (dedupe_key: string, title: string): IceSourceReportInput => ({
      source_id: 'source-1',
      page_id: null,
      source_name: 'Example',
      source_url: 'https://example.com/ice',
      source_title: 'ICE enforcement',
      source_published_at: null,
      source_retrieved_at: '2026-11-18T12:00:00.000Z',
      title,
      text_content: 'ICE enforcement report.',
      city: 'Fresno',
      state_code: 'CA',
      kind: 'enforcement',
      extraction_method: 'feed',
      dedupe_key,
    });

    const inserted = await insertIceSourceReports(store, [
      report('same-key', 'First copy'),
      report('same-key', 'Second copy'),
      report('other-key', 'Other report'),
    ]);

    expect(inserted).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toHaveLength(2);
  });
});