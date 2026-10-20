#!/usr/bin/env bun
/**
 * Auth-redirect reconciliation.
 *
 * `site_url` and `uri_allow_list` on the hosted project are the two settings that
 * decide where a magic link goes and whether the resulting callback is accepted.
 * Neither is readable from the repository, and no offline guard can see them, so
 * they are exactly the kind of state that rots unnoticed — which is how this
 * project's hosted auth sat pointing at `https://ai.foodshare.club` while the
 * application served `https://test.indivisiblefairoaks.org`. Every magic link
 * went to an unrelated domain with broken TLS, and because the allow-list named
 * only that wrong host, this project's own callback was rejected too. Login was
 * broken in a way no test, no build and no code review could have surfaced.
 *
 * Two modes, following the same split as `secrets-audit.mjs`:
 *
 *   --offline (default in pre-commit)  No network, no token. Proves the
 *       repository cannot reintroduce the code-side cause: an absolute auth
 *       redirect URL baked into source. The login page builds its callback from
 *       `window.location.origin`, so the app is correct by construction and the
 *       hosted settings are the only place the origin can go wrong.
 *
 *   --live (nightly, in `secret-audit.yml`)  Reconciles the hosted settings
 *       against the origin this deployment actually serves.
 *
 * UNKNOWN is never "clean": an absent token or absent expected origin reports
 * UNKNOWN and exits 0, the same reasoning as the secret audit's unreadable
 * stores. A guard that manufactures a failure on a correct configuration gets
 * bypassed, which is worse than no guard.
 *
 * Usage:
 *   bun scripts/check-auth-redirects.mjs [--offline|--live]
 * Exit 0 = clean or UNKNOWN, 1 = a finding.
 */
import path from 'node:path';
import { PROJECT_REF } from './hooks/_project-ref.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LIVE = process.argv.includes('--live');

/** Hosts an auth redirect may legitimately name. Anything else is drift. */
const KNOWN_HOSTS = new Set([
  'indivisiblefairoaks.org',
  'www.indivisiblefairoaks.org',
  'test.indivisiblefairoaks.org',
  'localhost',
]);

/**
 * The origin this deployment serves, and therefore the only host the hosted
 * `site_url` may name. `NEXT_PUBLIC_SITE_URL` is already a declared repository
 * variable and the value in `.env.local`, so this reads a source of truth that
 * exists rather than introducing a fourth place to keep in sync.
 */
async function expectedOrigin() {
  const fromEnv = Bun.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  try {
    const line = await Bun.file(path.join(ROOT, '.env.local')).text()
      .split('\n')
      .find((l) => l.startsWith('NEXT_PUBLIC_SITE_URL='));
    if (line) return line.slice('NEXT_PUBLIC_SITE_URL='.length).trim().replace(/\/+$/, '');
  } catch {
    // No .env.local — CI, or a fresh clone. Reported as UNKNOWN by the caller.
  }
  return null;
}

/**
 * Test files are excluded, and deliberately rather than incidentally: a unit
 * test asserting a redirect target has to name an absolute URL, because that is
 * the thing under test. Flagging those would be four findings on correct code
 * from the first run, and a guard red on the day it lands is a guard people pass
 * with `LEFTHOOK_EXCLUDE` and then never read again.
 */
function isTestFile(file) {
  return (
    file.includes(`${path.sep}__tests__${path.sep}`) ||
    /\.(test|spec)\.(ts|tsx|mjs)$/.test(file)
  );
}

async function walk(dir) {
  // `Bun.Glob` rather than `node:fs`'s `readdir` + `stat` per entry. The
  // pattern states the query, and the walk does not block the event loop.
  //
  // A missing directory throws — the glob scan opens the directory and fails
  // to find it — which is what the caller's `try`/`catch` expects.
  const glob = new Bun.Glob('**/*.{ts,tsx,mjs}');
  const out = [];
  for await (const rel of glob.scan({ cwd: dir, dot: true })) {
    if (rel.split('/').some((s) => s === 'node_modules' || s === '.next')) continue;
    const full = path.join(dir, rel);
    if (isTestFile(full)) continue;
    out.push(full);
  }
  // `Bun.Glob` does not promise an order, and a report whose findings move
  // between runs cannot be diffed against the previous one.
  out.sort();
  return out;
}

// ── Offline: the code-side cause ─────────────────────────────────────────────

/**
 * Flag an absolute `…/auth/callback` URL in source.
 *
 * This is the shape that reintroduces the bug locally. `window.location.origin`
 * is correct on every host and needs no configuration; a literal is correct on
 * exactly one, so it silently breaks staging and previews — and it breaks them
 * the same way this project was broken, which is why it is worth a guard rather
 * than a review convention.
 */
