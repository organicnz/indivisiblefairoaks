#!/usr/bin/env bun
/**
 * Legacy Google Sites → Supabase archive importer.
 *
 * Default mode is a pure dry run: it reads the audit manifest and reports what
 * would be imported. `--download` fetches files into a local staging directory
 * without touching Supabase. `--commit` uploads the raw copies to the private
 * `legacy-archive` bucket, uploads chapter-owned/public-domain files to the
 * public `legacy-documents` bucket, and upserts the metadata tables.
 *
 * Idempotency:
 *   * page rows are keyed by source_path;
 *   * assets by asset_key;
 *   * documents by slug;
 *   * page links are replaced per page, inside the same run.
 *
 * Placement:
 *   * scripts/legacy-placement-map.json records the reviewed destination for
 *     every legacy image (reuse an existing public media object, publish a new
 *     copy, or preserve privately because it is a QR code or blank chrome);
 *   * links are unwrapped from Google redirects and stripped of old-site
 *     navigation before they are written;
 *   * only chapter_owned / public_domain files are copied to the public bucket;
 *     third-party and unknown documents link to their original URL instead.
 *   * every downloadable asset gets a private raw copy; the browser never
 *     receives a private path.
 *
 * Usage:
 *   bun scripts/legacy-import.mjs
 *   bun scripts/legacy-import.mjs --manifest tmp/legacy-audit-2026-11-13/legacy-audit.json
 *   bun scripts/legacy-import.mjs --download --out tmp/legacy-import-2026-11-13
 *   bun scripts/legacy-import.mjs --commit --manifest tmp/legacy-audit-2026-11-13/legacy-audit.json
 *
 * `--commit` is intentionally opt-in. It requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY. The script never prints the key or a signed URL.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import sharp from 'sharp';
import {
  LEGACY_BASE,
  LEGACY_PAGES,
  assetKey,
  blockedReasonFor,
  classifyUrl,
  cleanPageLinks,
  dedupeAssets,
  displayFilename,
  driveDownloadUrl,
  filenameFromDisposition,
  filenameFromUrl,
  formatBytes,
  safeArchiveFilename,
} from './legacy-audit-lib.mjs';
import { loadEnvLocal } from './load-env-local.mjs';

const DOCUMENT_KINDS = new Set(['drive', 'drive-embed', 'google-doc', 'pdf', 'document', 'video']);
const PUBLIC_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'audio/mpeg',
  'audio/ogg',
  'text/plain',
]);
const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};
const EXTENSION_BY_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'text/plain': 'txt',
};

export function slugifyLegacy(value, fallback = 'legacy-document') {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return slug || fallback;
}

export function documentCategoryForPage(pageKind) {
  if (pageKind === 'voter') return 'voter';
  if (pageKind === 'newsletters') return 'newsletter';
  if (pageKind === 'choir') return 'choir';
  if (pageKind === 'events' || pageKind === 'current-events') return 'event';
  return 'general';
}

function repairLegacyText(value) {
  // Drive occasionally returns a UTF-8 filename decoded as Latin-1, which
  // turns typographic punctuation into mojibake. Repair only the specific
  // sequences seen in the source filenames; do not transliterate the title.
  return String(value)
    .replace(/\u00e2\u0080\u0094/g, '—')
    .replace(/\u00e2\u0080\u0093/g, '–')
    .replace(/\u00e2\u0080\u0099/g, '’')
    .replace(/\u00e2\u0080\u009c/g, '“')
    .replace(/\u00e2\u0080\u009d/g, '”')
    .replace(/\bincarderated\b/gi, 'incarcerated')
    .replace(/\bSacramentp\b/g, 'Sacramento');
}

// Public-facing corrections for filenames that are abbreviations or capture
// labels rather than the document's actual title. Slugs deliberately keep the
// original filename-derived title so a correction never creates a second row or
// moves an already-published object.
const DOCUMENT_TITLE_OVERRIDES = new Map([
  ['16PoEMeUfNlrrTW7j6hwFuKJW0aDuHfTi', 'Easy Voter Guide — November 2026 (Spanish)'],
  [
    '1vAqzxHNZb25GqwUZJ2pQFl-IbPxpONcN',
    'Easy Voter Guide — November 2026 (League of Women Voters)',
  ],
  ['10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy', 'CalMatters 2026 Voter Guide (Nonpartisan)'],
  ['1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U', 'Key Dates for the Election'],
  ['1y4yaaCwk5smQ2dC7pLftHmz8N4THiv-Z', 'Vote with the League: Quick Reference Guide'],
  ['1mpQTszfaP1wLvydcCjLTfw9WKzXNL4YN', 'Sacramento List of Elected Officials'],
  [
    '1NEUZUwV_wN3Ni4DePH2ccM9YCgKGDyUn',
    'Sacramento List of Elected Officials 2025 (Page 2)',
  ],
  ['1JxqIH6yicsM16PmgSJ_qDDu8bacq3hed', 'Pre-Register to Vote at 16'],
  ['1juYjxyCfRKW5kf-IMTefHwwYrUJnx7WL', 'Voting Rights for Formerly Incarcerated People (Page 1)'],
  ['10oRcKJ6aCYYV88ZRN-FfZPpPnBqhVqN2', 'Homeless Is Not Voteless'],
  ['1rQbBKQomLL3PgGy46IukFkxVE2GMkhHd', 'Newsletter — April 27, 2026'],
  ['1C9PKoCejiYMSzFxMFUfzsa1x9JHoHreQ7l3CYibykis', 'Know Your Rights: General Overview'],
  ['13lQizUKvHyuckCd54-PAw0b60XeXQP7K', 'ARC Votes'],
]);

export function documentTitle(asset) {
  // Content-Disposition occasionally carries a trailing control character
  // after the extension, which would otherwise survive the extension strip.
  const filename = displayFilename(asset)
    ?.replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]+$/g, '')
    .trim();
  if (filename && filename !== 'untitled') {
    return repairLegacyText(filename)
      .replace(/\.[a-z0-9]{2,8}$/i, '')
      // A Google Doc exported to PDF keeps its original extension:
      // `Election Dates.docx.pdf`. Strip the source extension too.
      .replace(/\.(?:docx?|xlsx?|pptx?|pdf|csv|txt|rtf|odt|ods|odp)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // A Drive embed of an untitled Google Doc has a useful descriptive label in
  // the iframe caption ("Document, General Overview of your rights..."). Use it
  // instead of leaking a random Drive ID into the public document list.
  const caption = repairLegacyText(asset.caption ?? '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]+$/g, '')
    .replace(/^(?:document|drive|google docs?|docs),\s*/i, '')
    .replace(/\.[a-z0-9]{2,8}$/i, '')
    .trim();
  if (caption && !/^untitled$/i.test(caption)) return caption;
  return asset.driveId ? `Legacy Drive document ${asset.driveId.slice(0, 8)}` : 'Legacy document';
}

