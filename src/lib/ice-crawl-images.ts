import type { IceCrawlStore } from '@/lib/ice-crawl-store';
import { hasIceCrawlPageImage, insertIceCrawlPageImages } from '@/lib/ice-crawl-store';

/**
 * Evidence-image capture for crawled ICE pages.
 *
 * The crawler already holds the page HTML, so the only work here is to find
 * the publisher's own social-preview image, download it safely, re-encode it
 * to a bounded WebP, and put the bytes in the private `ice-evidence` bucket
 * with a row that records where they came from.
 *
 * Three constraints shape the implementation:
 * - The crawl runs inside a 60-second function, so a slow or huge image must
 *   be abandoned quickly (an 8-second fetch timeout and a 5.5 MB ceiling).
 * - The URL comes from a third party, so every hop is checked with the same
 *   public-URL assertion the crawler uses. Redirects are followed manually,
 *   because the default `follow` would let a public URL redirect to an
 *   internal address before the check could run.
 * - `sharp` is a native module and the deployed runtime is Bun on Vercel. It
 *   is imported dynamically and every failure is caught: an image problem
 *   must never take down the text crawl that found the report.
 */

const BUCKET = 'ice-evidence';
const MAX_IMAGE_BYTES = 5_500_000;
const MAX_IMAGES_PER_PAGE = 2;
const IMAGE_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
// A feed article lookup needs room for the page fetch plus the image download.
// Below this the tick is ending; the next tick resumes with the same feed.
const MIN_FEED_LOOKUP_REMAINING_MS = 12_000;
const MAX_WIDTH = 1400;
const WEBP_QUALITY = 72;

const USER_AGENT =
  'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; source-attributed report archive)';

const META_IMAGE_KEYS = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'twitter:image',
  'twitter:image:src',
]);

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return match?.[1] ?? null;
}

/**
 * The publisher's declared preview image(s) for a page, in declaration order.
 * `og:image` is the convention news sites actually populate; Twitter's tag is
 * the fallback. Relative values are resolved against the final page URL, and
 * non-HTTP schemes are discarded.
 */
export function extractEvidenceImageUrls(
  html: string,
  baseUrl: string,
  limit = MAX_IMAGES_PER_PAGE
): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    if (found.length >= limit) return;
    let url: URL;
    try {
      url = new URL(decodeEntities(value).trim(), baseUrl);
    } catch {
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    const href = url.toString();
    if (seen.has(href)) return;
    seen.add(href);
    found.push(href);
  };
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    if (!META_IMAGE_KEYS.has(key)) continue;
    const content = attribute(tag, 'content');
    if (content) add(content);
    if (found.length >= limit) break;
  }

  // JSON-LD `image` is common on news sites that omit og:image. Accept a
  // string, an array, or the {url} form schema.org allows.
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    if (found.length >= limit) break;
    try {
      const parsed: unknown = JSON.parse(decodeEntities(match[1]).trim());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (!value || typeof value !== 'object') continue;
        const image = (value as Record<string, unknown>).image;
        const candidates = Array.isArray(image) ? image : [image];
        for (const candidate of candidates) {
          if (typeof candidate === 'string') add(candidate);
          else if (candidate && typeof candidate === 'object') {
            const url = (candidate as Record<string, unknown>).url;
            if (typeof url === 'string') add(url);
          }
        }
      }
    } catch {
      // A malformed JSON-LD block is not an image source.
    }
  }

  // Last resort: the first content-sized <img>, never an icon, logo, sprite or
  // tracking pixel. This is what gives listing/feed pages without metadata a
  // usable preview instead of silently storing nothing.
  if (found.length < limit) {
    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
      const src = attribute(tag, 'src');
      if (!src) continue;
      if (/^data:|logo|icon|sprite|avatar|pixel|tracking|badge/i.test(src)) continue;
      const width = Number(attribute(tag, 'width') ?? '');
      const height = Number(attribute(tag, 'height') ?? '');
      if (
        (Number.isFinite(width) && width > 0 && width < 200) ||
        (Number.isFinite(height) && height > 0 && height < 200)
      )
        continue;
      add(src);
      if (found.length >= limit) break;
    }
  }
  return found;
}

