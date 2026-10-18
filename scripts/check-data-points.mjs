#!/usr/bin/env node
/**
 * Data-points gate: every seeded key is read, and every read key is seeded.
 *
 * `data_points` is the copy store, and a wired screen reads a key with its JSX
 * literal as the fallback. That contract has two failure modes, both invisible
 * to types and tests alike:
 *
 *   - A seed nobody reads. The CMS shows the row, an editor changes it, and
 *     nothing on the site moves — or worse, the screen was seeded against a UI
 *     revision that never shipped. This repo has 35 of those: the `admin.*`
 *     wave in 20261016130000 named "Operations Dashboard" and "Chapter Store
 *     Catalog", neither of which ever appeared in `src/`.
 *   - A read nobody seeded. The literal silently wins on every render, so the
 *     string stops being CMS-editable with no signal at all. `account.tabs.*`
 *     was read under a plural name for months while the seeds carried the
 *     singular `account.tab.*`.
 *
 * What it checks, read-only:
 *   1. every key seeded in `supabase/migrations/*.sql` is read somewhere in
 *      `src/` — as `name="key"`, `dataPoints['key']`, or the key quoted in a
 *      file (keys are also held in arrays and passed as props), or matches a
 *      template/concat prefix the source builds at render time;
 *   2. every key read via `name=` / `dataPoints[...]` in `src/` has a seed.
 *
 * Exemptions are explicit and reviewed:
 *   - `DERIVED_KEY_FAMILIES` — keys built at runtime from another key's value,
 *     which no static scan can connect to its seed. Each family says where.
 *   - `scripts/data-points-baseline.json` — findings a human accepted with a
 *     reason ("pending wiring", "no matching UI", "superseded"). The baseline
 *     is a ratchet: it fails when a listed key stops being a finding, so a fix
 *     cannot leave its excuse behind.
 *
 * Regenerate the baseline after reviewing new findings:
 *   bun scripts/check-data-points.mjs --update-baseline
 * (new entries are written with a TODO reason that must be replaced by hand).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';
const SRC_DIR = 'src';
const BASELINE_PATH = 'scripts/data-points-baseline.json';

/**
 * Key families that are assembled at runtime from another seed's value, so no
 * static scan can see the finished key. Every entry must name the site that
 * builds it — a broad pattern here silently switches the gate off.
 */
const DERIVED_KEY_FAMILIES = [
  {
    pattern: /^choir\.player\.track\d+_(duration|url)$/,
    reason: "ChoirAudioPlayer derives these from the track's title key",
  },
];

/** A row inside a data_points INSERT: `('<key>', …`. The key is always first. */
const KEY_ROW_RE = /\(\s*'([a-z0-9][a-z0-9_.]*)'\s*,/;

/** A dotted lowercase key — the shape every data point key has. */
const DOTTED_KEY_RE = /^[a-z0-9][a-z0-9_]*(\.[a-z0-9_]+)+$/;

const MIGRATION_NAME_RE = /^\d{14}.*\.sql$/;

/** seed key -> Set(migration files that write it). Only data_points rows count. */
function readSeeds() {
  const seeds = new Map();
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => MIGRATION_NAME_RE.test(f)).sort()) {
    const text = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    let inDataPoints = false;
    for (const line of text.split('\n')) {
      if (/INSERT\s+INTO\s+(public\.)?data_points\b/i.test(line)) inDataPoints = true;
      if (inDataPoints) {
        const m = line.match(KEY_ROW_RE);
        if (m) {
          const files = seeds.get(m[1]) ?? new Set();
          files.add(file);
          seeds.set(m[1], files);
        }
        // Statement ends at `;` — possibly after ON CONFLICT/DO UPDATE SET.
        // A `;` inside a value is never at end-of-line, so it cannot fool this.
        if (/;\s*(--.*)?$/.test(line)) inDataPoints = false;
      }
    }
  }
  return seeds;
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) {
      out.push(path);
    }
  }
}

function put(map, key, file) {
  const files = map.get(key) ?? new Set();
  files.add(file);
  map.set(key, files);
}

/**
 * src/ readers, three ways:
 *   - literal: any quoted key-shaped string. A wired key is always written
 *     somewhere, even when it travels through an array or a prop.
 *   - prefix:  template literals (`donate.calc.tier.${amt}.label`) and string
 *     concatenation (`'link.' + slug`) that finish a key at render time.
 *   - explicit: `name="key"` / `dataPoints['key']` — a *use* of a key, not
 *     merely a mention, and the direction that must have a seed.
 */