export function documentDisplayTitle(asset) {
  const override = asset.driveId ? DOCUMENT_TITLE_OVERRIDES.get(asset.driveId) : null;
  return override ?? documentTitle(asset);
}

/** Drop preserved navigation chrome and document filenames that the archive renders separately. */
export function cleanLegacyBodyText(value, pageTitle) {
  const normalizedTitle = String(pageTitle ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (normalizedTitle && line.toLowerCase() === normalizedTitle) return false;
      if (/^[^\n]+\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|odp|mp4|mov|webm)$/i.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Small QR codes and blank banner captures are preservation-only, not public images. */
export function isUtilityImage({ width, height, byteSize }) {
  if (!width || !height || !byteSize) return false;
  return byteSize < 10_000 && Math.min(width, height) <= 512;
}

async function imageDimensions(bytes) {
  try {
    const metadata = await sharp(bytes).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/** 64-bit difference hash; stable across Google's rotating image proxy URLs. */
export async function imageDhash(bytes) {
  const { data, info } = await sharp(Buffer.from(bytes))
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width - 1; x += 1) {
      bits += data[y * info.width + x] < data[y * info.width + x + 1] ? '1' : '0';
    }
  }
  return bits;
}

export function dhashDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) distance += 1;
  }
  return distance;
}

