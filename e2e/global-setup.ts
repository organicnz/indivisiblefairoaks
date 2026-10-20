import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Global setup: prove the server under test is *this repository's* build.
 *
 * ## The failure this exists to prevent
 *
 * `playwright.config.ts` sets `reuseExistingServer: !Bun.env.CI`, so a
 * local run reuses whatever is already listening on the port instead of
 * starting its own. That is a reasonable convenience — and it is also a way
 * for the suite to test **the wrong application** without saying so.
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
 * ## Why it fails rather than starting its own server
 *
 * It cannot start its own server: the port is occupied, which is the whole
 * reason the foreign server was reached in the first place. So the honest
 * outcome is a failure that **names the cause**, which is the difference
 * between a diagnosis and a symptom.
 *
 * The fix is one of:
 *
 *   - stop whatever is listening on the port, or
 *   - run with `CI=1`, which sets `reuseExistingServer: false` and makes
 *     Playwright refuse to reuse — and report the collision by name.
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

  let html: string;
  try {
    const response = await fetch(baseURL, { redirect: 'follow' });
    html = await response.text();
  } catch (error) {
    throw new Error(
      `\n✖  Could not reach ${baseURL}: ${String((error as Error)?.message ?? error)}\n` +
        '   The web server did not come up.\n'
    );
  }

  const served = servedBuildIds(html);
  if (served.includes(expected)) return;

  const detail =
    served.length === 0
      ? 'the page carries no build id at all'
      : `it is serving build ${served[0]}`;

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
      '   Fix: stop whatever is listening on the port, or run with CI=1, which\n' +
      '   refuses to reuse and reports the collision by name.\n'
  );
}