async function scanHardcodedRedirectOrigins() {
  const findings = [];
  const pattern = /['"`]https?:\/\/[^'"`\s]*\/auth\/callback/g;
  for (const base of ['src', 'supabase/functions']) {
    const dir = path.join(ROOT, base);
    let files;
    try {
      files = await walk(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const text = await Bun.file(file).text();
      for (const [i, line] of text.split('\n').entries()) {
        for (const match of line.matchAll(pattern)) {
          findings.push({
            label: 'hardcoded auth redirect origin',
            file: path.relative(ROOT, file),
            line: i + 1,
            detail: match[0].replace(/^['"`]|['"`]$/g, ''),
          });
        }
      }
    }
  }
  return findings;
}

// ── Live: the hosted settings ────────────────────────────────────────────────

async function fetchAuthConfig() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${Bun.env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/**
 * Split the stored allow-list the way GoTrue does: on commas.
 *
 * Deliberately not on newlines. Accepting a newline as a separator would mask
 * the exact corruption this exists to catch, because the stripped-newline write
 * leaves no separator to find.
 */
function parseAllowList(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Reconcile `site_url` and the redirect allow-list.
 *
 * GoTrue splits the allow-list on **commas** — `GOTRUE_URI_ALLOW_LIST` is
 * documented as "a comma separated list of URIs" and the config field is a
 * `[]string` populated by go-envconfig, which splits slices on commas. Newlines
 * are not a separator at all: the Management API strips them from a multi-line
 * value before storing, which silently collapses three URLs into one entry that
 * matches nothing. So the parse here is comma-based, and a stored value holding
 * several concatenated URLs is a finding rather than a partially successful fix —
 * it looks configured while rejecting every callback.
 */
async function checkLive() {
  const origin = await expectedOrigin();
  if (!origin) {
    return { status: 'UNKNOWN', reason: 'NEXT_PUBLIC_SITE_URL is not set in the environment or .env.local' };
  }
  if (!Bun.env.SUPABASE_ACCESS_TOKEN) {
    return { status: 'UNKNOWN', reason: 'SUPABASE_ACCESS_TOKEN is not set' };
  }

  let config;
  try {
    config = await fetchAuthConfig();
  } catch (err) {
    return { status: 'UNKNOWN', reason: `could not read hosted auth config: ${err.message}` };
  }

  const findings = [];
  const expectedCallback = `${origin}/auth/callback`;

  if (config.site_url !== origin) {
    findings.push({
      label: 'hosted site_url points at the wrong origin',
      detail: `site_url is ${config.site_url}, this deployment serves ${origin}`,
      fix: `PATCH /v1/projects/${PROJECT_REF}/config/auth with site_url=${origin}`,
    });
  }

  const entries = parseAllowList(config.uri_allow_list);

  if (!entries.includes(expectedCallback)) {
    findings.push({
      label: 'redirect allow-list does not permit this deployment callback',
      detail: `expected ${expectedCallback}, allow-list is [${entries.join(', ') || 'empty'}]`,
      fix: `Set uri_allow_list to a comma-separated list including ${expectedCallback}`,
    });
  }

  // Several URLs stored with no separator is the silent-corruption case: it is a
  // single entry matching nothing, which reads as configured and rejects every
  // callback. It can pass the membership test above when the first URL happens
  // to be the right one, so it is counted separately.
  for (const entry of entries) {
    if ((entry.match(/https?:\/\//g) ?? []).length > 1) {
      findings.push({
        label: 'allow-list entries were concatenated rather than comma-separated',
        detail: entry,
        fix: 'Rewrite as a comma-separated list — newlines are stripped on write',
      });
    }
  }

  for (const entry of entries) {
    let host;
    try {
      host = new URL(entry).host;
    } catch {
      findings.push({
        label: 'allow-list entry is not a URL',
        detail: entry,
        fix: 'Replace it with an absolute URL',
      });
      continue;
    }
    if (!KNOWN_HOSTS.has(host)) {
      findings.push({
        label: 'allow-list names an unrelated host',
        detail: `${host} (from ${entry})`,
        fix: 'Remove it unless this project genuinely serves that host',
      });
    }
  }

  return { status: findings.length ? 'DRIFT' : 'CLEAN', origin, entries, findings };
}

// ── Report ───────────────────────────────────────────────────────────────────

const report = (line) => console.log(line);

if (!LIVE) {
  const findings = await scanHardcodedRedirectOrigins();
  report('Auth redirects — offline (no network)');
  if (findings.length === 0) {
    report('  [OK] no absolute auth redirect origin in application source; callbacks derive from the serving host');
  }
  for (const f of findings) {
    report(`  [DRIFT] ${f.label}`);
    report(`          ${f.file}:${f.line} — ${f.detail}`);
    report('          Build it from window.location.origin so it is correct on every host');
  }
  report('');
  report(
    findings.length
      ? `${findings.length} finding(s). The hosted settings are checked nightly by --live.`
      : 'The hosted site_url and allow-list are still invisible here — they need --live.'
  );
  process.exit(findings.length ? 1 : 0);
}

const result = await checkLive();
report('Auth redirects — live (hosted Supabase project)');
if (result.status === 'UNKNOWN') {
  report(`  [UNKNOWN] ${result.reason}`);
  report('  Not treated as clean and not treated as drift.');
} else if (result.status === 'CLEAN') {
  report(`  [OK] site_url and redirect allow-list match ${result.origin}`);
} else {
  report(`  [DRIFT] serving origin ${result.origin}`);
  for (const f of result.findings) {
    report(`  [DRIFT] ${f.label}`);
    report(`          ${f.detail}`);
    report(`          fix: ${f.fix}`);
  }
}
report('');
if (result.status === 'DRIFT') {
  report('Note: the Management API stores exactly one redirect entry — it strips the');
  report('newlines from a multi-line value, and GoTrue parses newlines. Additional hosts');
  report('must be added in the dashboard, not through this API.');
}
process.exit(result.status === 'DRIFT' ? 1 : 0);