function joinChunks(chunks: readonly Uint8Array[], total: number) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

type Download = { bytes: Uint8Array; finalUrl: string };

async function downloadImage(
  url: string,
  isPublicUrl: (raw: string) => Promise<URL>
): Promise<Download | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = await isPublicUrl(current);
    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept: 'image/*' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, target).toString();
      continue;
    }
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!contentType.toLowerCase().startsWith('image/')) return null;

    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null;
    if (!response.body) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (total === 0) return null;
    return { bytes: joinChunks(chunks, total), finalUrl: response.url || target.toString() };
  }
  return null;
}

export type CompressedEvidenceImage = {
  data: Uint8Array;
  width: number;
  height: number;
};

/**
 * Re-encode to a WebP bounded at 1400 px on the long edge. Rotation is applied
 * from EXIF first so a phone photo is not stored sideways; metadata is dropped
 * by default, which is also what keeps a location-tagged photo from leaking
 * coordinates into the bucket.
 */
export async function compressEvidenceImage(
  input: Uint8Array
): Promise<CompressedEvidenceImage | null> {
  try {
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    // A native-module or decode failure is not fatal to the crawl.
    return null;
  }
}

export type IngestImagesDeps = {
  store: IceCrawlStore;
  sourceId: string;
  pageId: string;
  pageUrl: string;
  html: string;
  isPublicUrl: (raw: string) => Promise<URL>;
  hash: (value: string) => Promise<string>;
  /** Wall-clock budget shared with a bounded cron route. */
  deadline?: number;
};

export type IngestImageUrlsDeps = Pick<
  IngestImagesDeps,
  'store' | 'sourceId' | 'pageId' | 'isPublicUrl' | 'hash' | 'deadline'
>;

export async function ingestIcePageImageUrls(deps: IngestImageUrlsDeps, urls: readonly string[]) {
  let stored = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const imageUrl of urls) {
    if (deps.deadline !== undefined && Date.now() >= deps.deadline) {
      errors.push('image capture stopped at the route deadline.');
      break;
    }
    try {
      // The URL is the idempotence key. A page can be revisited for its text
      // without downloading and re-encoding a preview already in the bucket.
      if (await hasIceCrawlPageImage(deps.store, imageUrl)) {
        skipped += 1;
        continue;
      }
      const download = await downloadImage(imageUrl, deps.isPublicUrl);
      if (!download) {
        errors.push(`${imageUrl}: image could not be downloaded.`);
        continue;
      }
      const compressed = await compressEvidenceImage(download.bytes);
      if (!compressed) {
        errors.push(`${imageUrl}: image could not be compressed.`);
        continue;
      }
      const dedupeKey = await deps.hash(`${imageUrl}|${download.bytes.byteLength}`);
      // The path is keyed by the image, not the page: a publisher's preview
      // image appears on many pages, and a per-page path would store the same
      // bytes once per page while the unique dedupe_key kept only one row.
      const storagePath = `${deps.sourceId}/${dedupeKey}.webp`;
      const { error } = await deps.store.storage.from(BUCKET).upload(storagePath, compressed.data, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (error) {
        errors.push(`${imageUrl}: ${error.message}`);
        continue;
      }
      try {
        const linked = await insertIceCrawlPageImages(deps.store, [
          {
            source_id: deps.sourceId,
            page_id: deps.pageId,
            image_url: imageUrl,
            storage_path: storagePath,
            mime_type: 'image/webp',
            width: compressed.width,
            height: compressed.height,
            bytes: compressed.data.byteLength,
            dedupe_key: dedupeKey,
          },
        ]);
        // A duplicate dedupe key means an existing row already owns these
        // bytes at the same path, so the object must stay.
        if (linked > 0) stored += linked;
        else skipped += 1;
      } catch (error) {
        // The object and its row are one record. Never leave bytes in the
        // private bucket that the index cannot point at.
        try {
          await deps.store.storage.from(BUCKET).remove([storagePath]);
        } catch {
          // Best-effort cleanup; the write failure is reported below.
        }
        throw error;
      }
    } catch (error) {
      errors.push(`${imageUrl}: ${error instanceof Error ? error.message : 'image failed.'}`);
    }
  }

  return { stored, skipped, errors, bucket: BUCKET, attempted: urls.length };
}

