// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64 } from '@/lib/base64';
import { ingestFeedReportImages } from '@/lib/ice-crawl-images';
import type { IceCrawlStore } from '@/lib/ice-crawl-store';

// A real 1x1 PNG, so the test exercises the actual WebP encoder rather than a
// stub that could agree with a mistaken idea of the pipeline.
const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BYTES = decodeBase64(ONE_PIXEL_PNG);
if (!PNG_BYTES) throw new Error('The PNG fixture is not valid base64.');

type Row = Record<string, unknown>;

function fakeImageStore(options: { rowError?: string } = {}) {
  const uploads: Array<{ path: string; contentType: string | undefined; bytes: number }> = [];
  const removals: string[] = [];
  const rows: Row[] = [];

  const from = vi.fn((table: string) => {
    if (table !== 'ice_crawl_page_images') {
      throw new Error(`unexpected table: ${table}`);
    }
    return {
      select: () => ({
        eq: (_column: string, value: string) => ({
          limit: async () => ({
            data: rows
              .filter((row) => row.image_url === value)
              .map((_, index) => ({ id: `row-${index}` })),
            error: null,
          }),
        }),
      }),
      upsert: (input: Row[]) => ({
        select: async () => {
          if (options.rowError) {
            return { data: null, error: { message: options.rowError } };
          }
          rows.push(...input);
          return { data: input.map((_, index) => ({ id: `row-${index}` })), error: null };
        },
      }),
    };
  });

  const store = {
    from,
    storage: {
      from: () => ({
        upload: async (path: string, data: Uint8Array, opts: { contentType?: string }) => {
          uploads.push({ path, contentType: opts?.contentType, bytes: data.byteLength });
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          removals.push(...paths);
          return { data: paths, error: null };
        },
      }),
    },
  } as unknown as IceCrawlStore;

  return { store, uploads, removals, rows };
}

const isPublicUrl = async (raw: string) => new URL(raw);
const hash = async (value: string) =>
  `h${Array.from(value).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7)}`;

function stubImageFetch() {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      calls.push(String(input));
      return new Response(PNG_BYTES, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ingestFeedReportImages', () => {
  it('opens the linked article for each report the feed left without an image', async () => {
    const { store, uploads, rows } = fakeImageStore();
    stubImageFetch();
    const fetchArticle = vi.fn(async (url: string) => ({
      text: `<meta property="og:image" content="${url}/preview.jpg">`,
      finalUrl: url,
    }));

    const result = await ingestFeedReportImages({
      store,
      sourceId: 'source-1',
      pageId: 'feed-page',
      feedUrl: 'https://news.test/feed',
      reports: [
        { sourceUrl: 'https://news.test/a', imageUrl: null },
        { sourceUrl: 'https://news.test/b', imageUrl: 'https://cdn.test/b.jpg' },
        // The same article twice in one feed must not cost two lookups.
        { sourceUrl: 'https://news.test/a', imageUrl: null },
        // The feed page itself is not an article.
        { sourceUrl: 'https://news.test/feed', imageUrl: null },
      ],
      isPublicUrl,
      hash,
      fetchArticle,
      lookupBudget: { remaining: 4 },
    });

    expect(fetchArticle).toHaveBeenCalledTimes(1);
    expect(fetchArticle).toHaveBeenCalledWith('https://news.test/a');
    expect(result).toMatchObject({ stored: 1, skipped: 0, lookups: 1 });
    expect(result.errors).toEqual([]);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe('image/webp');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source_id: 'source-1',
      page_id: 'feed-page',
      image_url: 'https://news.test/a/preview.jpg',
      mime_type: 'image/webp',
    });
  });

  it('spends one shared budget across every source in a tick', async () => {
    const { store } = fakeImageStore();
    stubImageFetch();
    const fetchArticle = vi.fn(async (url: string) => ({
      text: `<meta property="og:image" content="${url}/preview.jpg">`,
      finalUrl: url,
    }));
    const lookupBudget = { remaining: 1 };
    const base = {
      store,
      sourceId: 'source-1',
      pageId: 'feed-page',
      feedUrl: 'https://news.test/feed',
      isPublicUrl,
      hash,
      fetchArticle,
      lookupBudget,
    };

    await ingestFeedReportImages({
      ...base,
      reports: [{ sourceUrl: 'https://news.test/a', imageUrl: null }],
    });
    const secondSource = await ingestFeedReportImages({
      ...base,
      reports: [{ sourceUrl: 'https://news.test/b', imageUrl: null }],
    });

    expect(fetchArticle).toHaveBeenCalledTimes(1);
    expect(secondSource.lookups).toBe(0);
    expect(lookupBudget.remaining).toBe(0);
  });

  it('does not start an article lookup the tick cannot finish', async () => {
    const { store, uploads } = fakeImageStore();
    stubImageFetch();
    const fetchArticle = vi.fn(async (url: string) => ({
      text: `<meta property="og:image" content="${url}/preview.jpg">`,
      finalUrl: url,
    }));

    const result = await ingestFeedReportImages({
      store,
      sourceId: 'source-1',
      pageId: 'feed-page',
      feedUrl: 'https://news.test/feed',
      reports: [{ sourceUrl: 'https://news.test/a', imageUrl: null }],
      isPublicUrl,
      hash,
      fetchArticle,
      deadline: Date.now() + 5_000,
      lookupBudget: { remaining: 4 },
    });

    expect(fetchArticle).not.toHaveBeenCalled();
    expect(result.lookups).toBe(0);
    expect(uploads).toHaveLength(0);
  });

  it('leaves no orphan object when the matching row cannot be written', async () => {
    const { store, uploads, removals } = fakeImageStore({ rowError: 'row write failed' });
    stubImageFetch();

    const result = await ingestFeedReportImages({
      store,
      sourceId: 'source-1',
      pageId: 'feed-page',
      feedUrl: 'https://news.test/feed',
      reports: [{ sourceUrl: 'https://news.test/a', imageUrl: null }],
      isPublicUrl,
      hash,
      fetchArticle: async (url: string) => ({
        text: `<meta property="og:image" content="${url}/preview.jpg">`,
        finalUrl: url,
      }),
      lookupBudget: { remaining: 4 },
    });

    expect(uploads).toHaveLength(1);
    expect(removals).toEqual([uploads[0].path]);
    expect(result.stored).toBe(0);
    expect(result.errors.join('\n')).toContain('row write failed');
  });

  it('counts an article with no preview as skipped, not failed', async () => {
    const { store, uploads } = fakeImageStore();
    stubImageFetch();

    const result = await ingestFeedReportImages({
      store,
      sourceId: 'source-1',
      pageId: 'feed-page',
      feedUrl: 'https://news.test/feed',
      reports: [{ sourceUrl: 'https://news.test/a', imageUrl: null }],
      isPublicUrl,
      hash,
      fetchArticle: async (url: string) => ({ text: '<html>No preview</html>', finalUrl: url }),
      lookupBudget: { remaining: 4 },
    });

    expect(result).toMatchObject({ stored: 0, skipped: 1, lookups: 1 });
    expect(result.errors).toEqual([]);
    expect(uploads).toHaveLength(0);
  });
});
