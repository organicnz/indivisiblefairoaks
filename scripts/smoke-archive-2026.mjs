#!/usr/bin/env bun
/**
 * Post-deploy smoke check for the 2026 voter-guides archive.
 *
 * Three things Erin asked for have no runtime test that can run in CI's unit
 * suite, because they are properties of the *deployed page*:
 *
 *   1. `/archive` renders the moved 2026 block — the anchor, the heading, all
 *      five items, and a link for each of the four documents;
 *   2. `/voter-info` carries none of it;
 *   3. each page serialises only its own voter keys. `/archive` asks Supabase
 *      for the 20 archived keys and `/voter-info` for the 56 evergreen ones.
 *      The RSC payload is part of the response, so an archived key there is the
 *      same regression as a rendered card: it puts copy on the wrong page and
 *      grows the payload that narrowing the fetch removed.
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
 *   bun scripts/smoke-archive-2026.mjs --site-url=... --expect-sha=<full-sha>
 *
 * `--site-url` is required. There is no default host: the repo has repeatedly
 * been bitten by a guessed origin, and a smoke check that quietly probes the
 * wrong host is worse than one that refuses to start.
 *
 * `--expect-sha` is the CI mode. It polls `/api/health` until the host reports
 * that commit before inspecting any page, so a lagging production alias cannot
 * smoke the previous build. The manual deploy workflow asserts the SHA in its
 * own step and omits the flag; its behaviour is otherwise unchanged.
 *
 * Requests retry 404/408/425/429/5xx and network errors with a short backoff,
 * because a fresh alias can answer 404 or 5xx for a few seconds while it
 * settles. A 200 response is inspected on the first attempt, so retries can
 * never hide a payload violation. The retry count and health budget are
 * bounded; there is no unbounded wait.
 */

export const SECTION_ID = 'voter-guides-2026';
export const ARCHIVE_HEADING = '2026 Voter Guide & Ballot Recommendations';

/** Backoff for requests that may race a deployment or alias settling. */
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000];
const HEALTH_POLL_INTERVAL_MS = 5_000;
const HEALTH_BUDGET_MS = 120_000;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A status worth retrying while a deployment settles. */
function retryableStatus(status) {
  return status === 404 || status === 408 || status === 425 || status === 429 || status >= 500;
}

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

/** Archived 2026 key prefixes. `/voter-info` must serialise none of them. */
export const VOTER_INFO_ARCHIVED_KEY_PREFIXES = [
  'voter.guides.',
  'voter.guide.',
  'voter.spotlight.',
];

/** Evergreen voter key prefixes. `/archive` must serialise none of them. */
export const ARCHIVE_EVERGREEN_KEY_PREFIXES = [
  'voter.action.',
  'voter.guide1.',
  'voter.guide2.',
  'voter.guide3.',
  'voter.guide4.',
  'voter.guides_section.',
  'voter.hero.',
  'voter.hotlines.',
  'voter.repfinder.',
];

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

  // The page asks Supabase for the 20 archived keys only. The whole response is
  // checked, not just the section, because the RSC payload carries the
  // serialised data points for the route.
  for (const prefix of ARCHIVE_EVERGREEN_KEY_PREFIXES) {
    if (html.includes(prefix)) {
      failures.push(
        `/archive serialises the evergreen voter key prefix "${prefix}"; it must read only the 2026 keys`
      );
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
 *
 * Scans the whole response, not just rendered markup. The page now asks for its
 * 56 evergreen keys only, so no archived key or 2026 copy belongs anywhere in
 * it — including the RSC payload. Before that narrowing this check had to strip
 * `<script>` tags because the payload legitimately named the archived keys; a
 * gate that still stripped them would miss the payload regression it exists to
 * catch.
 */
export function inspectVoterInfo(html) {
  const failures = [];
  const text = decodeEntities(html);

  if (!text.includes('Voter Rights & Educational Guides')) {
    failures.push('/voter-info is missing its evergreen "Voter Rights & Educational Guides" heading');
  }
  for (const forbidden of VOTER_INFO_FORBIDDEN) {
    if (html.includes(forbidden) || text.includes(forbidden)) {
      failures.push(`/voter-info still contains 2026 material: "${forbidden}"`);
    }
  }
  for (const prefix of VOTER_INFO_ARCHIVED_KEY_PREFIXES) {
    if (html.includes(prefix)) {
      failures.push(
        `/voter-info serialises the archived voter key prefix "${prefix}"; it must read only its evergreen keys`
      );
    }
  }
  return failures;
}

/**
 * Fetch a page, retrying only the statuses a settling deployment can produce.
 * A 200 is returned immediately — the body is what the caller inspects.
 */
async function fetchText(fetchImpl, url, { delays = RETRY_DELAYS_MS, sleep = defaultSleep } = {}) {
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      const res = await fetchImpl(url, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });
      lastResponse = {
        status: res.status,
        contentType: res.headers.get('content-type') ?? '',
        body: await res.text(),
      };
      if (!retryableStatus(res.status) || attempt === delays.length) return lastResponse;
    } catch (error) {
      lastError = error;
      if (attempt === delays.length) throw error;
    }
    await sleep(delays[attempt]);
  }

  if (lastResponse) return lastResponse;
  throw lastError;
}