export async function ingestIcePageImages(deps: IngestImagesDeps) {
  const urls = extractEvidenceImageUrls(deps.html, deps.pageUrl);
  return ingestIcePageImageUrls(deps, urls);
}

/**
 * Article lookups left in this crawler tick. Shared by every source in the
 * tick: without one budget object, adding sources multiplies the image work
 * and an otherwise bounded 60-second tick spends its time on previews.
 */
export type FeedImageLookupBudget = { remaining: number };

export type FeedReportImage = {
  sourceUrl?: string | null;
  imageUrl?: string | null;
};

export type IngestFeedReportImagesDeps = {
  store: IceCrawlStore;
  sourceId: string;
  /** The page the report was found on; the image row indexes that provenance. */
  pageId: string;
  feedUrl: string;
  reports: readonly FeedReportImage[];
  isPublicUrl: (raw: string) => Promise<URL>;
  hash: (value: string) => Promise<string>;
  /**
   * Must be the crawler's guarded document fetch (`fetchCrawlDocument`), so
   * every article hop still runs the public-URL assertion and robots check.
   */
  fetchArticle: (url: string) => Promise<{ text: string; finalUrl: string }>;
  /** Wall-clock budget shared with the crawl tick. */
  deadline?: number;
  lookupBudget: FeedImageLookupBudget;
};

/**
 * Give feed-derived reports a preview when the feed item did not carry one.
 *
 * A feed carries metadata for its own items, not the article's social image.
 * For each report still missing an image this opens the linked article through
 * the crawler's guarded fetch, takes the first `og:image`/JSON-LD/content image,
 * and runs it through the same download → WebP → private-bucket path as a page
 * image. Lookups are capped by the shared budget, and the deadline is passed
 * through to the image download so a slow publisher cannot outlive the tick.
 */
export async function ingestFeedReportImages(deps: IngestFeedReportImagesDeps) {
  let stored = 0;
  let skipped = 0;
  let lookups = 0;
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const report of deps.reports) {
    // The caller already ingests images declared by the feed itself; opening
    // the article as well would download the same report twice.
    if (report.imageUrl) continue;
    const articleUrl = report.sourceUrl?.trim();
    if (!articleUrl || articleUrl === deps.feedUrl) continue;
    if (seen.has(articleUrl)) continue;
    seen.add(articleUrl);

    if (deps.lookupBudget.remaining <= 0) break;
    if (deps.deadline !== undefined && deps.deadline - Date.now() < MIN_FEED_LOOKUP_REMAINING_MS) {
      break;
    }

    deps.lookupBudget.remaining -= 1;
    lookups += 1;
    try {
      const article = await deps.fetchArticle(articleUrl);
      const urls = extractEvidenceImageUrls(article.text, article.finalUrl, 1);
      if (urls.length === 0) {
        skipped += 1;
        continue;
      }
      const result = await ingestIcePageImageUrls(deps, urls);
      stored += result.stored;
      skipped += result.skipped;
      errors.push(...result.errors);
    } catch (error) {
      errors.push(
        `${articleUrl}: ${error instanceof Error ? error.message : 'article image lookup failed.'}`
      );
    }
  }

  return { stored, skipped, lookups, errors };
}