function readReaders() {
  const files = [];
  walk(SRC_DIR, files);
  const literal = new Map();
  const prefix = new Map();
  const explicit = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/'([a-z0-9][a-z0-9_.]*)'/g)) put(literal, m[1], file);
    for (const m of text.matchAll(/"([a-z0-9][a-z0-9_.]*)"/g)) put(literal, m[1], file);
    for (const m of text.matchAll(/`([a-z0-9][a-z0-9_.]*)\$\{/g)) {
      if (m[1].includes('.') || m[1].endsWith('_')) put(prefix, m[1], file);
    }
    for (const m of text.matchAll(/([a-z0-9][a-z0-9_.]*)'\s*\+\s*/g)) {
      if (m[1].includes('.') || m[1].endsWith('_')) put(prefix, m[1], file);
    }
    for (const m of text.matchAll(/\bname=\s*"([a-z0-9][a-z0-9_.]*)"/g)) {
      if (DOTTED_KEY_RE.test(m[1])) put(explicit, m[1], file);
    }
    for (const m of text.matchAll(/\bname=\s*'([a-z0-9][a-z0-9_.]*)'/g)) {
      if (DOTTED_KEY_RE.test(m[1])) put(explicit, m[1], file);
    }
    for (const m of text.matchAll(/\bname=\{\s*'([a-z0-9][a-z0-9_.]*)'\s*\}/g)) {
      if (DOTTED_KEY_RE.test(m[1])) put(explicit, m[1], file);
    }
    for (const m of text.matchAll(/\bdataPoints\[\s*'([a-z0-9][a-z0-9_.]*)'\s*\]/g)) {
      put(explicit, m[1], file);
    }
    for (const m of text.matchAll(/\bdataPoints\[\s*"([a-z0-9][a-z0-9_.]*)"\s*\]/g)) {
      put(explicit, m[1], file);
    }
  }
  return { literal, prefix, explicit };
}

function readBaseline() {
  let raw = {};
  try {
    raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // First run: every finding is new. The fix hint below says what to do.
  }
  return {
    acceptedUnread: raw.acceptedUnread ?? {},
    acceptedUnseededReads: raw.acceptedUnseededReads ?? {},
  };
}

function writeBaseline(unread, unseeded, previous) {
  const acceptedUnread = {};
  for (const key of unread) {
    acceptedUnread[key] = previous.acceptedUnread[key] ?? 'TODO: reason (review this finding)';
  }
  const acceptedUnseededReads = {};
  for (const key of unseeded) {
    acceptedUnseededReads[key] =
      previous.acceptedUnseededReads[key] ?? 'TODO: reason (review this finding)';
  }
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $comment:
          'Accepted data-points findings. Each entry records that a human reviewed the ' +
          'mismatch and chose a disposition: "pending wiring" (a seeded key whose screen ' +
          'wire-up is still to come), "no matching UI" (the string the seed names no longer ' +
          'exists) or "superseded" (a later key carries the copy). The gate fails when a ' +
          'finding is not listed here AND when a listed key is no longer a finding, so a ' +
          'fix must delete its own excuse. Regenerate with: ' +
          'bun scripts/check-data-points.mjs --update-baseline',
        updated: new Date().toISOString().slice(0, 10),
        acceptedUnread,
        acceptedUnseededReads,
      },
      null,
      2,
    )}\n`,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const seeds = readSeeds();
const { literal, prefix, explicit } = readReaders();

const isDerived = (key) => DERIVED_KEY_FAMILIES.some((f) => f.pattern.test(key));

const isRead = (key) => {
  if (literal.has(key)) return true;
  for (const p of prefix.keys()) if (key.startsWith(p)) return true;
  return false;
};

const unread = [...seeds.keys()].filter((key) => !isRead(key) && !isDerived(key)).sort();
const unseededReads = [...explicit.keys()].filter((key) => !seeds.has(key)).sort();

const updateBaseline = process.argv.includes('--update-baseline');
const baseline = readBaseline();

if (updateBaseline) {
  writeBaseline(unread, unseededReads, baseline);
  console.log(
    `data-points: baseline updated — ${unread.length} unread seed(s), ` +
      `${unseededReads.length} unseeded read(s). Replace any TODO reasons by hand.`,
  );
  process.exit(0);
}

const failures = [];

for (const key of unread) {
  if (key in baseline.acceptedUnread) continue;
  const files = [...seeds.get(key)].slice(-1)[0];
  failures.push(
    `seeded but unread: ${key} (seeded in ${files})\n` +
      `    wire it (DataPoint name="${key}" / dataPoints['${key}']) or add it to\n` +
      `    ${BASELINE_PATH} with a reason`,
  );
}
for (const key of unseededReads) {
  if (key in baseline.acceptedUnseededReads) continue;
  const files = [...explicit.get(key)].slice(0, 2).join(', ');
  failures.push(
    `read but unseeded: ${key} (used in ${files})\n` +
      `    add a seed row (see a *_seed_*.sql migration) or add it to\n` +
      `    ${BASELINE_PATH} with a reason`,
  );
}
for (const key of Object.keys(baseline.acceptedUnread)) {
  if (!unread.includes(key)) {
    failures.push(
      `baseline entry no longer needed: ${key} (it is read now — or its seed is gone)\n` +
        `    remove it from ${BASELINE_PATH}; the ratchet only shrinks`,
    );
  }
}
for (const key of Object.keys(baseline.acceptedUnseededReads)) {
  if (!unseededReads.includes(key)) {
    failures.push(
      `baseline entry no longer needed: ${key}\n` +
        `    remove it from ${BASELINE_PATH}; the ratchet only shrinks`,
    );
  }
}

if (failures.length > 0) {
  console.error(`data-points: ${failures.length} finding(s)\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `data-points: OK — ${seeds.size} seed(s), ${unread.length} accepted unread, ` +
    `${explicit.size} wired key(s), ${unseededReads.length} accepted unseeded read(s)`,
);