/** Follow one document link. Owned copies must be real PDFs; Drive must 200. */
async function checkDocumentLink(
  fetchImpl,
  link,
  siteUrl,
  { delays = RETRY_DELAYS_MS, sleep = defaultSleep } = {}
) {
  const url = new URL(link.href, siteUrl).toString();
  let lastFailure = { ok: false, url, kind: link.kind, reason: 'not attempted' };

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
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

      if (!okStatus) {
        lastFailure = { ok: false, url, kind: link.kind, reason: `HTTP ${res.status}` };
        if (retryableStatus(res.status) && attempt < delays.length) {
          await sleep(delays[attempt]);
          continue;
        }
        return lastFailure;
      }
      if (link.kind === 'owned' && (type !== 'application/pdf' || !isPdf)) {
        return { ok: false, url, kind: link.kind, reason: `not a PDF (${type || 'no type'})` };
      }
      if (link.kind === 'unknown') {
        return {
          ok: false,
          url,
          kind: link.kind,
          reason: 'link matches neither storage slug nor Drive id',
        };
      }
      return { ok: true, url, kind: link.kind, reason: 'ok' };
    } catch (error) {
      lastFailure = {
        ok: false,
        url,
        kind: link.kind,
        reason: `request failed (${error?.message ?? error})`,
      };
      if (attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      return lastFailure;
    }
  }

  return lastFailure;
}

/**
 * Wait for the host to report exactly the commit CI pushed.
 *
 * `do…while` so the first probe always happens: a zero budget must mean "one
 * attempt", not "never asked". The caller turns a mismatch into a failure, so
 * a lagging alias cannot masquerade as a passing smoke check against the
 * previous build.
 */
async function waitForCommit(
  fetchImpl,
  siteUrl,
  expectSha,
  { budgetMs = HEALTH_BUDGET_MS, intervalMs = HEALTH_POLL_INTERVAL_MS, sleep = defaultSleep } = {}
) {
  const deadline = Date.now() + budgetMs;
  let lastCommit = null;
  let attempts = 0;

  do {
    attempts += 1;
    try {
      const res = await fetchImpl(`${siteUrl}/api/health`, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 200) {
        const body = await res.json().catch(() => null);
        lastCommit = body?.deployment?.commit ?? null;
        if (lastCommit === expectSha) return { ok: true, commit: lastCommit, attempts };
      } else {
        lastCommit = `HTTP ${res.status}`;
      }
    } catch (error) {
      lastCommit = error?.message ?? String(error);
    }
    if (Date.now() >= deadline) break;
    await sleep(intervalMs);
  } while (Date.now() < deadline);

  return { ok: false, commit: lastCommit, attempts };
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const siteUrlArg = argv.find((arg) => arg.startsWith('--site-url='))?.slice('--site-url='.length);
  if (!siteUrlArg) {
    console.error('✖  --site-url is required, e.g. --site-url=https://test.indivisiblefairoaks.org');
    return 1;
  }
  const siteUrl = siteUrlArg.replace(/\/+$/, '');
  const expectSha = argv.find((arg) => arg.startsWith('--expect-sha='))?.slice('--expect-sha='.length);
  const healthBudgetArg = argv
    .find((arg) => arg.startsWith('--health-budget-ms='))
    ?.slice('--health-budget-ms='.length);
  const healthBudgetMs = healthBudgetArg === undefined ? HEALTH_BUDGET_MS : Number(healthBudgetArg);
  const fetchImpl = deps.fetch ?? fetch;
  const log = deps.log ?? console.log;
  const sleep = deps.sleep ?? defaultSleep;
  const retryDelays = deps.retryDelays ?? RETRY_DELAYS_MS;
  const failures = [];

  if (!Number.isFinite(healthBudgetMs) || healthBudgetMs < 0) {
    console.error('✖  --health-budget-ms must be a non-negative number of milliseconds.');
    return 1;
  }

  log(`Smoke-checking ${siteUrl}`);

  if (expectSha) {
    log(`Waiting for ${siteUrl} to serve ${expectSha.slice(0, 8)}…`);
    const live = await waitForCommit(fetchImpl, siteUrl, expectSha, {
      budgetMs: healthBudgetMs,
      intervalMs: deps.healthPollIntervalMs ?? HEALTH_POLL_INTERVAL_MS,
      sleep,
    });
    if (!live.ok) {
      console.error(
        `✖  ${siteUrl} is serving ${live.commit ?? 'nothing'}, not ${expectSha}. Refusing to smoke a different build.`
      );
      return 1;
    }
    log(`  ✅ live commit ${live.commit.slice(0, 8)}`);
  }

  const requestOptions = { delays: retryDelays, sleep };
  const archive = await fetchText(fetchImpl, `${siteUrl}/archive`, requestOptions);
  if (archive.status !== 200) {
    failures.push(`/archive returned HTTP ${archive.status}`);
  } else {
    const inspection = inspectArchive(archive.body);
    failures.push(...inspection.failures);
    log(`  ${inspection.failures.length === 0 ? '✅' : '✖ '} /archive 2026 block`);
    for (const link of inspection.links) {
      const result = await checkDocumentLink(fetchImpl, link, siteUrl, requestOptions);
      if (!result.ok) failures.push(`${link.label} → ${result.reason} (${result.url})`);
      log(
        `  ${result.ok ? '✅' : '✖ '} ${link.label} [${result.kind}]` +
          `${result.ok ? '' : ` — ${result.reason}`}`
      );
    }
  }

  const voterInfo = await fetchText(fetchImpl, `${siteUrl}/voter-info`, requestOptions);
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
