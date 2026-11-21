#!/usr/bin/env bun
/**
 * Single-source guard for the Supabase CLI package pin.
 *
 * `scripts/supabase-cli.mjs` owns the `bun x --bun` command prefix, and the
 * Supabase workflow derives its release version from that same line. A second
 * package literal in another script would drift on its own update schedule and
 * silently run a different CLI from the one the shared module names.
 *
 * The scan covers executable and configuration files. Tests are excluded
 * because fixtures legitimately need arbitrary versions, and prose is excluded
 * because a command in a document is not a command the repository runs.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

/** The one file allowed to name the package version. */
export const CANONICAL_FILE = 'scripts/supabase-cli.mjs';

const PACKAGE = 'supabase';
// A concrete spec. The workflow's extraction pattern starts with `[`, which is
// deliberately not a valid first character here.
const PACKAGE_PIN = new RegExp(`\\b${PACKAGE}@[0-9A-Za-z*^~][0-9A-Za-z.+*^~_-]*`, 'g');

const SCANNED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.yml',
  '.yaml',
  '.sh',
  '.toml',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.vercel',
  'coverage',
  'playwright-report',
  'test-results',
  '.turbo',
  'dist',
  '.worktrees',
  'skills',
  '.agents',
  '.kiro',
  'scratch',
  'docs',
]);

const EXTRA_FILES = new Set(['bin/npx']);

function isTestFile(file) {
  return (
    file.split('/').includes('__tests__') ||
    /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
  );
}

/** Executable/configuration files eligible for the scan, relative to `root`. */
function collectFiles(root) {
  const files = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(absolute);
        continue;
      }
      if (!entry.isFile() || isTestFile(relative)) continue;
      if (EXTRA_FILES.has(relative) || SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(relative);
      }
    }
  };

  walk(root);
  return files.sort();
}

/**
 * Every concrete package pin on a source string.
 *
 * @param {string} source
 * @returns {{ line: number, spec: string }[]}
 */
export function findSupabaseCliPins(source) {
  const pins = [];
  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index++) {
    for (const match of lines[index].matchAll(PACKAGE_PIN)) {
      pins.push({ line: index + 1, spec: match[0] });
    }
  }

  return pins;
}

/**
 * @param {{ path: string, source: string }[]} files
 * @returns {{ outside: { path: string, line: number, spec: string }[], canonicalPins: number }}
 */
export function classifySupabaseCliPins(files) {
  const outside = [];
  let canonicalPins = 0;

  for (const file of files) {
    for (const pin of findSupabaseCliPins(file.source)) {
      if (file.path === CANONICAL_FILE) {
        canonicalPins += 1;
      } else {
        outside.push({ path: file.path, ...pin });
      }
    }
  }

  return { outside, canonicalPins };
}

/**
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {(message: string) => void} [options.log]
 * @param {(message: string) => void} [options.error]
 * @returns {Promise<number>} Process exit code.
 */
export async function main({
  root = PROJECT_ROOT,
  log = console.log,
  error = console.error,
} = {}) {
  try {
    const files = collectFiles(root).map((file) => ({
      path: file,
      source: readFileSync(path.join(root, file), 'utf8'),
    }));
    const { outside, canonicalPins } = classifySupabaseCliPins(files);
    let failed = false;

    if (canonicalPins === 0) {
      error(`✖  ${CANONICAL_FILE} has no Supabase CLI package pin; refusing a vacuous pass.`);
      failed = true;
    } else if (canonicalPins > 1) {
      error(`✖  ${CANONICAL_FILE} has ${canonicalPins} Supabase CLI package pins; keep one.`);
      failed = true;
    }

    if (outside.length > 0) {
      error('');
      error(`✖  Supabase CLI package pin found outside ${CANONICAL_FILE}:`);
      for (const finding of outside) {
        error(`    ${finding.path}:${finding.line}  ${finding.spec}`);
      }
      error('');
      error(`   Import SUPABASE_CLI from ${CANONICAL_FILE} instead of writing the pin again.`);
      failed = true;
    }

    if (failed) return 1;

    log(`✔  Supabase CLI package pin appears only in ${CANONICAL_FILE}.`);
    return 0;
  } catch (cause) {
    error(`✖  Supabase CLI pin guard could not run: ${cause.message}`);
    error('   This is a check failure, not a clean result.');
    return 1;
  }
}

if (process.argv[1]?.endsWith('check-supabase-cli-pin.mjs')) {
  process.exit(await main());
}
