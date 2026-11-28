import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Global setup: prove the server under test is *this repository's* build.
 *
 * ## The failure this exists to prevent
 *
 * Playwright used to reuse whatever was already listening on the e2e port,
 * so a local run could test **the wrong application** without saying so.
 *
 * It happened on this repository. Another Next.js app on the same machine was
 * listening on the e2e port; Playwright reused it; the suite drove it; and
 * the first thing that failed was `waiting for locator('#auth-tab-password')`
 * — an element the *other* application does not have. The error named a
 * locator and said nothing about the fact that the entire suite was pointed
 * at a different product. Ninety-four tests "did not run", and the report
 * looked like a product regression.
 *
 * The page snapshot gave it away — the foreign app's name, in the header.
 *
 * The config no longer reuses a server at all. It starts one on a free port
 * and this check is the second guard: a server that came up on that port but
 * is not serving the build in `.next` still fails before any spec runs.
 *
 * ## What this checks
 *
 * Next.js writes a build id to `.next/BUILD_ID`, and the served HTML carries
 * it in the RSC flight payload as `"b":"<build id>"` — on every route, exactly
 * once. So the build id is a precise marker for **both** questions that
 * matter:
 *
 *   - *which application* is answering — a different app has a different
 *     build id; and
 *   - *which build* of this application — a stale server has a stale build id.
 *
 * The second matters as much as the first. A server left running from an
 * earlier build of this repository would pass the suite against code that is
 * no longer the code.
 *
 * ## Why it fails rather than skipping
 *
 * If the server on the selected port is not this build, the suite would be
 * measuring something else. The honest outcome is a failure that **names the
 * cause**, which is the difference between a diagnosis and a symptom. The
 * config starts a fresh server on a port it verified is free; a remaining
 * mismatch is a stale or foreign process that won the race for the port.
 *
 * ## What it does not do
 *
 * It does not check that the *content* is correct. It answers one question —
 * "is this the build I asked to test?" — and it answers it from the build
 * id rather than from anything a page happens to contain.
 */

