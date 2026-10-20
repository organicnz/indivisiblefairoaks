#!/usr/bin/env bun
/**
 * Data-points gate: seeds ↔ readers in both directions, plus the fallback
 * literal each reader paints before its read resolves.
 *
 * `data_points` is the copy store, and a wired screen reads a key with its JSX
 * literal as the fallback. That contract has three failure modes, all invisible
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
 *   - A fallback that disagrees with its seed. The fetched value replaces the
 *     literal the moment the read succeeds, so the string a visitor sees
 *     depends on Supabase being reachable — and the editor reads the CMS,
 *     changes the row, and cannot see that the screen was already telling a
 *     different story. 42 of these shipped: `walle.action.clear` read "Reset
 *     conversation" against a seed saying "Clear conversation", and the list
 *     was aligned to the shipped copy by 20261017040000.
 *
 * What it checks, read-only:
 *   1. every key seeded in `supabase/migrations/*.sql` is read somewhere in
 *      `src/` — as `name="key"`, `dataPoints['key']`, or the key quoted in a
 *      file (keys are also held in arrays and passed as props), or matches a
 *      template/concat prefix the source builds at render time;
 *   2. every key read via `name=` / `dataPoints[...]` in `src/` has a seed;
 *   3. every fallback literal — `dataPoints['key'] || 'literal'`,
 *      `<DataPoint name="key">literal</DataPoint>`, or a `'key': 'literal'`
 *      map entry (the shape a page passes as `initialData`) — appears among
 *      the string literals of the key's seed rows. The seed side accepts any
 *      literal of the rows rather than a guessed value position, because the
 *      tuple order varies per migration file — some write (key, group, label,
 *      value), others (key, value, group, label). The cost is that a fallback
 *      carrying a superseded wording is out of this gate's reach; that is
 *      accepted rather than guessed at. A fallback containing a JSX expression
 *      is counted as skipped, never compared.
 *
 * Exemptions are explicit and reviewed:
 *   - `DERIVED_KEY_FAMILIES` — keys built at runtime from another key's value,
 *     which no static scan can connect to its seed. Each family says where.
 *   - `scripts/data-points-baseline.json` — findings a human accepted with a
 *     reason ("pending wiring", "no matching UI", "superseded"). The baseline
 *     is a ratchet: it fails when a listed finding stops being a finding, so a
 *     fix cannot leave its excuse behind.
 *
 * Regenerate the baseline after reviewing new findings:
 *   bun scripts/check-data-points.mjs --update-baseline
 * (new entries are written with a TODO reason that must be replaced by hand).
 */
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

/** A row that owns its line — the only rows whose literals can be collected. */
const FULL_ROW_RE = /^\s*\(\s*'[a-z0-9][a-z0-9_.]*'\s*,/;

/** SQL string literals; `''` is the escape for an embedded quote. */
const SQL_LITERAL_RE = /'((?:[^']|'')*)'/g;

/** A dotted lowercase key — the shape every data point key has. */
const DOTTED_KEY_RE = /^[a-z0-9][a-z0-9_]*(\.[a-z0-9_]+)+$/;

const MIGRATION_NAME_RE = /^\d{14}.*\.sql$/;

/** The three fallback shapes the equality check reads. */
const INLINE_SINGLE_RE =
  /\bdataPoints\[\s*'([a-z0-9][a-z0-9_.]*)'\s*\]\s*(?:\|\||\?\?)\s*'((?:[^'\\]|\\.)*)'/g;
const INLINE_DOUBLE_RE =
  /\bdataPoints\[\s*"([a-z0-9][a-z0-9_.]*)"\s*\]\s*(?:\|\||\?\?)\s*"((?:[^"\\]|\\.)*)"/g;
