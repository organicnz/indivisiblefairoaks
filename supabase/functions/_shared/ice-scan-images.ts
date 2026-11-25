/**
 * Evidence-image capture for the Supabase scan.
 *
 * The edge runtime cannot use `sharp`: it is a native module and the hosted
 * runtime only permits WASM image libraries. Supabase's documented image path
 * is `@imagemagick/magick-wasm`, so the scan uses the same decoder/encoder the
 * platform documents, with a hard input ceiling to keep CPU inside the edge
 * budget.
 *
 * The image URL is third-party input. Every redirect is checked with the same
 * public-URL assertion as the page fetch, and the download is abandoned if it
 * is not an image, exceeds the byte ceiling, or takes too long. The bytes are
 * re-encoded to a bounded WebP with metadata dropped, stored in the private
 * `ice-evidence` bucket, and indexed by the same row that names the page.
 */

import { ImageMagick, initializeImageMagick, MagickFormat, MagickGeometry } from 'npm:@imagemagick/magick-wasm@0.0.46';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { assertPublicUrl, sha256Hex } from './ice-scan-http.ts';
import { extractEvidenceImageUrls, shortError } from './ice-scan-logic.ts';

export const EVIDENCE_BUCKET = 'ice-evidence';
const MAX_IMAGE_BYTES = 4_500_000;
const MAX_OUTPUT_BYTES = 1_800_000;
const MAX_WIDTH = 1_400;
const RETRY_WIDTH = 1_200;
const WEBP_QUALITY = 74;
const RETRY_QUALITY = 60;
const IMAGE_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_IMAGES_PER_PAGE = 1;

const IMAGE_USER_AGENT =
  'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; source-attributed report archive)';

const wasmPath = 'npm:@imagemagick/magick-wasm@0.0.46/magick.wasm';
let magickReady: Promise<void> | null = null;

function ensureMagick() {
  if (!magickReady) {
    magickReady = (async () => {
      const bytes = await Deno.readFile(new URL(import.meta.resolve(wasmPath)));
      await initializeImageMagick(bytes);
    })().catch((error) => {
      // A cold-start failure must not poison the isolate forever; the next
      // image gets one fresh attempt.
      magickReady = null;
      throw error;
    });
  }
  return magickReady;
}

function joinChunks(chunks: readonly Uint8Array[], total: number) {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export type CompressedEvidenceImage = {
  data: Uint8Array;
  width: number;
  height: number;
  mimeType: 'image/webp';
};

function encodeWebp(input: Uint8Array, quality: number, maxWidth: number): CompressedEvidenceImage {
  return ImageMagick.read(input, (image) => {
    // Rotation is applied before resize so a phone photo is not stored
    // sideways; magick does not copy EXIF into the WebP by default, which is
    // also what keeps a location-tagged photo from leaking coordinates.
    image.autoOrient();
    // Drop EXIF/IPTC/XMP before encoding so a location-tagged phone photo or
    // a publisher's embedded caption cannot leak metadata into the bucket.
    image.strip();
    if (image.width > maxWidth || image.height > maxWidth) {
      const geometry = new MagickGeometry(maxWidth, maxWidth);
      // `greater` is ImageMagick's `>` geometry: shrink only, never upscale.
      geometry.greater = true;
      image.resize(geometry);
    }
    image.quality = quality;
    const data = image.write(MagickFormat.WebP, (bytes) => Uint8Array.from(bytes));
    return { data, width: image.width, height: image.height, mimeType: 'image/webp' as const };
  });
}

/**
 * Re-encode to a bounded WebP. A first pass keeps the published preview at
 * 1400 px; an unusually large result is re-encoded smaller and lighter rather
 * than stored at full weight. A decode/encoder failure returns null so the
 * report still lands without an image.
 */
export async function compressEvidenceImage(
  input: Uint8Array,
): Promise<CompressedEvidenceImage | null> {
  if (input.byteLength === 0) return null;
  try {
    await ensureMagick();
    let output = encodeWebp(input, WEBP_QUALITY, MAX_WIDTH);
    if (output.data.byteLength > MAX_OUTPUT_BYTES) {
      output = encodeWebp(input, RETRY_QUALITY, RETRY_WIDTH);
    }
    if (output.data.byteLength === 0 || output.data.byteLength > MAX_OUTPUT_BYTES * 1.5) {
      return null;
    }
    return output;
  } catch {
    return null;
  }
}

type Download = { bytes: Uint8Array; finalUrl: string };

async function downloadImage(rawUrl: string): Promise<Download | null> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = await assertPublicUrl(current);
    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: { 'user-agent': IMAGE_USER_AGENT, accept: 'image/*' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, target).toString();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
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
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    if (total === 0) return null;
    return { bytes: joinChunks(chunks, total), finalUrl: response.url || target.toString() };
  }
  return null;
}