/** Google Docs exposes a generated 1200×630 preview that is not page content. */
export function isDocumentPreviewAsset(asset) {
  try {
    const url = new URL(asset.sourceUrl);
    return (
      /(^|\.)googleusercontent\.com$/i.test(url.hostname) &&
      /\/docs\//i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

const PLACEMENT_MAP_PATH = path.resolve(process.cwd(), 'scripts/legacy-placement-map.json');

async function loadPlacementMap() {
  try {
    const parsed = JSON.parse(await readFile(PLACEMENT_MAP_PATH, 'utf8'));
    if (
      parsed.version !== 2 ||
      !Array.isArray(parsed.entries) ||
      typeof parsed.dhashThreshold !== 'number'
    ) {
      throw new Error('unsupported placement map shape');
    }
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return { entries: [], dhashThreshold: 0 };
    throw new Error(`Could not read ${path.relative(process.cwd(), PLACEMENT_MAP_PATH)}: ${error.message}`);
  }
}

function matchPlacement(placementMap, dhash) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of placementMap.entries) {
    const distance = dhashDistance(entry.dhash, dhash);
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best && bestDistance <= placementMap.dhashThreshold ? best : null;
}

function mediaPublicUrl(objectPath) {
  if (!objectPath) return null;
  const base = String(Bun.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return null;
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/media/${encoded}`;
}

export function documentSlug(asset) {
  const title = slugifyLegacy(documentTitle(asset), 'legacy-document');
  // Bun.hash is a stable non-cryptographic fingerprint; the document slug only
  // needs to stay stable across reruns, not resist an attacker.
  const suffix = Bun.hash(assetKey(asset)).toString(36).slice(0, 8);
  return `${title.slice(0, 80)}-${suffix}`;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function publishedDateFromFilename(filename) {
  const match = String(filename ?? '').match(/(20\d{2})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z` : null;
}

export function effectiveRights(asset) {
  if (asset.rights === 'chapter_owned' || asset.rights === 'public_domain') return asset.rights;
  // A third-party file stays third-party even if the filename is unknown.
  if (asset.rights === 'third_party') return 'third_party';
  // Images served from the chapter's own Google Sites image proxy are chapter
  // media unless the audit already found a third-party hint.
  if (asset.kind === 'image' && /sitesv-images-rt|googleusercontent/i.test(asset.sourceUrl ?? '')) {
    return 'chapter_owned';
  }
  return 'unknown';
}

export function isDocumentAsset(asset) {
  return DOCUMENT_KINDS.has(asset.kind);
}

export function extensionForAsset(asset, filename, mimeType) {
  const fromName = String(filename ?? '').match(/\.([a-z0-9]{2,8})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (mimeType && EXTENSION_BY_MIME[mimeType]) return EXTENSION_BY_MIME[mimeType];
  return asset.kind === 'google-doc' ? 'pdf' : 'bin';
}

export function publicMimeType(asset, filename, mimeType) {
  const clean = String(mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (PUBLIC_MIME_TYPES.has(clean)) return clean;
  const fromName = String(filename ?? '').match(/\.([a-z0-9]{2,8})$/i)?.[1]?.toLowerCase();
  const fromExtension = MIME_BY_EXTENSION[fromName] ?? null;
  return fromExtension && PUBLIC_MIME_TYPES.has(fromExtension) ? fromExtension : null;
}

function htmlLooksLikeDriveConfirmation(text) {
  return /Google Drive - Virus scan warning|download_warning|confirm=[A-Za-z0-9_-]+/i.test(text);
}

function parseDriveConfirmation(text) {
  return {
    uuid: text.match(/name="uuid"\s+value="([^"]+)"/i)?.[1] ?? text.match(/uuid=([A-Za-z0-9_-]+)/i)?.[1] ?? null,
    confirm:
      text.match(/name="confirm"\s+value="([^"]+)"/i)?.[1] ??
      text.match(/confirm=([A-Za-z0-9_-]+)/i)?.[1] ??
      null,
  };
}

async function fetchOnce(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
    signal: AbortSignal.timeout(90_000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  return {
    response,
    bytes,
    contentType: contentType.split(';')[0].trim().toLowerCase(),
    disposition: response.headers.get('content-disposition'),
    finalUrl: response.url,
  };
}

let browser = null;
let browserContext = null;
const loadedPages = new Set();
let activeImportDb = null;
let activeImportRunId = null;

async function browserFetch(url, pagePath) {
  if (!browser) {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    browserContext = await browser.newContext();
  }
  // Google Sites' image proxy requires the same cookie jar as the page; a bare
  // fetch gets a 403 even with a Referer header. Load each source page once so
  // its cookies are established, then use the context's request client.
  for (const pathName of [pagePath, '/']) {
    if (loadedPages.has(pathName)) continue;
    const page = await browserContext.newPage();
    try {
      await page.goto(`${LEGACY_BASE}${pathName}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await page.waitForTimeout(2_000);
      loadedPages.add(pathName);
    } catch {
      // The direct request below may still work for a public asset.
    } finally {
      await page.close();
    }
  }
  const response = await browserContext.request.get(url, {
    headers: { Referer: `${LEGACY_BASE}${pagePath}` },
  });
  const bytes = new Uint8Array(await response.body());
  return {
    response,
    bytes,
    contentType: (response.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase(),
    disposition: response.headers()['content-disposition'] ?? null,
    finalUrl: url,
  };
}

async function closeBrowser() {
  await browser?.close();
  browser = null;
  browserContext = null;
  loadedPages.clear();
}

async function downloadAsset(asset, auditDir) {
  if (asset.localFile && auditDir) {
    try {
      const localFile = path.resolve(auditDir, asset.localFile);
      const bytes = new Uint8Array(await readFile(localFile));
      if (bytes.length > 0) {
        return {
          bytes,
          contentType: asset.mimeType ?? 'application/octet-stream',
          mimeType: asset.mimeType ?? publicMimeType(asset, asset.filename, null),
          filename: asset.filename && asset.filename !== 'untitled'
            ? asset.filename
            : path.basename(localFile),
          sha256: await sha256Hex(bytes),
          finalUrl: asset.sourceUrl,
        };
      }
    } catch {
      // Fall through to the network path; a local capture can be moved or
      // deleted between audit and import.
    }
  }
  const driveId = asset.driveId;
  const sourceUrl = asset.downloadUrl || driveDownloadUrl(asset.sourceUrl);
  const isDrive = Boolean(driveId);
  let result = await fetchOnce(sourceUrl);
  // Google Sites' image proxy sometimes answers a bare request with a 200
  // HTML shell instead of the image. The proxy needs the page's cookie jar,
  // so retry through the browser context for any HTML response to an image.
  const imageGotHtml =
    asset.kind === 'image' && /^text\/html/i.test(result.contentType);
  if (!driveId && (result.response.status === 403 || result.response.status === 401 || imageGotHtml)) {
    result = await browserFetch(sourceUrl, asset.pagePath);
  }

  const resultText = new TextDecoder().decode(result.bytes);
  if (isDrive && /^text\/html/i.test(result.contentType) && htmlLooksLikeDriveConfirmation(resultText)) {
    const confirmation = parseDriveConfirmation(resultText);
    if (confirmation.uuid || confirmation.confirm) {
      const retry = new URL('https://drive.usercontent.google.com/download');
      retry.searchParams.set('id', driveId);
      retry.searchParams.set('export', 'download');
      retry.searchParams.set('confirm', 't');
      if (confirmation.uuid) retry.searchParams.set('uuid', confirmation.uuid);
      result = await fetchOnce(retry.toString());
    }
  }

  if (result.response.status >= 400) {
    throw new Error(`HTTP ${result.response.status} for ${sourceUrl}`);
  }
  if (/^text\/html/i.test(result.contentType) && isDrive) {
    throw new Error('Google Drive returned an HTML page instead of a file (likely restricted)');
  }
  if (asset.kind === 'image' && !/^image\//i.test(result.contentType)) {
    throw new Error(`Expected an image but Google returned ${result.contentType || 'an unknown type'}`);
  }
  if (result.bytes.length === 0) throw new Error('empty response');
  if (result.bytes.length > 500 * 1024 * 1024) throw new Error('file is larger than the 500 MB archive limit');

  const dispositionName = filenameFromDisposition(result.disposition);
  const filename =
    dispositionName ||
    filenameFromUrl(result.finalUrl) ||
    (asset.filename && asset.filename !== 'untitled' ? asset.filename : null) ||
    (asset.youtubeId ? `youtube-${asset.youtubeId}` : null);
  const mimeType =
    publicMimeType(asset, filename, result.contentType) ||
    MIME_BY_EXTENSION[String(filename ?? '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? ''] ||
    result.contentType ||
    null;

  return {
    bytes: result.bytes,
    contentType: result.contentType,
    mimeType,
    filename,
    sha256: await sha256Hex(result.bytes),
    finalUrl: result.finalUrl,
  };
}

function sourcePageSlug(sourcePath) {
  return sourcePath === '/' ? 'home' : sourcePath.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-');
}

function buildPlan(manifest) {
  const kindByPath = new Map(LEGACY_PAGES.map((page) => [page.path, page.kind]));
  const pages = (manifest.pages ?? []).map((page) => ({
    ...page,
    kind: page.kind ?? page.pageKind ?? kindByPath.get(page.path) ?? 'page',
  }));
  const assets = pages.flatMap((page) =>
    (page.assets ?? []).map((asset, index) => ({
      ...asset,
      pagePath: page.path,
      pageKind: page.pageKind ?? page.kind ?? 'page',
      pageTitle: page.title,
      sortOrder: index,
    }))
  );
  const uniqueAssets = dedupeAssets(assets);
  const documents = uniqueAssets.filter(isDocumentAsset);
  return { pages, assets: uniqueAssets, documents, auditDir: manifest.outDir };
}

async function findManifest(explicit) {
  if (explicit) return path.resolve(process.cwd(), explicit);
  const base = path.resolve(process.cwd(), 'tmp');
  let entries = [];
  try {
    entries = await readdir(base);
  } catch {
    throw new Error('No tmp/ directory. Run `bun scripts/legacy-audit.mjs` first or pass --manifest.');
  }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.startsWith('legacy-audit-')) continue;
    const file = path.join(base, entry, 'legacy-audit.json');
    try {
      const info = await stat(file);
      candidates.push({ file, mtime: info.mtimeMs });
    } catch {
      // Not every audit directory has finished.
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) {
    throw new Error('No tmp/legacy-audit-*/legacy-audit.json found. Run the audit first or pass --manifest.');
  }
  return candidates[0].file;
}

function assetLocalPath(outDir, asset, filename) {
  const key = slugifyLegacy(assetKey(asset).replace(/[^a-z0-9]+/gi, '-'), 'asset');
  return path.join(outDir, 'assets', key, safeArchiveFilename(filename || assetKey(asset)));
}

function parseArgs(argv) {
  const outIndex = argv.indexOf('--out');
  const manifestIndex = argv.indexOf('--manifest');
  const onlyIndexes = argv.flatMap((arg, index) => (arg === '--only' ? [index + 1] : []));
  return {
    commit: argv.includes('--commit'),
    download: argv.includes('--download'),
    noDownload: argv.includes('--no-download'),
    out: outIndex >= 0 ? argv[outIndex + 1] : null,
    manifest: manifestIndex >= 0 ? argv[manifestIndex + 1] : null,
    only: onlyIndexes.map((index) => argv[index]).filter(Boolean),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

async function downloadForPlan(plan, outDir, { commit, db, runId, only, skipDownload = false, placementMap }) {
  const results = [];
  for (const asset of plan.assets) {
    if (only.length > 0 && !only.some((value) => asset.pagePath === value || asset.pagePath.startsWith(`${value}/`))) {
      continue;
    }
    if (asset.kind === 'youtube') {
      results.push({
        asset,
        status: 'external',
        note: 'YouTube is represented by its public embed; no video is copied.',
        isPublic: true,
      });
      continue;
    }
    const knownBlocked = asset.blockedReason ?? blockedReasonFor(asset);
    if (knownBlocked || asset.status === 'blocked') {
      results.push({
        asset,
        status: 'blocked',
        note: knownBlocked ?? 'known blocked source',
        isPublic: false,
      });
      continue;
    }
    if (isDocumentPreviewAsset(asset)) {
      results.push({
        asset,
        status: 'external',
        note: 'Google Docs generated preview; not page content',
        isPublic: false,
      });
      continue;
    }
    if (skipDownload) {
      results.push({
        asset,
        status: 'external',
        note: 'metadata only; source has not been downloaded',
        rights: effectiveRights(asset),
        isPublic: false,
      });
      continue;
    }

    try {
      const downloaded = await downloadAsset(asset, plan.auditDir);
      const filename = downloaded.filename || displayFilename(asset);
      const localPath = assetLocalPath(outDir, asset, filename);
      await mkdir(path.dirname(localPath), { recursive: true });
      await writeFile(localPath, downloaded.bytes);
      const rights = effectiveRights(asset);
      const dimensions =
        asset.kind === 'image' ? await imageDimensions(downloaded.bytes) : { width: null, height: null };
      const placement =
        asset.kind === 'image'
          ? matchPlacement(placementMap, await imageDhash(downloaded.bytes))
          : null;
      const hidden = Boolean(placement?.hidden) ||
        isDocumentPreviewAsset(asset) ||
        (asset.kind === 'image' &&
          isUtilityImage({
            width: dimensions.width,
            height: dimensions.height,
            byteSize: downloaded.bytes.length,
          }));
      const reusedUrl = placement?.mediaObject ? mediaPublicUrl(placement.mediaObject) : null;
      const publicCopy =
        !hidden &&
        !reusedUrl &&
        (rights === 'chapter_owned' || rights === 'public_domain') &&
        Boolean(publicMimeType(asset, filename, downloaded.mimeType));
      // An external document can be indexed in legacy_documents without its
      // raw copy becoming a public legacy_assets row. `is_public` describes a
      // public file or embed, not merely a row that has metadata.
      const publicFacing = asset.kind === 'youtube' || Boolean(reusedUrl) || publicCopy;
      let storagePath = path.relative(outDir, localPath);
      let publicPath = null;
      if (publicCopy) {
        const ext = extensionForAsset(asset, filename, downloaded.mimeType);
        const category = documentCategoryForPage(asset.pageKind);
        publicPath = isDocumentAsset(asset)
          ? `documents/${category}/${documentSlug(asset)}.${ext}`
          : `images/${sourcePageSlug(asset.pagePath)}/${documentSlug(asset)}.${ext}`;
      }

      if (commit && db) {
        const rawKey = `raw/${sourcePageSlug(asset.pagePath)}/${downloaded.sha256.slice(0, 12)}-${safeArchiveFilename(filename)}`;
        const { error: rawError } = await db.storage
          .from('legacy-archive')
          .upload(rawKey, downloaded.bytes, {
            upsert: true,
            contentType: downloaded.mimeType || 'application/octet-stream',
          });
        if (rawError) throw new Error(`private upload failed: ${rawError.message}`);
        storagePath = rawKey;

        if (publicCopy && publicPath) {
          const { error: publicError } = await db.storage
            .from('legacy-documents')
            .upload(publicPath, downloaded.bytes, {
              upsert: true,
              contentType: downloaded.mimeType || 'application/octet-stream',
            });
          if (publicError) throw new Error(`public upload failed: ${publicError.message}`);
        }
      }

      results.push({
        asset,
        status: 'stored',
        note: hidden
          ? 'private preservation only (QR code, blank capture, or other utility image)'
          : reusedUrl
            ? 'private copy; public image reuses an existing media/gallery object'
            : publicCopy
              ? 'private + public copy'
              : 'private copy; public link points at source',
        filename,
        mimeType: downloaded.mimeType,
        byteSize: downloaded.bytes.length,
        sha256: downloaded.sha256,
        width: dimensions.width,
        height: dimensions.height,
        storagePath,
        publicPath,
        publicUrl: hidden ? null : reusedUrl,
        isPublic: publicFacing,
        placement: placement ?? null,
        rights,
        localPath,
      });
    } catch (error) {
      results.push({
        asset,
        status: 'failed',
        note: error instanceof Error ? error.message : String(error),
        isPublic: false,
      });
    }
  }
  return results;
}

async function upsertPage(db, runId, page, outDir, manifest) {
  const slug = sourcePageSlug(page.path);
  const rawPath = `pages/${slug}/index.html`;
  let screenshotPath = null;
  const auditDir = manifest.outDir;

  if (page.htmlFile) {
    const html = await readFile(path.resolve(auditDir, page.htmlFile)).catch(() => null);
    if (!html) throw new Error(`raw HTML is missing from the audit: ${page.htmlFile}`);
    const { error } = await db.storage.from('legacy-archive').upload(rawPath, html, {
      upsert: true,
      contentType: 'text/html; charset=utf-8',
    });
    if (error) throw new Error(`raw HTML upload failed: ${error.message}`);
  }
  if (page.screenshotFile) {
    const screenshot = await readFile(path.resolve(auditDir, page.screenshotFile)).catch(() => null);
    if (!screenshot) throw new Error(`screenshot is missing from the audit: ${page.screenshotFile}`);
    screenshotPath = `pages/${slug}/screenshot.png`;
    const { error } = await db.storage
      .from('legacy-archive')
      .upload(screenshotPath, screenshot, { upsert: true, contentType: 'image/png' });
    if (error) throw new Error(`screenshot upload failed: ${error.message}`);
  }

  const bodyText = cleanLegacyBodyText(page.mainText, page.title);
  const { data, error } = await db
    .from('legacy_pages')
    .upsert(
      {
        import_run_id: runId,
        source_path: page.path,
        source_url: page.url,
        title: page.title,
        page_kind: page.kind ?? page.pageKind ?? 'page',
        destination: page.destination ?? '',
        summary: bodyText.slice(0, 320),
        body_text: bodyText,
        raw_html_path: rawPath,
        screenshot_path: screenshotPath,
        status: 'approved',
        captured_at: manifest.generatedAt,
        sort_order: page.sortOrder ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_path' }
    )
    .select('id')
    .single();
  if (error) throw new Error(`page upsert failed: ${error.message}`);
  return data.id;
}

async function upsertAsset(db, runId, result, pagePath, sortOrder) {
  const asset = result.asset;
  const rights = result.rights ?? effectiveRights(asset);
  const placementLabel = result.placement?.label ?? null;
  const payload = {
    import_run_id: runId,
    asset_key: assetKey(asset),
    source_page_path: pagePath,
    source_url: asset.sourceUrl,
    kind: asset.kind,
    drive_id: asset.driveId ?? null,
    youtube_id: asset.youtubeId ?? null,
    filename: result.filename ?? asset.filename ?? null,
    external_url: asset.sourceUrl,
    width: result.width ?? asset.width ?? null,
    height: result.height ?? asset.height ?? null,
    alt_text: asset.altText ?? placementLabel ?? null,
    caption: asset.caption ?? placementLabel ?? null,
    rights,
    blocked_reason: result.status === 'blocked' ? result.note : null,
    status: result.status === 'stored' ? 'stored' : result.status,
    is_public: result.isPublic ?? result.status !== 'blocked',
    sort_order: sortOrder,
    captured_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // A rerun that hits a temporary failure must not erase a previously stored
  // private or public copy. A successful download, however, replaces every
  // pointer because the new file may have a different rights decision.
  if (result.status === 'stored') {
    payload.storage_path = result.storagePath ?? null;
    payload.public_path = result.publicPath ?? null;
    payload.public_url = result.publicUrl ?? null;
    payload.sha256 = result.sha256 ?? null;
    payload.byte_size = result.byteSize ?? null;
    payload.mime_type = result.mimeType ?? null;
  }
  const { data, error } = await db
    .from('legacy_assets')
    .upsert(payload, { onConflict: 'asset_key' })
    .select('id')
    .single();
  if (error) throw new Error(`asset upsert failed (${asset.sourceUrl}): ${error.message}`);
  return data.id;
}

async function upsertDocument(db, runId, result, page) {
  const asset = result.asset;
  if (!isDocumentAsset(asset)) return null;
  const rights = result.rights ?? effectiveRights(asset);
  const title = documentDisplayTitle({ ...asset, filename: result.filename ?? asset.filename });
  const slug = documentSlug(asset);
  const category = documentCategoryForPage(page.kind ?? page.pageKind ?? 'page');
  const payload = {
    import_run_id: runId,
    asset_id: result.assetId ?? null,
    slug,
    title,
    category,
    description: asset.caption ?? '',
    source_page_path: page.path,
    external_url: asset.sourceUrl,
    rights,
    published_at: publishedDateFromFilename(result.filename ?? asset.filename),
    status: result.status === 'blocked' ? 'review' : 'approved',
    sort_order: asset.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };
  // Same preservation rule as assets: do not erase a working public file when
  // a rerun is blocked or temporarily fails. A successful stored result owns
  // all file pointers and clears a stale public path when rights changed.
  if (result.status === 'stored') {
    payload.file_path = result.publicPath ?? null;
    payload.public_url = result.publicUrl ?? null;
    payload.sha256 = result.sha256 ?? null;
    payload.byte_size = result.byteSize ?? null;
    payload.mime_type = result.mimeType ?? null;
  }
  const { data, error } = await db
    .from('legacy_documents')
    // asset_id is the stable identity; a corrected title changes the display
    // slug without inserting a second row for the same old document.
    .upsert(payload, { onConflict: 'asset_id' })
    .select('id')
    .single();
  if (error) throw new Error(`document upsert failed (${asset.sourceUrl}): ${error.message}`);
  return data.id;
}

async function applyToDatabase(db, runId, plan, results, outDir, manifest) {
  const pageIds = new Map();
  let assetCount = 0;
  let documentCount = 0;

  for (const [index, page] of plan.pages.entries()) {
    const pageId = await upsertPage(db, runId, { ...page, sortOrder: index * 10 }, outDir, manifest);
    pageIds.set(page.path, pageId);

    const pageResults = results.filter((result) => result.asset.pagePath === page.path);
    const assetIds = new Map();
    const documentAssetIds = new Set();
    for (const result of pageResults) {
      const assetId = await upsertAsset(db, runId, result, page.path, result.asset.sortOrder ?? 0);
      result.assetId = assetId;
      assetIds.set(assetKey(result.asset), assetId);
      assetCount += 1;
      if (isDocumentAsset(result.asset)) documentAssetIds.add(assetId);
      const documentId = await upsertDocument(db, runId, result, page);
      if (documentId) documentCount += 1;
    }

    await db.from('legacy_page_links').delete().eq('page_id', pageId);
    const links = [];
    for (const [linkIndex, link] of cleanPageLinks(page.links ?? [], page.url).entries()) {
      const href = link.href;
      const info = classifyUrl(href, link.text ?? '');
      const asset =
        (info.driveId && [...assetIds.entries()].find(([key]) => key.startsWith(`drive:${info.driveId}:`))?.[1]) ||
        (info.youtubeId && [...assetIds.entries()].find(([key]) => key === `youtube:${info.youtubeId}`)?.[1]) ||
        [...assetIds.entries()].find(([key]) => key === `url:${href}`)?.[1] ||
        null;
      // The document section owns the download. A second "docs.google.com"
      // row in the link list is duplicate navigation, not extra content.
      if (asset && documentAssetIds.has(asset)) continue;
      links.push({
        page_id: pageId,
        asset_id: asset ?? null,
        href,
        label: link.text ?? '',
        kind: info.kind,
        is_external: link.external ?? false,
        sort_order: linkIndex,
      });
    }
    if (links.length > 0) {
      const { error } = await db.from('legacy_page_links').insert(links);
      if (error) throw new Error(`page links insert failed: ${error.message}`);
    }
  }

  return { assetCount, documentCount };
}

function placementReport(results) {
  const images = results.filter((result) => result.status === 'stored' && result.asset.kind === 'image');
  const reused = images.filter((result) => result.placement?.mediaObject);
  const privateOnly = images.filter((result) => !result.isPublic);
  const publicCopies = images.filter((result) => result.publicPath);
  const documents = results
    .filter((result) => isDocumentAsset(result.asset))
    .map((result) => ({
      page: result.asset.pagePath,
      title: documentDisplayTitle({
        ...result.asset,
        filename: result.filename ?? result.asset.filename,
      }),
      slug: documentSlug(result.asset),
      category: documentCategoryForPage(result.asset.pageKind),
      rights: result.rights ?? effectiveRights(result.asset),
      status: result.status,
      hosted: Boolean(result.publicPath || result.publicUrl),
      publicPath: result.publicPath ?? null,
      publicUrl: result.publicUrl ?? null,
      source: result.asset.sourceUrl,
    }));
  return {
    total: images.length,
    reusedExistingMedia: reused.length,
    newPublicCopies: publicCopies.length,
    privateOnly: privateOnly.length,
    images: images.map((result) => ({
      page: result.asset.pagePath,
      label: result.placement?.label ?? result.asset.caption ?? null,
      role: result.placement?.role ?? 'image',
      mediaObject: result.placement?.mediaObject ?? null,
      publicPath: result.publicPath ?? null,
      publicUrl: result.publicUrl ?? null,
      private: !result.isPublic,
      source: result.asset.sourceUrl,
    })),
    documents,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: bun scripts/legacy-import.mjs [--manifest <path>] [--out <dir>] [--download] [--commit] [--no-download] [--only <legacy-path>]'
    );
    return 0;
  }
  await loadEnvLocal({ path: path.resolve(process.cwd(), '.env.local') });

  const manifestPath = await findManifest(args.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.pages)) throw new Error('Manifest has no pages array.');
  manifest.outDir ||= path.dirname(manifestPath);
  const placementMap = await loadPlacementMap();
  const plan = buildPlan(manifest);
  const only = args.only;
  const selectedPages = only.length
    ? plan.pages.filter((page) => only.some((value) => page.path === value || page.path.startsWith(`${value}/`)))
    : plan.pages;
  const selectedAssets = only.length
    ? plan.assets.filter((asset) => only.some((value) => asset.pagePath === value || asset.pagePath.startsWith(`${value}/`)))
    : plan.assets;
  const selectedDocuments = selectedAssets.filter(isDocumentAsset);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(process.cwd(), args.out || path.join('tmp', `legacy-import-${date}`));

  console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`Output:   ${path.relative(process.cwd(), outDir)}`);
  console.log(
    `Plan:     ${selectedPages.length} pages, ${selectedAssets.length} unique assets, ${selectedDocuments.length} documents`
  );
  console.log(
    `Rights:   ${selectedAssets.filter((asset) => effectiveRights(asset) === 'chapter_owned' || effectiveRights(asset) === 'public_domain').length} cleared, ` +
      `${selectedAssets.filter((asset) => effectiveRights(asset) === 'third_party').length} third-party, ` +
      `${selectedAssets.filter((asset) => effectiveRights(asset) === 'unknown').length} unknown`
  );
  console.log(
    `Blocked:  ${selectedAssets.filter((asset) => asset.blockedReason || asset.status === 'blocked').length}`
  );
  const imageAssets = selectedAssets.filter((asset) => asset.kind === 'image');
  console.log(
    `Images:   ${imageAssets.length} content-hashed images; reuse/private/public destination is resolved after download`
  );

  if (!args.commit && !args.download) {
    await mkdir(outDir, { recursive: true });
    await writeFile(
      path.join(outDir, 'import-plan.json'),
      `${JSON.stringify(
        {
          manifest: manifestPath,
          generatedAt: new Date().toISOString(),
          pages: selectedPages.map((page) => ({ path: page.path, title: page.title, assets: page.assets?.length ?? 0 })),
          documents: selectedDocuments.map((asset) => ({
            page: asset.pagePath,
            title: documentDisplayTitle(asset),
            slug: documentSlug(asset),
            rights: effectiveRights(asset),
            source: asset.sourceUrl,
          })),
          images: imageAssets.map((asset) => ({
            page: asset.pagePath,
            label: asset.caption ?? asset.altText ?? null,
            destination: isDocumentPreviewAsset(asset)
              ? 'legacy-archive (private document preview)'
              : 'resolved after download (media reuse, public copy, or private utility)',
            source: asset.sourceUrl,
          })),
        },
        null,
        2
      )}\n`
    );
    console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, 'import-plan.json'))}`);
    console.log('Dry run only: no files downloaded and no database rows changed.');
    return 0;
  }

  let db = null;
  let runId = null;
  const source = manifest.sourceBase ?? 'Google Sites';
  if (args.commit) {
    const url = Bun.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = Bun.env.SUPABASE_SECRET_KEY || Bun.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('--commit requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
    }
    const host = new URL(url).host;
    if (!host.endsWith('.supabase.co')) {
      throw new Error(`Refusing to write to an unexpected Supabase host: ${host}`);
    }
    db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await db
      .from('legacy_import_runs')
      .insert({
        source,
        source_label: manifestPath,
        manifest_sha256: await sha256Hex(new TextEncoder().encode(JSON.stringify(manifest))),
        manifest_path: path.relative(process.cwd(), manifestPath),
        status: 'running',
      })
      .select('id')
      .single();
    if (error) throw new Error(`Could not start legacy import run: ${error.message}`);
    runId = data.id;
    activeImportDb = db;
    activeImportRunId = runId;
    console.log(`Started import run ${runId} on ${host}.`);
  }

  await mkdir(outDir, { recursive: true });
  const results = await downloadForPlan(plan, outDir, {
    commit: args.commit,
    db,
    runId,
    only,
    skipDownload: args.noDownload,
    placementMap,
  });
  const failures = results.filter((result) => result.status === 'failed');
  const blocked = results.filter((result) => result.status === 'blocked');
  const stored = results.filter((result) => result.status === 'stored');
  const placement = placementReport(results);
  console.log(
    `Placed:   ${placement.reusedExistingMedia} images reuse media/gallery, ` +
      `${placement.newPublicCopies} new public images, ${placement.privateOnly} private-only images`
  );

  if (db && runId) {
    const counts = await applyToDatabase(db, runId, { pages: selectedPages, assets: selectedAssets }, results, outDir, manifest);
    const status = failures.length > 0 ? 'failed' : 'succeeded';
    await db
      .from('legacy_import_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        page_count: selectedPages.length,
        asset_count: counts.assetCount,
        document_count: counts.documentCount,
        notes: failures.length > 0 ? `${failures.length} asset(s) failed; see the local import report.` : null,
      })
      .eq('id', runId);
    await writeFile(
      path.join(outDir, 'import-report.json'),
      `${JSON.stringify(
        {
          runId,
          status,
          pages: selectedPages.length,
          assets: counts.assetCount,
          documents: counts.documentCount,
          stored: stored.length,
          blocked: blocked.length,
          placement,
          failures: failures.map((result) => ({
            source: result.asset.sourceUrl,
            page: result.asset.pagePath,
            note: result.note,
          })),
        },
        null,
        2
      )}\n`
    );
    console.log(
      `Committed run ${runId}: ${counts.assetCount} assets, ${counts.documentCount} documents, ` +
        `${stored.length} stored, ${blocked.length} blocked, ${failures.length} failed.`
    );
    console.log(`Report: ${path.relative(process.cwd(), path.join(outDir, 'import-report.json'))}`);
  } else {
    await writeFile(
      path.join(outDir, 'import-report.json'),
      `${JSON.stringify(
        {
          status: failures.length > 0 ? 'partial' : 'staged',
          pages: selectedPages.length,
          assets: selectedAssets.length,
          stored: stored.length,
          blocked: blocked.length,
          placement,
          failures: failures.map((result) => ({
            source: result.asset.sourceUrl,
            page: result.asset.pagePath,
            note: result.note,
          })),
        },
        null,
        2
      )}\n`
    );
    console.log(
      `Staged ${stored.length} assets in ${path.relative(process.cwd(), outDir)}; ` +
        `${blocked.length} blocked, ${failures.length} failed. No database or storage writes were made.`
    );
  }

  for (const failure of failures) {
    console.error(`FAILED ${failure.asset.pagePath} ${failure.asset.sourceUrl}: ${failure.note}`);
  }
  for (const item of blocked) {
    console.warn(`BLOCKED ${item.asset.pagePath} ${item.asset.filename ?? item.asset.sourceUrl}: ${item.note}`);
  }
  return failures.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  try {
    const code = await main();
    await closeBrowser();
    process.exit(code);
  } catch (error) {
    if (activeImportDb && activeImportRunId) {
      try {
        await activeImportDb
          .from('legacy_import_runs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            notes: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          })
          .eq('id', activeImportRunId);
      } catch {
        // Preserve the original error; the stuck run row is already a failure signal.
      }
    }
    await closeBrowser();
    console.error(`Legacy import failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