const JSX_BLOCK_RE = /<DataPoint\b[^>]*>\s*([^<{][^<]*?)\s*<\s*\/\s*DataPoint>/gs;
const JSX_NAME_RE = /\bname=\s*[{"']+([a-z0-9][a-z0-9_.]*)/;
const MAP_ENTRY_RE = /'([a-z0-9][a-z0-9_.]*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g;

/** HTML entities a JSX child carries instead of the character itself. */
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&ldquo;': '\u201c',
  '&rdquo;': '\u201d',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&rarr;': '→',
  '&larr;': '←',
  '&nbsp;': ' ',
  '&middot;': '·',
};

/**
 * JSX child text as it renders: `{' '}` joins collapse, entities decode, and
 * whitespace runs (indentation, newlines) collapse to single spaces.
 */
function decodeJsxText(raw) {
  let out = raw.replaceAll(/\{' '\}/g, ' ').replaceAll(/\{'\s'\}/g, ' ');
  for (const [entity, character] of Object.entries(ENTITIES)) {
    out = out.replaceAll(entity, character);
  }
  return out.replaceAll(/\s+/g, ' ').trim();
}

/**
 * The migration filenames in the migrations directory.
 *
 * `Bun.Glob` rather than `node:fs`'s `readdir`: the pattern states the
 * query, and the walk does not block the event loop. A missing directory
 * throws, exactly as `readdirSync` did.
 */
async function listMigrations() {
  const glob = new Bun.Glob('*.sql');
  const files = [];
  for await (const name of glob.scan({ cwd: MIGRATIONS_DIR })) files.push(name);
  return files;
}

/**
 * seed key -> Set(migration files that write it), plus the string literals of
 * the key's rows. Only data_points rows count, and only a row that owns its
 * line contributes literals — a mid-line `('key',` inside some other statement
 * would otherwise collect the wrong strings. (Rows are single-line; a wrapped
 * row contributes no literals, and a reviewer adjudicates the finding it
 * raises.)
 */
async function readSeeds() {
  const seeds = new Map();
  const seedLiterals = new Map();
  for (const file of (await listMigrations()).filter((f) => MIGRATION_NAME_RE.test(f)).sort()) {
    const text = await Bun.file(join(MIGRATIONS_DIR, file)).text();
    let inDataPoints = false;
    for (const line of text.split('\n')) {
      if (/INSERT\s+INTO\s+(public\.)?data_points\b/i.test(line)) inDataPoints = true;
      if (inDataPoints) {
        const m = line.match(KEY_ROW_RE);
        if (m) {
          const files = seeds.get(m[1]) ?? new Set();
          files.add(file);
          seeds.set(m[1], files);
          if (FULL_ROW_RE.test(line)) {
            const tail = line.slice(m.index + m[0].length);
            // A `--` comment can only trail the row, after its closing paren;
            // an en dash run inside a value is not a comment.
            const close = tail.lastIndexOf(')');
            const comment = close === -1 ? -1 : tail.indexOf('--', close);
            const set = seedLiterals.get(m[1]) ?? new Set();
            for (const lit of (comment === -1 ? tail : tail.slice(0, comment)).matchAll(
              SQL_LITERAL_RE,
            )) {
              set.add(lit[1].replaceAll("''", "'"));
            }
            seedLiterals.set(m[1], set);
          }
        }
        // Statement ends at `;` — possibly after ON CONFLICT/DO UPDATE SET.
        // A `;` inside a value is never at end-of-line, so it cannot fool this.
        if (/;\s*(--.*)?$/.test(line)) inDataPoints = false;
      }
    }
  }
  return { seeds, seedLiterals };
}

async function walk(dir, out) {
  // `Bun.Glob` rather than `node:fs`'s `readdir` + `stat` per entry. The
  // pattern states the query — "every TypeScript file under this root" — and
  // the walk does not block the event loop or stat every entry to decide
  // whether it is a directory.
  const glob = new Bun.Glob('**/*.{ts,tsx}');
  for await (const rel of glob.scan({ cwd: dir, dot: true })) {
    const segments = rel.split('/');
    if (segments.some((s) => s === '__tests__' || s === 'node_modules')) continue;
    if (rel.includes('.test.')) continue;
    out.push(join(dir, rel));
  }
  // `Bun.Glob` does not promise an order, and a report whose findings move
  // between runs cannot be diffed against the previous one.
  out.sort();
}

function put(map, key, file) {
  const files = map.get(key) ?? new Set();
  files.add(file);
  map.set(key, files);
}

/**
 * src/ readers, four ways:
 *   - literal: any quoted key-shaped string. A wired key is always written
 *     somewhere, even when it travels through an array or a prop.
 *   - prefix:  template literals (`donate.calc.tier.${amt}.label`) and string
 *     concatenation (`'link.' + slug`) that finish a key at render time.
 *   - explicit: `name="key"` / `dataPoints['key']` — a *use* of a key, not
 *     merely a mention, and the direction that must have a seed.
 *   - fallbacks: the literal painted before the read resolves, in the three
 *     shapes above. A pair that is really a ternary branch (`c ? 'a.b' : 'c.d'`)
 *     is skipped: its right-hand side is another key, not a value. A JSX child
 *     holding an expression, or a mis-captured arrow-function prop, is carried
 *     with `skipped: true` — counted, never compared.
 */
async function readReaders() {
  const files = [];
  await walk(SRC_DIR, files);
  const literal = new Map();
  const prefix = new Map();
  const explicit = new Map();
  const fallbacks = [];
  for (const file of files) {
    const text = await Bun.file(file).text();
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

    for (const m of text.matchAll(INLINE_SINGLE_RE)) {
      fallbacks.push({ key: m[1], file, shape: 'inline', text: m[2].replaceAll("\\'", "'") });
    }
    for (const m of text.matchAll(INLINE_DOUBLE_RE)) {
      fallbacks.push({ key: m[1], file, shape: 'inline', text: m[2].replaceAll('\\"', '"') });
    }
    for (const m of text.matchAll(JSX_BLOCK_RE)) {
      const keyMatch = m[0].match(JSX_NAME_RE);
      if (!keyMatch) continue;
      const raw = m[1];
      // `}` or `>` in a captured child means the open tag ended early (an
      // arrow-function prop); comparing that capture would flag correct code.
      if (/\{(?!' '\})/.test(raw) || /[}>]/.test(raw)) {
        fallbacks.push({ key: keyMatch[1], file, shape: 'jsx', text: raw, skipped: true });
        continue;
      }
      fallbacks.push({ key: keyMatch[1], file, shape: 'jsx', text: decodeJsxText(raw) });
    }
    for (const m of text.matchAll(MAP_ENTRY_RE)) {
      // `c ? 'a.b' : 'c.d'` is two keys and a branch, not an entry whose value
      // is `c.d`.
      if (text.slice(0, m.index).trimEnd().endsWith('?')) continue;
      fallbacks.push({ key: m[1], file, shape: 'map', text: m[2].replaceAll("\\'", "'") });
    }
  }
  return { literal, prefix, explicit, fallbacks };
}

function mismatchId(fallback) {
  return `${fallback.key} @ ${fallback.file} (${fallback.shape})`;
}

async function readBaseline() {
  let raw = {};
  try {
    raw = JSON.parse(await Bun.file(BASELINE_PATH).text());
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // First run: every finding is new. The fix hint below says what to do.
  }
  return {
    acceptedUnread: raw.acceptedUnread ?? {},
    acceptedUnseededReads: raw.acceptedUnseededReads ?? {},
    acceptedMismatches: raw.acceptedMismatches ?? {},
  };
}

async function writeBaseline(unread, unseeded, mismatches, previous) {
  const acceptedUnread = {};
  for (const key of unread) {
    acceptedUnread[key] = previous.acceptedUnread[key] ?? 'TODO: reason (review this finding)';
  }
  const acceptedUnseededReads = {};
  for (const key of unseeded) {
    acceptedUnseededReads[key] =
      previous.acceptedUnseededReads[key] ?? 'TODO: reason (review this finding)';
  }
  const acceptedMismatches = {};
  for (const id of mismatches) {
    acceptedMismatches[id] = previous.acceptedMismatches[id] ?? 'TODO: reason (review this finding)';
  }
  await Bun.write(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $comment:
          'Accepted data-points findings. Each entry records that a human reviewed the ' +
          'mismatch and chose a disposition: "pending wiring" (a seeded key whose screen ' +
          'wire-up is still to come), "no matching UI" (the string the seed names no longer ' +
          'exists) or "superseded" (a later key carries the copy). `acceptedUnread` and ' +
          '`acceptedUnseededReads` are keyed by data-point key; `acceptedMismatches` is ' +
          'keyed by `<key> @ <file> (<shape>)` with shape inline, jsx or map. The gate fails ' +
          'when a finding is not listed here AND when a listed entry is no longer a finding, ' +
          'so a fix must delete its own excuse. Regenerate with: ' +
          'bun scripts/check-data-points.mjs --update-baseline',
        updated: new Date().toISOString().slice(0, 10),
        acceptedUnread,
        acceptedUnseededReads,
        acceptedMismatches,
      },
      null,
      2,
    )}\n`,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { seeds, seedLiterals } = await readSeeds();
const { literal, prefix, explicit, fallbacks } = await readReaders();

const isDerived = (key) => DERIVED_KEY_FAMILIES.some((f) => f.pattern.test(key));

const isRead = (key) => {
  if (literal.has(key)) return true;
  for (const p of prefix.keys()) if (key.startsWith(p)) return true;
  return false;
};

const unread = [...seeds.keys()].filter((key) => !isRead(key) && !isDerived(key)).sort();
const unseededReads = [...explicit.keys()].filter((key) => !seeds.has(key)).sort();

let fallbacksChecked = 0;
let fallbacksSkipped = 0;
const fallbackMismatches = [];
for (const fallback of fallbacks) {
  const seeded = seedLiterals.get(fallback.key);
  if (!seeded) continue; // an unseeded read is the connectivity check's finding
  if (fallback.skipped) {
    fallbacksSkipped++;
    continue;
  }
  fallbacksChecked++;
  if (!seeded.has(fallback.text)) fallbackMismatches.push(fallback);
}

const updateBaseline = process.argv.includes('--update-baseline');
const baseline = await readBaseline();

if (updateBaseline) {
  await writeBaseline(
    unread,
    unseededReads,
    fallbackMismatches.map(mismatchId),
    baseline,
  );
  console.log(
    `data-points: baseline updated — ${unread.length} unread seed(s), ` +
      `${unseededReads.length} unseeded read(s), ${fallbackMismatches.length} fallback ` +
      `mismatch(es). Replace any TODO reasons by hand.`,
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
for (const fallback of fallbackMismatches) {
  const id = mismatchId(fallback);
  if (id in baseline.acceptedMismatches) continue;
  // Newest write last, so show the end of the list: a superseded wording is
  // usually the oldest.
  const literals = [...seedLiterals.get(fallback.key)];
  const shown = literals.slice(-4).map((s) => JSON.stringify(s));
  if (literals.length > 4) shown[0] = `…${shown[0]}`;
  failures.push(
    `fallback disagrees with its seed: ${id}\n` +
      `    fallback: ${JSON.stringify(fallback.text)}\n` +
      `    seed row literal(s): ${shown.join(', ')}\n` +
      `    align one with the other (the shipped copy has been the reference — see\n` +
      `    20261017040000) or add "${id}" to ${BASELINE_PATH} acceptedMismatches`,
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
const currentMismatchIds = fallbackMismatches.map(mismatchId);
for (const id of Object.keys(baseline.acceptedMismatches)) {
  if (!currentMismatchIds.includes(id)) {
    failures.push(
      `baseline entry no longer needed: ${id}\n` +
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
    `${explicit.size} wired key(s), ${unseededReads.length} accepted unseeded read(s), ` +
    `${fallbacksChecked} fallback(s) equal` +
    (fallbacksSkipped > 0 ? ` (${fallbacksSkipped} expression child(ren) skipped)` : ''),
);
