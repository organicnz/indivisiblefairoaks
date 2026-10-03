#!/usr/bin/env node
/**
 * Documentation-claims gate.
 *
 * The docs in this repository make numeric claims about the repository itself:
 * how many pre-commit guards exist, where the suppression baseline sits, how
 * long `lefthook.yml` runs to, how many Playwright specs the delivery gate
 * executes. Those claims drift, and a stale claim in an authoritative document
 * is worse than no claim — it is the exact failure mode this repo already spent
 * a round fixing elsewhere ("a comment asserting something the code does not").
 *
 * The concrete case that motivated this file: `AGENTS.md` said "24 pre-commit
 * guards" in the Delivery Gates section and "twenty-five of the twenty-nine" in
 * Known Follow-ups, four hundred lines apart, while `lefthook.yml` held 29. Both
 * numbers cannot be right, and nothing was checking either.
 *
 * What it verifies, and why each pattern is safe to match on:
 *
 *   - `(\d+) pre-commit guards` — digits only. One occurrence used to be
 *     written as "twenty-nine" in prose and was rewritten to digits so it
 *     could be checked at all (see Limitation below).
 *   - `baseline (\d+)` / `baseline (currently N)` — the two phrasings in use.
 *     Both are anchored on the digit following the word, so `secrets:baseline`
 *     and `secrets-baseline.json` cannot be mistaken for a count.
 *   - "`lefthook.yml` is N lines" — a single occurrence in Known Follow-ups.
 *   - `— N specs` / `N e2e specs` / `N Playwright specs` — the em-dash separates
 *     the table form from the prose forms. A bare `N specs` does not match
 *     "112 e2e specs" because `specs` is not adjacent to the digits, so each
 *     phrasing present in the docs needs its own pattern.
 *   - the `crm.ts` and `content.ts` coverage floors — the four values are
 *     re-derived from `vitest.config.ts`. These are ratchets, so a doc ahead of
 *     the config invites someone to "fix" a red gate by editing prose.
 *
 * Comparison normalises on both sides (commas dropped, whitespace collapsed),
 * which is what lets a single path serve a bare count, a grouped figure like
 * `1,165`, and a multi-value floor like `58 / 54 / 61 / 65`.
 *
 * What it deliberately does NOT verify — the unit test count:
 *
 *   `vitest list` is the obvious cheap source of truth and it is WRONG. It
 *   enumerates 848 test declarations while `vitest run` executes 961, because
 *   dynamically generated cases do not appear in the listing. Wiring it in
 *   would produce a guard that fails on a correct document and passes on a
 *   wrong one. A ground truth that is wrong is worse than no ground truth, so
 *   the test count is left to the human, and the reason is written down here
 *   so nobody "fixes" the omission later.
 *
 * Limitation: a claim reworded into a form no pattern recognises stops being
 * checked. That is a warning on stdout, not an exit, because failing on prose
 * people will work around rather than read — a gate that is sometimes red is
 * not a gate. If you reword one of these claims, update the pattern list.
 *
 * Usage: bun scripts/check-doc-claims.mjs
 * Exit code 0 = every recognised claim matches, 1 = a claim is stale.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Documents that describe the repository to itself. */
const DOC_GLOBS = ['AGENTS.md', 'README.md', 'SKILLS.md', 'docs', '.agents/skills'];

// ── Sources of truth ────────────────────────────────────────────────────────

function readLines(rel) {
  return readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
}

/** Commands registered under `pre-commit:` in lefthook.yml. */
function precommitGuardCount() {
  let section = null;
  let count = 0;
  for (const line of readLines('lefthook.yml')) {
    if (/^[a-z][a-z-]*:$/.test(line)) {
      section = line.slice(0, -1);
      continue;
    }
    if (section !== 'pre-commit') continue;
    // Guards sit at 4 spaces under `commands:`; their own keys are at 6+.
    if (/^    [a-z0-9-]+:\s*$/.test(line)) count += 1;
  }
  return count;
}

function suppressionBaseline() {
  for (const line of readLines('lefthook.yml')) {
    const match = line.match(/^\s*BASELINE=(\d+)\s*$/);
    if (match) return Number(match[1]);
  }
  throw new Error('No BASELINE=<n> assignment found in lefthook.yml');
}

