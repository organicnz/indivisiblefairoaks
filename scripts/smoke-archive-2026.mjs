#!/usr/bin/env bun
/**
 * Post-deploy smoke check for the 2026 voter-guides archive.
 *
 * Two things Erin asked for have no runtime test that can run in CI's unit
 * suite, because they are properties of the *deployed page*:
 *
 *   1. `/archive` renders the moved 2026 block — the anchor, the heading, all
 *      five items, and a link for each of the four documents;
 *   2. `/voter-info` carries none of it.
 *
 * This script is the post-deploy half. It runs after the deploy workflow has
 * proved the host serves the requested commit, so a stale alias cannot pass it.
 * It does not replace the unit tests: those pin the components, this pins the
 * page that production actually serves.
 *
 * ## Document links: owned copy or Drive fallback, both are valid
 *
 * Each document is expected to be reachable by its storage slug or its Drive
 * id. A row whose `file_path` is set points at the chapter-owned PDF; one that
 * is not yet mirrored (or was reverted) points at Drive. Both are correct
 * states, so the check accepts either and reports which one it found. It fails
 * only when a document has no link at all, or when the link returns a non-200.
 * Owned copies must also be a PDF; Drive preview URLs are HTML, so they are
 * checked for reachability only.
 *
 * ## Exit codes
 *
 *   0  every archive assertion, link and negative check passed
 *   1  any assertion, link or fetch failed — the output names which
 *   1  the script itself could not fetch a page (reported separately)
 *
 * Usage:
 *   bun scripts/smoke-archive-2026.mjs --site-url=https://test.indivisiblefairoaks.org
 *
 * `--site-url` is required. There is no default host: the repo has repeatedly
 * been bitten by a guessed origin, and a smoke check that quietly probes the
 * wrong host is worse than one that refuses to start.
 */

export const SECTION_ID = 'voter-guides-2026';
export const ARCHIVE_HEADING = '2026 Voter Guide & Ballot Recommendations';

/** Every item the archived block must render. */
export const ARCHIVE_ITEMS = [
  'Sacramento Voter Guide',
  'Ballot Recommendations',
  'Hands Off Our Vote 2026 Toolkit',
  'Key Dates for the Election',
  'Understanding the SAVE America Act',
];

/**
 * The four documents, identified by both of the ways the page may link them.
 * `slug` is the storage object name; `driveId` is the fallback identity.
 */
export const DOCUMENTS = [
  {
    label: 'CalMatters 2026 Voter Guide',
    slug: 'calmatters-2026-voter-guide-non-partisan-2026-1tf9z6kn',
    driveId: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
  },
  {
    label: 'CA Voter Information Guide 2026',
    slug: 'ca-voter-information-guide-2026-2bqhekvi',
    driveId: '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
  },
  {
    label: 'Hands Off Our Vote 2026 Toolkit',
    slug: 'hands-off-our-vote-2026-toolkit-3r709bjc',
    driveId: '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
  },
  {
    label: 'Key Dates for the Election',
    slug: 'key-dates-for-the-election-3e0tig0n',
    driveId: '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
  },
];

/** Strings that must never appear on `/voter-info` again. */
export const VOTER_INFO_FORBIDDEN = [
  SECTION_ID,
  '2026 Voter Guide',
  'Hands Off Our Vote 2026 Toolkit',
  'Key Dates for the Election',
  'Understanding the SAVE America Act',
  ...DOCUMENTS.flatMap((doc) => [doc.driveId, `documents/voter/${doc.slug}.pdf`]),
];

/**
 * The page's rendered markup, with `<script>` and comments removed.
 *
 * This matters for the negative check: Next serialises the `data_points`
 * dictionary into the RSC hydration payload, so `/voter-info` legitimately
 * contains the string `"voter.guides.headline":"2026 Voter Guide & Ballot
 * Recommendations"` inside a script tag even though it renders none of it. A
 * raw-HTML search reports that as a regression on a correct page. Scanning
 * rendered markup is the accurate question: is 2026 *content* present?
 */