/** The build id of the build in `.next`, or `null` when there is no build. */
async function readBuildId(): Promise<string | null> {
  try {
    const text = await readFile(path.join(import.meta.dirname, '..', '.next', 'BUILD_ID'), 'utf8');
    const id = text.trim();
    return id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * The build ids the server under test is serving.
 *
 * Next.js writes the build id into the RSC flight payload as the segment's
 * `b` field — `"b":"<build id>"`. The payload is embedded in a `<script>` as
 * a JSON *string*, so its quotes arrive **escaped**: `\"b\":\"<build id>\"`.
 * The escaping is undone first, so the pattern can stay precise about the
 * *field* rather than about how the field is quoted.
 *
 * Reading the field rather than searching for the id as a bare substring is
 * deliberate: a page that merely *mentions* the id would satisfy a bare
 * search, and this is a check about the server's identity.
 */
function servedBuildIds(html: string): string[] {
  const unescaped = html.replace(/\\"/g, '"');
  const ids = new Set<string>();
  for (const match of unescaped.matchAll(/"b":"([A-Za-z0-9_-]{8,})"/g)) {
    ids.add(match[1]);
  }
  return [...ids];
}

/** How long the server has to identify itself before the check gives up. */
const STREAM_READ_TIMEOUT_MS = 15_000;

/**
 * The served HTML, read only until the server has identified its build.
 *
 * `/` is a partial prerender: `next start` sends the static shell at once and
 * streams the dynamic holes behind it. `await response.text()` waits for the
 * **last** byte, so it also waits for a data read that has nothing to do with
 * which build is answering. When that read stalls the body never closes, and
 * the gate hangs before a single test starts: no reporter output, no HTML
 * report, and nothing but the job's ceiling to end it.
 *
 * That is what four cancelled runs looked like — an empty `Run E2E tests`
 * step for the whole twenty minutes, while the cancelled build that preceded
 * them kept its log, so the emptiness was real and not a logging artifact.
 *
 * The build id arrives in the first few kilobytes of the shell's flight
 * payload (measured at about 4 KB on this homepage), so the check can finish
 * while the holes are still streaming. If the shell has not identified itself
 * within `STREAM_READ_TIMEOUT_MS`, the caller reports a stalled stream instead
 * of waiting for a page that may never finish.
 */
async function readUntilIdentified(
  response: Response
): Promise<{ html: string; stalled: boolean }> {
  if (!response.body) return { html: '', stalled: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // One deadline for the whole read: this bounds the check, not the page.
  const deadline = Bun.sleep(STREAM_READ_TIMEOUT_MS).then(() => 'deadline' as const);
  let html = '';
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next === 'deadline') return { html, stalled: true };
      if (next.done) return { html: html + decoder.decode(), stalled: false };
      html += decoder.decode(next.value, { stream: true });
      if (servedBuildIds(html).length > 0) return { html, stalled: false };
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/**
 * The base URL the suite is about to drive.
 *
 * `baseURL` is a **project-level** `use` option, so it is read from
 * `config.projects[0].use` — not from `config.use`, which does not carry it.
 * That distinction is the difference between a check that runs and a check
 * that silently does nothing: an earlier version of this file read
 * `config.use?.baseURL`, found `undefined`, and returned early — so it
 * reported success while measuring nothing, which is the failure mode this
 * whole file exists to prevent.
 */
function resolveBaseURL(config: {
  use?: { baseURL?: string };
  projects?: { use?: { baseURL?: string } }[];
}): string | null {
  return config.projects?.[0]?.use?.baseURL ?? config.use?.baseURL ?? null;
}

export default async function globalSetup(config: {
  use?: { baseURL?: string };
  projects?: { use?: { baseURL?: string } }[];
}): Promise<void> {
  const baseURL = resolveBaseURL(config);
  if (!baseURL) {
    // A check that cannot find its target must not report success.
    throw new Error(
      '\n✖  The e2e suite has no baseURL, so the server under test cannot be identified.\n' +
        '   Set `use.baseURL` in playwright.config.ts.\n'
    );
  }

  const expected = await readBuildId();
  if (!expected) {
    throw new Error(
      '\n' +
        '✖  No build at .next/BUILD_ID — the e2e suite tests a production build, not a dev server.\n' +
        '   Build it first:\n' +
        '     bun run build\n'
    );
  }

  const startedAt = performance.now();
  let shell: { html: string; stalled: boolean };
  try {
    const response = await fetch(baseURL, { redirect: 'follow' });
    shell = await readUntilIdentified(response);
  } catch (error) {
    throw new Error(
      `\n✖  Could not reach ${baseURL}: ${String((error as Error)?.message ?? error)}\n` +
        '   The web server did not come up.\n'
    );
  }

  const served = servedBuildIds(shell.html);
  if (served.includes(expected)) {
    // One line, because the alternative — a gate that says nothing — is what
    // made a pre-run stall indistinguishable from a suite that ran and was
    // cancelled.
    console.log(
      `[e2e] ${baseURL} identified ${expected} in ${Math.round(performance.now() - startedAt)}ms`
    );
    return;
  }

  const detail =
    served.length > 0
      ? `it is serving build ${served[0]}`
      : shell.stalled
        ? `the response was still streaming after ${STREAM_READ_TIMEOUT_MS / 1000}s without identifying a build`
        : 'the page carries no build id at all';

  throw new Error(
    '\n' +
      '✖  The server on the e2e port is not serving this build.\n' +
      `   Expected build ${expected} — ${detail}.\n` +
      '\n' +
      '   Two things cause this, and they need different fixes:\n' +
      '\n' +
      '   • Another application is listening on the port. The suite would drive\n' +
      '     that application instead of this one, and every result would be\n' +
      '     about the wrong product.\n' +
      '\n' +
      '   • A stale server from an earlier build of this repository is listening.\n' +
      '     The suite would pass against code that is no longer the code.\n' +
      '\n' +
      '   Fix: stop whatever is listening on the port and rerun. The config\n' +
      '   starts its own server on a free port; it never adopts this one.\n'
  );
}
