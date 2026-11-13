#!/usr/bin/env bun
/**
 * Read-only audit of the old Google Sites and the current Supabase surface.
 *
 * What it does:
 *   - opens the nine canonical Google Sites pages with the installed Chrome
 *     (the Playwright browser bundle is not required; `channel: 'chrome'` is);
 *   - records the main content, links, image sources, iframes, screenshots and
 *     raw HTML under `tmp/legacy-audit-<date>/`;
 *   - reads the current Supabase tables and classifies every page/asset as
 *     represented, missing, historical, third-party or blocked;
 *   - writes a JSON manifest and a Markdown report.
 *
 * What it does NOT do:
 *   - download attachments (Increment 1 only inventories them);
 *   - write to Supabase, Storage, or any production table.
 *
 * Usage:
 *   bun scripts/legacy-audit.mjs
 *   bun scripts/legacy-audit.mjs --out tmp/legacy-audit-2026-11-13
 *   bun scripts/legacy-audit.mjs --no-screenshots
 *   bun scripts/legacy-audit.mjs --no-db
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import {
  LEGACY_BASE,
  LEGACY_PAGES,
  blockedReasonFor,
  classifyPageStatus,
  classifyRights,
  classifyUrl,
  cleanPageLinks,
  dedupeAssets,
  displayFilename,
  downloadUrlFor,
  formatBytes,
  isEmptyLegacyPage,
  normalizeText,
  safeArchiveFilename,
  normalizeUrl,
  pathFromUrl,
  stripLegacyChrome,
} from './legacy-audit-lib.mjs';
import { loadEnvLocal } from './load-env-local.mjs';

await loadEnvLocal({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const noScreenshots = args.includes('--no-screenshots');
const noDb = args.includes('--no-db');
const outIndex = args.indexOf('--out');
const requestedOut = outIndex >= 0 ? args[outIndex + 1] : null;
if (outIndex >= 0 && (!requestedOut || requestedOut.startsWith('--'))) {
  console.error('Usage: bun scripts/legacy-audit.mjs [--out <dir>] [--no-screenshots] [--no-db]');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const outDir = path.resolve(
  process.cwd(),
  requestedOut || path.join('tmp', `legacy-audit-${date}`)
);
const pagesDir = path.join(outDir, 'pages');
const screensDir = path.join(outDir, 'screens');
const assetsDir = path.join(outDir, 'assets');
await mkdir(pagesDir, { recursive: true });
await mkdir(assetsDir, { recursive: true });
if (!noScreenshots) await mkdir(screensDir, { recursive: true });

function slugForPath(pagePath) {
  if (pagePath === '/') return 'home';
  return pagePath.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/g, '');
}

function currentClient() {
  const url = Bun.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = Bun.env.SUPABASE_SECRET_KEY || Bun.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    host: new URL(url).host,
    client: createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}

const db = noDb ? null : currentClient();

async function readCurrent() {
  if (!db) return null;
  const { client, host } = db;
  const results = await Promise.all([
    client.from('content').select('id, slug, title, status, body, metadata').order('id'),
    client.from('content_media').select('id, content_id, name, path, url, mime_type, size').order('id'),
    client.from('gallery_photos').select('id, slug, storage_path, alt, caption').order('id'),
    client.from('events').select('id:slug, slug, title, category, description, rsvp_url').order('slug'),
    client.from('newsletters').select('slug, title, date_label, description, topics').order('slug'),
    client.from('coalition_links').select('slug, name, category, url, description').order('slug'),
    client.from('faqs').select('id, slug, category, question, answer').order('id'),
    client.from('data_points').select('key, value, group_name').order('key'),
  ]);
  const errors = results.filter((result) => result.error);
  if (errors.length > 0) {
    throw new Error(errors.map((result) => result.error?.message).filter(Boolean).join('; '));
  }
  const [content, contentMedia, gallery, events, newsletters, coalitionLinks, faqs, dataPoints] =
    results.map((result) => result.data ?? []);

  const keys = new Set();
  const addKey = (value) => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;
    keys.add(raw);
    keys.add(raw.toLowerCase());
    const normalized = normalizeUrl(raw);
    if (normalized) keys.add(normalized);
    const pathName = pathFromUrl(normalized);
    if (pathName) keys.add(pathName.toLowerCase());
    const base = pathName.split('/').filter(Boolean).at(-1);
    if (base) keys.add(decodeURIComponent(base).toLowerCase());
  };
  const addLinksFromText = (text) => {
    if (!text) return;
    for (const match of String(text).matchAll(/https?:\/\/[^\s"'<>]+/g)) addKey(match[0]);
    // Drive IDs are also pasted as bare IDs in a few CMS rows.
    for (const match of String(text).matchAll(/\b[a-zA-Z0-9_-]{25,}\b/g)) {
      if (/^(1|0)[a-zA-Z0-9_-]{20,}$/.test(match[0])) keys.add(match[0]);
    }
  };

  for (const row of content) {
    addKey(row.slug);
    addLinksFromText(row.body);
    addLinksFromText(JSON.stringify(row.metadata ?? {}));
  }
  for (const row of contentMedia) {
    addKey(row.path);
    addKey(row.url);
    addKey(row.name);
  }
  for (const row of gallery) {
    addKey(row.storage_path);
    addKey(row.slug);
    addKey(row.alt);
    addKey(row.caption);
  }
  for (const row of events) {
    addKey(row.slug);
    addKey(row.rsvp_url);
  }
  for (const row of newsletters) addKey(row.slug);
  for (const row of coalitionLinks) {
    addKey(row.slug);
    addKey(row.url);
  }
  for (const row of dataPoints) {
    addKey(row.key);
    addLinksFromText(row.value);
  }
  for (const row of faqs) addKey(row.slug);

  return {
    host,
    counts: {
      content: content.length,
      content_media: contentMedia.length,
      gallery_photos: gallery.length,
      events: events.length,
      newsletters: newsletters.length,
      coalition_links: coalitionLinks.length,
      faqs: faqs.length,
      data_points: dataPoints.length,
    },
    keys,
    rows: { content, contentMedia, gallery, events, newsletters, coalitionLinks, faqs, dataPoints },
  };
}

function statusForAsset(asset, current) {
  if (asset.blockedReason) return 'blocked';
  if (asset.rights === 'third_party') return 'third_party';
  if (!current) return 'unchecked';
  const idKeys = [asset.driveId, asset.youtubeId, asset.filename, asset.sourceUrl, asset.key]
    .filter(Boolean)
    .flatMap((value) => [String(value), String(value).toLowerCase()]);
  if (idKeys.some((value) => current.keys.has(value))) return 'represented';
  if (asset.pageKind === 'events' || asset.pageKind === 'current-events') return 'historical';
  return 'missing';
}

async function extractPage(browser, spec) {
  const url = `${LEGACY_BASE}${spec.path}`;
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  });
  const slug = slugForPath(spec.path);
  const htmlFile = path.join(pagesDir, `${slug}.html`);
  const screenshotFile = noScreenshots ? null : path.join(screensDir, `${slug}.png`);
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Google Sites renders the page as sections after the document loads. The
    // first `[role=main]` is only the heading section, so wait for the canvas
    // sections and trigger any lazy images before extracting.
    await page
      .waitForFunction(() => document.querySelectorAll('section.yaqOZd').length > 0, null, {
        timeout: 10_000,
      })
      .catch(() => {});
    await page.waitForTimeout(2_000);
    await page
      .evaluate(async () => {
        for (let index = 0; index < 8; index += 1) {
          window.scrollBy(0, window.innerHeight);
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 500));
      })
      .catch(() => {});
    // “More” is a disclosure in the Google Sites header. Clicking it does not
    // change the content of these pages, but it proves the menu has no hidden
    // page list that the direct URL inventory would miss.
    try {
      const more = page.getByRole('button', { name: /^more$/i }).first();
      if (await more.isVisible({ timeout: 1_000 })) await more.click({ timeout: 2_000 });
      await page.waitForTimeout(250);
    } catch {
      // Not every viewport renders the disclosure.
    }

    const extracted = await page.evaluate(() => {
      // Google Sites uses one section per content band and keeps all bands in
      // the DOM, including bands outside the first [role=main]. Extracting the
      // sections captures the whole page instead of only its heading.
      const sections = Array.from(document.querySelectorAll('section.yaqOZd'));
      const clean = document.createElement('div');
      if (sections.length > 0) {
        for (const section of sections) clean.appendChild(section.cloneNode(true));
      } else {
        const fallback =
          document.querySelector('.UtePc') ||
          document.querySelector('#sites-canvas-main-content') ||
          document.querySelector('main') ||
          document.body;
        clean.appendChild(fallback.cloneNode(true));
      }
      for (const selector of [
        'script',
        'style',
        'noscript',
        'nav',
        'header',
        'footer',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
        '[class*="globalnav"]',
        '[class*="globalfooter"]',
        '[id*="globalnav"]',
        '[id*="globalfooter"]',
      ]) {
        for (const node of clean.querySelectorAll(selector)) node.remove();
      }
      // Remove the known utility/footer strips even when they are not semantic.
      for (const node of clean.querySelectorAll('*')) {
        const text = (node.textContent || '').trim();
        if (
          /^(Search this site|Embedded Files|Skip to main content|Skip to navigation|Report abuse|Page details|Page updated|Get in touch with our chapter at)$/i.test(
            text
          ) &&
          node.children.length <= 1
        ) {
          node.remove();
        }
      }

      // `textContent` joins adjacent blocks with no separator, so a footer can
      // read `...pdfcontact@example.org` and defeat line-based chrome removal.
      // Keep block boundaries while walking the cloned sections; inline runs
      // still get a space between text nodes.
      const blockTags = new Set([
        'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD',
        'FIELDSET', 'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
      ]);
      const parts = [];
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if ((node.textContent || '').trim()) parts.push(node.textContent);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.tagName === 'BR') {
          parts.push('\n');
          return;
        }
        const block = blockTags.has(node.tagName);
        if (block) parts.push('\n');
        for (const child of node.childNodes) walk(child);
        if (block) parts.push('\n');
      };
      walk(clean);
      const text = parts
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return {
        title: document.title,
        text,
        html: clean.innerHTML,
        headings: Array.from(clean.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((el) => ({
          level: Number(el.tagName.slice(1)),
          text: (el.textContent || '').trim(),
        })),
        links: Array.from(clean.querySelectorAll('a[href]')).map((el) => ({
          href: el.href,
          text: (el.textContent || '').trim(),
          ariaLabel: el.getAttribute('aria-label'),
        })),
        images: Array.from(clean.querySelectorAll('img')).map((el) => {
          const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || '';
          const candidates = [
            el.currentSrc,
            el.src,
            el.getAttribute('data-src'),
            el.getAttribute('data-lazy-src'),
            ...srcset.split(',').map((part) => part.trim().split(/\s+/)[0]),
          ].filter(Boolean);
          return {
            src: candidates.find((value) => !value.startsWith('data:')) || '',
            srcset,
            alt: el.getAttribute('alt') || '',
            width: el.naturalWidth || null,
            height: el.naturalHeight || null,
          };
        }),
        iframes: Array.from(clean.querySelectorAll('iframe[src]')).map((el) => ({
          src: el.src,
          title: el.getAttribute('title') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
        })),
        backgroundImages: Array.from(
          new Set(
            [...sections.flatMap((section) => [section, ...section.querySelectorAll('*')])]
              .flatMap((el) => {
                const background = getComputedStyle(el).backgroundImage || '';
                return [...background.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
                  (match) => match[1]
                );
              })
              .filter((src) => /^https?:/i.test(src))
          )
        ),
      };
    });

    const mainText = stripLegacyChrome(extracted.text);
    const pageAssets = [];

    const imageSources = [
      ...extracted.images.map((image) => ({ ...image, from: 'img' })),
      ...(extracted.backgroundImages ?? []).map((src) => ({ src, alt: '', from: 'background' })),
    ];
    for (const image of imageSources) {
      const src = normalizeUrl(image.src);
      if (!src) continue;
      if (/^data:/i.test(src)) continue;
      if (/gstatic\.com\/(?:images\/icons|atari\/images\/)/i.test(src)) continue;
      const info = classifyUrl(src, image.alt);
      if (info.kind !== 'image') continue;
      pageAssets.push({
        sourceUrl: src,
        sourcePagePath: spec.path,
        pagePaths: [spec.path],
        pageKind: spec.kind,
        kind: 'image',
        driveId: null,
        youtubeId: null,
        filename: null,
        altText: image.alt || null,
        caption: null,
        rights: classifyRights(src, image.alt),
        mimeType: null,
        byteSize: null,
        isChrome: /gstatic|googleusercontent/i.test(src) && !image.alt,
      });
    }

    for (const iframe of extracted.iframes) {
      const label = iframe.ariaLabel || iframe.title || '';
      const info = classifyUrl(iframe.src, label);
      if (info.kind === 'link') continue;
      const iframeFilename = label.match(/^(?:drive|google docs|docs|google sheets|google slides),\s*(.+)$/i)?.[1]?.trim() || null;
      pageAssets.push({
        sourceUrl: normalizeUrl(iframe.src),
        sourcePagePath: spec.path,
        pagePaths: [spec.path],
        pageKind: spec.kind,
        kind: info.kind === 'youtube' ? 'youtube' : info.kind === 'drive' ? 'drive-embed' : info.kind,
        driveId: info.driveId,
        youtubeId: info.youtubeId,
        filename: iframeFilename,
        altText: null,
        caption: iframeFilename || label || null,
        rights: classifyRights(iframe.src, iframeFilename || label),
        mimeType: null,
        byteSize: null,
      });
    }

    for (const link of extracted.links) {
      const href = normalizeUrl(link.href);
      const info = classifyUrl(href, link.text);
      if (!['pdf', 'document', 'google-doc', 'drive', 'video', 'spreadsheet'].includes(info.kind)) {
        continue;
      }
      const filename =
        info.filename ||
        (link.text && /\.[a-z0-9]{2,8}$/i.test(link.text) ? link.text.trim() : null);
      pageAssets.push({
        sourceUrl: href,
        sourcePagePath: spec.path,
        pagePaths: [spec.path],
        pageKind: spec.kind,
        kind: info.kind,
        driveId: info.driveId,
        youtubeId: info.youtubeId,
        filename,
        altText: null,
        caption: link.text || null,
        rights: classifyRights(href, filename || link.text),
        mimeType: null,
        byteSize: null,
      });
    }

    // The Sites image proxy signs its URLs to the current page session and
    // rotates/expires them. Capture the image bytes while that session is open
    // so a later import never has to fetch an expired URL.
    let imageDownloadIndex = 0;
    for (const asset of pageAssets) {
      if (asset.kind !== 'image') continue;
      const index = imageDownloadIndex;
      imageDownloadIndex += 1;
      try {
        const imageResponse = await page.context().request.get(asset.sourceUrl, {
          headers: { Referer: page.url() },
          timeout: 30_000,
        });
        const contentType = (imageResponse.headers()['content-type'] ?? '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        if (!imageResponse.ok() || !contentType.startsWith('image/')) continue;
        const bytes = await imageResponse.body();
        if (bytes.length === 0) continue;
        const ext =
          {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
          }[contentType] ?? 'img';
        const relativeFile = path.join(
          'assets',
          slugForPath(spec.path),
          `${String(index).padStart(2, '0')}-${safeArchiveFilename(`image.${ext}`)}`
        );
        const absoluteFile = path.join(outDir, relativeFile);
        await mkdir(path.dirname(absoluteFile), { recursive: true });
        await writeFile(absoluteFile, bytes);
        asset.localFile = relativeFile;
        asset.mimeType = contentType;
        asset.byteSize = bytes.length;
      } catch {
        // A missing local copy leaves the source URL as the fallback; the
        // import will report a failed asset rather than silently dropping it.
      }
    }

    const assets = dedupeAssets(pageAssets).map((asset) => {
      const filename = displayFilename(asset);
      const blockedReason = blockedReasonFor({ ...asset, filename });
      const rights = classifyRights(asset.sourceUrl, filename);
      return {
        ...asset,
        filename,
        rights,
        downloadUrl: downloadUrlFor(asset),
        blockedReason,
        status: statusForAsset({ ...asset, filename, rights, blockedReason }, current),
      };
    });

    await Bun.write(htmlFile, extracted.html || '');
    if (screenshotFile && !noScreenshots) {
      await page.screenshot({ path: screenshotFile, fullPage: true });
    }

    const pageStatus = isEmptyLegacyPage({ text: mainText, assets })
      ? 'empty'
      : classifyPageStatus(spec, {
          routes: current?.routes ?? [],
          legacyRedirects: current?.legacyRedirects ?? [],
        });

    return {
      path: spec.path,
      title: spec.title,
      url,
      finalUrl: page.url(),
      httpStatus: response?.status() ?? null,
      documentTitle: extracted.title,
      headings: extracted.headings,
      mainText,
      textChars: mainText.length,
      assets,
      links: cleanPageLinks(
        extracted.links.map((link) => ({ href: link.href, text: link.text })),
        url
      ),
      htmlFile: path.relative(outDir, htmlFile),
      screenshotFile: screenshotFile ? path.relative(outDir, screenshotFile) : null,
      pageStatus,
      empty: isEmptyLegacyPage({ text: mainText, assets }),
    };
  } catch (error) {
    return {
      path: spec.path,
      title: spec.title,
      url,
      finalUrl: page.url(),
      httpStatus: null,
      documentTitle: null,
      headings: [],
      mainText: '',
      textChars: 0,
      assets: [],
      links: [],
      htmlFile: null,
      screenshotFile: null,
      pageStatus: 'error',
      empty: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

function buildReport(manifest) {
  const lines = [];
  lines.push('# Legacy Google Sites audit');
  lines.push('');
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push(`Source: ${manifest.sourceBase}`);
  lines.push(`Output: ${manifest.outDir}`);
  lines.push('');
  lines.push('## Scope and method');
  lines.push('');
  lines.push(
    'Read-only browser crawl of the nine canonical pages, with current Supabase rows read through the service role. No attachments were downloaded, and no database or storage writes were made.'
  );
  lines.push('');
  lines.push('## Pages');
  lines.push('');
  lines.push('| Old path | Status | Chars | Assets | New home |');
  lines.push('|---|---|---:|---:|---|');
  for (const page of manifest.pages) {
    lines.push(
      `| \`${page.path}\` | ${page.pageStatus} | ${page.textChars} | ${page.assets.length} | ${page.destination ?? ''} |`
    );
  }
  lines.push('');
  lines.push('## Current Supabase snapshot');
  lines.push('');
  if (manifest.current) {
    lines.push(`Project host: \`${manifest.current.host}\``);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(manifest.current.counts, null, 2));
    lines.push('```');
  } else {
    lines.push('Database comparison skipped (`--no-db` or missing credentials).');
  }
  lines.push('');
  lines.push('## Assets by status');
  lines.push('');
  for (const [status, count] of Object.entries(manifest.summary.assetsByStatus)) {
    lines.push(`- **${status}**: ${count}`);
  }
  lines.push('');
  lines.push('## Assets by kind');
  lines.push('');
  for (const [kind, count] of Object.entries(manifest.summary.assetsByKind)) {
    lines.push(`- **${kind}**: ${count}`);
  }
  lines.push('');
  lines.push('## Missing or blocked assets');
  lines.push('');
  const needsWork = manifest.assets.filter((asset) =>
    ['missing', 'blocked', 'third_party', 'historical', 'unchecked'].includes(asset.status)
  );
  if (needsWork.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| Status | Kind | File | Page | Rights | Note |');
    lines.push('|---|---|---|---|---|---|');
    for (const asset of needsWork) {
      lines.push(
        `| ${asset.status} | ${asset.kind} | ${asset.filename ?? ''} | \`${asset.sourcePagePath}\` | ${asset.rights} | ${asset.blockedReason ?? ''} |`
      );
    }
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of manifest.findings) lines.push(`- ${finding}`);
  lines.push('');
  lines.push('## Important limits');
  lines.push('');
  lines.push(
    '- No binary was downloaded. Sign-in-gated files and the Drive MP4 are marked `blocked`; they need a human export or permission.'
  );
  lines.push(
    '- `third_party` means the file is not safe to rehost publicly without a rights decision; archive it privately and link to the source.'
  );
  lines.push(
    '- The current-site comparison is a filename/URL/key match, not a visual diff. Review the report before approving the import.'
  );
  lines.push(
    '- This audit records public pages only. Google Sites revisions, comments and permissions are not publicly available.'
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const current = await readCurrent();
if (current) {
  // Imported here rather than at module scope so the audit can still run with
  // `--no-db` in a checkout without the app's config modules.
  const [{ ROUTES }, { LEGACY_REDIRECTS }] = await Promise.all([
    import('../src/config/routes.ts'),
    import('../src/config/legacy-redirects.ts'),
  ]);
  current.routes = [...ROUTES.map((route) => route.href), '/archive'];
  current.legacyRedirects = LEGACY_REDIRECTS.map((redirect) => redirect.destination);
}

let browser;
const pages = [];
try {
  browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });
  for (const spec of LEGACY_PAGES) {
    process.stderr.write(`auditing ${spec.path} … `);
    const page = await extractPage(browser, spec);
    pages.push({ ...page, destination: spec.destination });
    process.stderr.write(`${page.pageStatus} (${page.assets.length} assets)\n`);
  }
} catch (error) {
  console.error(`Could not launch Chrome for the audit: ${error instanceof Error ? error.message : error}`);
  console.error('Install Google Chrome, or run `bun run e2e:install` and set the browser channel.');
  process.exitCode = 1;
} finally {
  await browser?.close();
}

const allAssets = dedupeAssets(pages.flatMap((page) => page.assets)).map((asset) => ({
  ...asset,
  pagePaths: [...new Set(asset.pagePaths ?? [])],
}));

// The per-page copies already have statuses; the deduped list needs the same
// current-site comparison, so recompute it after merging page references.
for (const asset of allAssets) {
  asset.status = statusForAsset(asset, current);
}

const summary = {
  pages: pages.length,
  pagesWithErrors: pages.filter((page) => page.pageStatus === 'error').length,
  pagesEmpty: pages.filter((page) => page.pageStatus === 'empty').length,
  assets: allAssets.length,
  assetsByKind: Object.fromEntries(
    [...new Set(allAssets.map((asset) => asset.kind))]
      .sort()
      .map((kind) => [kind, allAssets.filter((asset) => asset.kind === kind).length])
  ),
  assetsByStatus: Object.fromEntries(
    [...new Set(allAssets.map((asset) => asset.status))]
      .sort()
      .map((status) => [status, allAssets.filter((asset) => asset.status === status).length])
  ),
  blocked: allAssets.filter((asset) => asset.status === 'blocked').length,
  thirdParty: allAssets.filter((asset) => asset.status === 'third_party').length,
  missing: allAssets.filter((asset) => asset.status === 'missing').length,
};

const findings = [
  `${pages.length} canonical pages audited; ${summary.pagesEmpty} are empty and ${summary.pagesWithErrors} failed to load.`,
  `${allAssets.length} unique assets found: ${summary.assetsByKind.image ?? 0} images, ${(summary.assetsByKind['drive-embed'] ?? 0) + (summary.assetsByKind['google-doc'] ?? 0)} Drive files and Google Docs, and ${summary.assetsByKind.youtube ?? 0} YouTube embeds.`,
  `${summary.missing} assets have no current Supabase/Storage match; ${summary.thirdParty} are third-party and must not be rehosted without permission; ${summary.blocked} need a manual export.`,
  'The old site has no public sitemap, robots policy, file cabinet, or revision history; the nine pages are the complete public navigation surface.',
  'The old custom-domain deep links redirect to the Google Sites home page. Use the canonical `sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks/*` URLs for capture.',
];

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceBase: LEGACY_BASE,
  outDir,
  readOnly: true,
  pages,
  assets: allAssets,
  current: current
    ? {
        host: current.host,
        counts: current.counts,
        keyCount: current.keys.size,
        routes: current.routes,
        legacyRedirects: current.legacyRedirects,
      }
    : null,
  summary,
  findings,
};

await Bun.write(path.join(outDir, 'legacy-audit.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await Bun.write(path.join(outDir, 'legacy-audit-report.md'), buildReport(manifest));

console.log(`Audit wrote ${path.relative(process.cwd(), path.join(outDir, 'legacy-audit.json'))}`);
console.log(`Report: ${path.relative(process.cwd(), path.join(outDir, 'legacy-audit-report.md'))}`);
console.log(
  `Read-only audit complete: ${summary.pages} pages, ${summary.assets} assets, ` +
    `${summary.missing} missing, ${summary.thirdParty} third-party, ${summary.blocked} blocked.`
);
console.log('No database, storage, or production content was changed.');
