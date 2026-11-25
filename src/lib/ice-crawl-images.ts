import type { IceCrawlStore } from '@/lib/ice-crawl-store';
import { insertIceCrawlPageImages } from '@/lib/ice-crawl-store';

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
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    if (!META_IMAGE_KEYS.has(key)) continue;
    const content = attribute(tag, 'content');
    if (!content) continue;
    let url: URL;
    try {
      url = new URL(decodeEntities(content).trim(), baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    found.push(href);
    if (found.length >= limit) break;
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
};

export async function ingestIcePageImages(deps: IngestImagesDeps) {
  const urls = extractEvidenceImageUrls(deps.html, deps.pageUrl);
  let stored = 0;
  const errors: string[] = [];

  for (const imageUrl of urls) {
    try {
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
      await insertIceCrawlPageImages(deps.store, [
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
      stored += 1;
    } catch (error) {
      errors.push(`${imageUrl}: ${error instanceof Error ? error.message : 'image failed.'}`);
    }
  }

  return { stored, errors, bucket: BUCKET, attempted: urls.length };
}