export function renderedContent(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/** Minimal entity decoding — enough to compare rendered copy, not a parser. */
export function decodeEntities(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * The 2026 block's markup, from its `<section>` to the next `</section>`.
 *
 * Anchored on the id, not on a class: the id is the contract the page's
 * `aria-labelledby` and the menu link already depend on.
 */
export function sectionFor(html, id = SECTION_ID) {
  const marker = `id="${id}"`;
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const open = html.lastIndexOf('<section', at);
  const close = html.indexOf('</section>', at);
  const start = open === -1 ? at : open;
  return html.slice(start, close === -1 ? html.length : close);
}

/** All `href` values in a fragment, in document order. */
export function hrefsIn(fragment) {
  return [...fragment.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

/** The pathname for a relative or absolute href; null when it cannot parse. */
export function pathnameOf(href, base = 'https://placeholder.invalid') {
  try {
    return new URL(href, base).pathname;
  } catch {
    return null;
  }
}

/**
 * Assert the archive page's 2026 block. Pure: takes HTML, returns findings.
 *
 * Returns the links it found so the caller can fetch them; this function never
 * touches the network, which is what makes it testable without a build.
 */
export function inspectArchive(html) {
  const failures = [];
  const links = [];
  const section = sectionFor(html);

  if (!section) {
    return { failures: [`/archive has no #${SECTION_ID} section`], links };
  }

  const text = decodeEntities(section);

  if (!text.includes(ARCHIVE_HEADING)) {
    failures.push(`#${SECTION_ID} is missing its heading "${ARCHIVE_HEADING}"`);
  }
  for (const item of ARCHIVE_ITEMS) {
    if (!text.includes(item)) failures.push(`#${SECTION_ID} is missing the item "${item}"`);
  }

  const hrefs = hrefsIn(section);
  for (const href of hrefs) {
    if (pathnameOf(href) === '/voter-info') {
      failures.push(`#${SECTION_ID} links back to /voter-info (${href})`);
    }
  }

  for (const doc of DOCUMENTS) {
    const href = hrefs.find((value) => value.includes(doc.slug) || value.includes(doc.driveId));
    if (!href) {
      failures.push(`#${SECTION_ID} has no link for ${doc.label}`);
      continue;
    }
    links.push({
      ...doc,
      href,
      kind: href.includes('/legacy-documents/') ? 'owned' : href.includes(doc.driveId) ? 'drive' : 'unknown',
    });
  }

  return { failures, links };
}

/**
 * Assert the negative case: `/voter-info` is evergreen only.
 *
 * Anchored on a positive marker too (`Voter Rights & Educational Guides`), so a
 * 200 error page or a redirect target cannot pass by containing nothing.
 */
export function inspectVoterInfo(html) {
  const failures = [];
  // Rendered markup only — see `renderedContent`. The hydration payload names
  // the same data points the archive uses, and it is not page content.
  const rendered = renderedContent(html);
  const text = decodeEntities(rendered);

  if (!text.includes('Voter Rights & Educational Guides')) {
    failures.push('/voter-info is missing its evergreen "Voter Rights & Educational Guides" heading');
  }
  for (const forbidden of VOTER_INFO_FORBIDDEN) {
    if (rendered.includes(forbidden) || text.includes(forbidden)) {
      failures.push(`/voter-info still contains 2026 material: "${forbidden}"`);
    }
  }
  return failures;
}

async function fetchText(fetchImpl, url) {
  const res = await fetchImpl(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', body: await res.text() };
}

/** Follow one document link. Owned copies must be real PDFs; Drive must 200. */
async function checkDocumentLink(fetchImpl, link, siteUrl) {
  const url = new URL(link.href, siteUrl).toString();
  const res = await fetchImpl(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: { Range: 'bytes=0-4' },
    signal: AbortSignal.timeout(60_000),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const okStatus = res.status === 200 || res.status === 206;

  if (!okStatus) return { ok: false, url, kind: link.kind, reason: `HTTP ${res.status}` };
  if (link.kind === 'owned' && (type !== 'application/pdf' || !isPdf)) {
    return { ok: false, url, kind: link.kind, reason: `not a PDF (${type || 'no type'})` };
  }
  if (link.kind === 'unknown') {
    return { ok: false, url, kind: link.kind, reason: 'link matches neither storage slug nor Drive id' };
  }
  return { ok: true, url, kind: link.kind, reason: 'ok' };
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const siteUrlArg = argv.find((arg) => arg.startsWith('--site-url='))?.slice('--site-url='.length);
  if (!siteUrlArg) {
    console.error('✖  --site-url is required, e.g. --site-url=https://test.indivisiblefairoaks.org');
    return 1;
  }
  const siteUrl = siteUrlArg.replace(/\/+$/, '');
  const fetchImpl = deps.fetch ?? fetch;
  const log = deps.log ?? console.log;
  const failures = [];

  log(`Smoke-checking ${siteUrl}`);

  const archive = await fetchText(fetchImpl, `${siteUrl}/archive`);
  if (archive.status !== 200) {
    failures.push(`/archive returned HTTP ${archive.status}`);
  } else {
    const inspection = inspectArchive(archive.body);
    failures.push(...inspection.failures);
    log(`  ${inspection.failures.length === 0 ? '✅' : '✖ '} /archive 2026 block`);
    for (const link of inspection.links) {
      const result = await checkDocumentLink(fetchImpl, link, siteUrl);
      if (!result.ok) failures.push(`${link.label} → ${result.reason} (${result.url})`);
      log(
        `  ${result.ok ? '✅' : '✖ '} ${link.label} [${result.kind}]` +
          `${result.ok ? '' : ` — ${result.reason}`}`
      );
    }
  }

  const voterInfo = await fetchText(fetchImpl, `${siteUrl}/voter-info`);
  if (voterInfo.status !== 200) {
    failures.push(`/voter-info returned HTTP ${voterInfo.status}`);
  } else {
    const negative = inspectVoterInfo(voterInfo.body);
    failures.push(...negative);
    log(`  ${negative.length === 0 ? '✅' : '✖ '} /voter-info has no 2026 material`);
  }

  if (failures.length > 0) {
    console.error(`\n✖  ${failures.length} smoke check failure(s):`);
    for (const failure of failures) console.error(`   - ${failure}`);
    return 1;
  }
  console.log('\n✅  Archive smoke check passed.');
  return 0;
}

const invokedDirectly = process.argv[1]?.endsWith('smoke-archive-2026.mjs');
if (invokedDirectly) {
  try {
    process.exit(await main());
  } catch (error) {
    console.error(`✖  Smoke check could not run: ${error?.message ?? error}`);
    process.exit(1);
  }
}