export type StoreEvidenceImagesDeps = {
  client: SupabaseClient<any>;
  sourceId: string;
  pageId: string;
  pageUrl: string;
  html: string;
  /** Wall-clock budget shared with the scan run. */
  deadline?: number;
};

export type StoreEvidenceImagesResult = {
  stored: number;
  skipped: number;
  attempted: number;
  errors: string[];
};

/**
 * Find, compress and store the page's own preview image. The row is the
 * provenance record; the bytes live only in the private bucket. A page with no
 * usable image simply has no image: the pipeline never invents a placeholder.
 */
export async function storeEvidenceImages(
  deps: StoreEvidenceImagesDeps,
): Promise<StoreEvidenceImagesResult> {
  const urls = extractEvidenceImageUrls(deps.html, deps.pageUrl, MAX_IMAGES_PER_PAGE);
  let stored = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const imageUrl of urls) {
    if (deps.deadline !== undefined && Date.now() >= deps.deadline) {
      errors.push('image capture stopped at the run deadline.');
      break;
    }
    try {
      // The URL is the idempotence key. Re-crawling a page for its text must
      // not download and re-encode an image already in the bucket.
      const existing = await deps.client
        .from('ice_crawl_page_images')
        .select('id')
        .eq('image_url', imageUrl)
        .limit(1);
      if (existing.error) {
        errors.push(`image lookup: ${existing.error.message}`);
        continue;
      }
      if ((existing.data?.length ?? 0) > 0) {
        skipped += 1;
        continue;
      }

      const download = await downloadImage(imageUrl);
      if (!download) {
        errors.push(`${imageUrl}: image could not be downloaded.`);
        continue;
      }
      const compressed = await compressEvidenceImage(download.bytes);
      if (!compressed) {
        errors.push(`${imageUrl}: image could not be compressed.`);
        continue;
      }

      const dedupeKey = await sha256Hex(`${imageUrl}|${download.bytes.byteLength}`);
      // Keyed by the image, not the page: a publisher's preview appears on
      // many pages, and a per-page path would store the same bytes repeatedly.
      const storagePath = `${deps.sourceId}/${dedupeKey}.webp`;
      const upload = await deps.client.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, compressed.data, {
          contentType: compressed.mimeType,
          cacheControl: '31536000',
          upsert: true,
        });
      if (upload.error) {
        errors.push(`${imageUrl}: ${upload.error.message}`);
        continue;
      }

      const insert = await deps.client
        .from('ice_crawl_page_images')
        .upsert(
          [
            {
              source_id: deps.sourceId,
              page_id: deps.pageId,
              image_url: imageUrl,
              storage_path: storagePath,
              mime_type: compressed.mimeType,
              width: compressed.width,
              height: compressed.height,
              bytes: compressed.data.byteLength,
              dedupe_key: dedupeKey,
            },
          ],
          { onConflict: 'dedupe_key', ignoreDuplicates: true },
        )
        .select('id');
      if (insert.error) {
        // Do not leave an orphan object when its index row cannot be written.
        await deps.client.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
        errors.push(`${imageUrl}: ${insert.error.message}`);
        continue;
      }
      const linked = insert.data?.length ?? 0;
      if (linked > 0) stored += linked;
      else skipped += 1;
    } catch (error) {
      errors.push(`${imageUrl}: ${shortError(error)}`);
    }
  }

  return { stored, skipped, attempted: urls.length, errors };
}