function lefthookLineCount() {
  const lines = readLines('lefthook.yml');
  // `split('\n')` yields a trailing empty element for a newline-terminated file,
  // so a naive count reads one higher than `wc -l`. Match `wc -l`: the figure in
  // the docs is meant to be checkable with a plain shell command.
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

/** Specs the delivery gate actually executes. `--list` matches runtime here. */
function e2eSpecCount() {
  const out = Bun.spawnSync(
    ['bunx', 'playwright', 'test', '--list'],
    { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' }
  ).stdout.toString();
  const match = out.match(/^Total:\s+(\d+)\s+tests/m);
  if (!match) throw new Error('Could not parse `playwright test --list` output');
  return Number(match[1]);
}

// ── Claims ──────────────────────────────────────────────────────────────────

/** Sources are computed at most once — two claims read the same Playwright count. */
const sourceCache = new Map();
function once(fn) {
  if (!sourceCache.has(fn)) sourceCache.set(fn, fn());
  return sourceCache.get(fn);
}

/**
 * Compare a claim against its source of truth.
 *
 * Normalised to a string on both sides so one path serves every claim: a bare
 * count ("29"), a grouped figure that the prose writes with thousands
 * separators ("1,165"), and a multi-value ratchet ("58 / 54 / 61 / 65") all
 * reduce to the same thing on both sides. Commas are dropped and internal
 * whitespace collapsed; everything else must match literally.
 */
function sameValue(actual, expected) {
  const norm = (value) =>
    String(value)
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return norm(actual) === norm(expected);
}

/** The per-file coverage floor declared for a module in vitest.config.ts. */
function coverageFloor(file) {
  const text = readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf8');
  const key = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(
    new RegExp(
      `'${key}':\\s*\\{\\s*statements:\\s*(\\d+),\\s*branches:\\s*(\\d+),\\s*functions:\\s*(\\d+),\\s*lines:\\s*(\\d+)`
    )
  );
  if (!match) throw new Error(`no coverage floor for ${file} in vitest.config.ts`);
  return `${match[1]} / ${match[2]} / ${match[3]} / ${match[4]}`;
}

const CLAIMS = [
  {
    label: 'pre-commit guards',
    pattern: /(\d+) pre-commit guards/g,
    source: () => precommitGuardCount(),
    fix: 'update the number, or add the guard you forgot to lefthook.yml',
  },
  {
    label: 'suppression baseline',
    // Two phrasings exist and both must be caught: the gates table writes
    // "pre-push, baseline 12" while the CMS skill writes "suppression baseline
    // (currently 10 across `src/`)". The second claim was stale for a while and
    // escaped a literal `baseline (\d+)` pattern precisely because of the
    // parentheses. Anchoring on the digit immediately after either form keeps
    // `secrets:baseline`, `secrets-baseline.json` and "baseline can only shrink"
    // out of range — none put a number there.
    pattern: /baseline (?:\(currently )?(\d+)/g,
    source: () => suppressionBaseline(),
    fix: 'raise BASELINE in lefthook.yml, or correct the doc',
  },
  {
    label: 'lefthook.yml line count',
    pattern: /`lefthook\.yml` is ([\d,]+) lines/g,
    source: () => lefthookLineCount(),
    fix: 'refresh the figure — this is the one claim that moves on its own',
  },
  {
    label: 'crm.ts coverage floor',
    pattern: /`src\/lib\/actions\/crm\.ts` on an explicit floor of \*\*([\d/ ]+)\*\*/g,
    source: () => coverageFloor('src/lib/actions/crm.ts'),
    fix: 'vitest.config.ts is the source of truth — copy the four values in order',
  },
  {
    label: 'content.ts coverage floor',
    pattern: /`src\/lib\/actions\/content\.ts` on \*\*([\d/ ]+)\*\*/g,
    source: () => coverageFloor('src/lib/actions/content.ts'),
    fix: 'vitest.config.ts is the source of truth — copy the four values in order',
  },
  {
    label: 'e2e spec count (table)',
    pattern: /— (\d+) specs/g,
    source: () => once(e2eSpecCount),
    fix: 'run `bunx playwright test --list` and use that number',
  },
  {
    label: 'e2e spec count (prose)',
    // Two spellings are in use: "N e2e specs" and "N Playwright specs". Only the
    // first was matched, and AGENTS.md used the second — so that count was
    // unguarded and drifted to 112 while the table claim, which IS matched, went
    // stale at 117 and was the only one that reported. A claim in a phrasing no
    // pattern recognises is worse than no claim, because the warning below reads
    // "no document currently states it" and is true only of the recognised
    // spellings. Both forms are anchored on the digits directly preceding
    // "specs", so neither can match a spec *name*.
    pattern: /(\d+) (?:e2e|Playwright) specs/g,
    source: () => once(e2eSpecCount),
    fix: 'run `bunx playwright test --list` and use that number',
  },
];

// ── Check ───────────────────────────────────────────────────────────────────

function docFiles() {
  const files = [];

  function walk(rel, depth = 0) {
    if (depth > 6) return;
    const abs = path.join(ROOT, rel);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(abs)) walk(path.join(rel, entry), depth + 1);
      return;
    }
    if (rel.endsWith('.md')) files.push(rel);
  }

  for (const target of DOC_GLOBS) walk(target);
  return files;
}

const files = docFiles();
const failures = [];
const warnings = [];
let verified = 0;

for (const claim of CLAIMS) {
  let expected;
  try {
    expected = claim.source();
  } catch (error) {
    failures.push(`  ✖ ${claim.label}: no source of truth (${error.message})`);
    continue;
  }

  let matches = 0;
  for (const file of files) {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Restart the global pattern per line so lastIndex cannot skip matches.
      const pattern = new RegExp(claim.pattern.source, 'g');
      let match;
      while ((match = pattern.exec(lines[i])) !== null) {
        matches += 1;
        const actual = match[1];
        if (!sameValue(actual, expected)) {
          failures.push(
            `  ✖ ${file}:${i + 1} — ${claim.label} claims ${match[1]}, ` +
              `reality is ${expected} (${claim.fix})`
          );
        } else {
          verified += 1;
        }
      }
    }
  }

  if (matches === 0) {
    warnings.push(
      `  ! ${claim.label}: no document currently states it — nothing is checking it`
    );
  }
}

if (warnings.length > 0) {
  console.log('\nDocumentation-claims gate — unverified claims:\n');
  for (const w of warnings) console.log(w);
  console.log('');
}

if (failures.length > 0) {
  console.log('\n✖ Stale numeric claims in the documentation:\n');
  for (const f of failures) console.log(f);
  console.log('');
  process.exit(1);
}

console.log(
  `✔ Documentation claims: ${verified} verified across ${files.length} files`
);
