#!/usr/bin/env bun
/**
 * Applied migrations are immutable. Token-free, network-free.
 *
 *   bun scripts/check-migration-immutability.mjs
 *
 * ## The gap this closes
 *
 * `check-migrations.mjs` compares *versions*. `supabase_migrations.schema_migrations`
 * records a version and a name, not the bytes that were run, so a migration
 * whose file was edited after it landed still passes every version-based check.
 * That is the one history divergence a version comparison cannot see, and it is
 * the dangerous one: a fresh environment replays the edited file, so
 * development and production stop sharing a schema while the gate stays green.
 *
 * ## What it compares
 *
 * The working tree against the base branch. A file in `BASE_MIGRATIONS_DIR`
 * has already been merged, and this gate treats merged as applied — the
 * conservative reading, because a migration recorded in the hosted project but
 * not yet merged is not something a PR should be editing either.
 *
 * Every base file must still exist, keep its filename, and be byte-identical.
 * New files are the whole point and are allowed. The digest is SHA-256 over the
 * file's bytes, so a whitespace-only edit fails too — whitespace is not
 * schema, but "only formatting changed" is exactly the claim this check should
 * not have to make. A base and working tree that resolve to the same directory
 * would compare a tree with itself, so that configuration is refused; the
 * workflow step is pinned by its guard test, and this covers every caller,
 * including a local run.
 *
 * ## Why a base-branch diff rather than a hash stored with the migration
 *
 * `schema_migrations` does not store the file. Its `statements` column holds
 * the SQL as it was sent, split into statements, so a digest of it would
 * compare formatting rather than content and would report a false edit after
 * any re-serialisation. The base commit is a reference no PR can rewrite, and
 * it needs no credential, so this also runs on a fork PR.
 *
 * ## What it deliberately does NOT catch
 *
 *   - **A migration edited on the base branch itself.** A push to `main` is
 *     compared against `github.sha`, so base and working tree are the same
 *     commit and this is a no-op. The gate applies at review time, where an
 *     edit can still be refused; a direct push to a protected branch is a
 *     different control's problem.
 *   - **A migration applied but never merged.** Nothing in the repository
 *     records it, so there is no base file to compare.
 *   - **Duplicate versions, malformed filenames and empty migration files.**
 *     `check-migrations.mjs` owns those local invariants; this check only
 *     compares the files the base tree contains.
 *   - **SQL that is wrong.** Nothing here executes a statement.
 */

import { join, resolve } from 'node:path';

const notice = (m) => console.log(`::notice::${m}`);
const error = (m) => console.log(`::error::${m}`);

/**
 * Migration filenames in a directory, sorted; `null` when the directory is
 * absent. `Bun.Glob` rather than `readdir`, for the same reasons as
 * `check-migrations.mjs`: the pattern states the query and the walk does not
 * block the event loop.
 *
 * Sorted because `Bun.Glob` promises no order, and a report whose lines move
 * between runs cannot be diffed against the previous run.
 *
 * @param {string} dir
 * @returns {Promise<string[] | null>}
 */
export async function listMigrations(dir) {
  const glob = new Bun.Glob('*.sql');
  const files = [];
  try {
    for await (const file of glob.scan({ cwd: dir })) files.push(file);
  } catch {
    return null;
  }
  files.sort();
  return files;
}

/**
 * SHA-256 of a file's bytes, as lowercase hex.
 *
 * WebCrypto rather than `node:crypto`: it is a Web standard and Bun implements
 * it natively, which is the same choice the webhook signers made.
 *
 * @param {string} file
 * @returns {Promise<string>}
 */
export async function contentHash(file) {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(file).arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {Record<string, string | undefined>} [env]
 *   Defaults to `Bun.env`, and taken as a parameter so the decision table is
 *   testable without mutating the process environment.
 * @returns {Promise<number>} process exit code
 */
export async function main(env = Bun.env) {
  const currentDir = env.MIGRATIONS_DIR ?? 'supabase/migrations';
  const baseDir = env.BASE_MIGRATIONS_DIR ?? '';

  // No default path, on purpose. A relative fallback would resolve against
  // whatever directory the caller happened to be in, and "there is no base
  // here" must be a configuration error, not a quiet pass or a confusing
  // missing-directory message.
  if (!baseDir) {
    error('BASE_MIGRATIONS_DIR is not set — point it at the base branch checkout.');
    error('Refusing to pass without a reference to compare against.');
    return 1;
  }

  // A base and working tree that resolve to the same directory compare a tree
  // with itself and pass. The workflow step is pinned by its guard test, but
  // the script refuses the configuration for any caller, including a local run.
  if (resolve(baseDir) === resolve(currentDir)) {
    error('BASE_MIGRATIONS_DIR and MIGRATIONS_DIR resolve to the same directory.');
    error('Refusing to compare a tree against itself.');
    return 1;
  }

  // The base side must never be interpreted as "nothing was applied". A
  // missing checkout would turn every PR into a pass while measuring nothing,
  // which is the failure mode this repository has already paid for once.
  const base = await listMigrations(baseDir);
  if (!base) {
    error(`No base migrations directory at ${baseDir}.`);
    error('Refusing a vacuous pass: the comparison needs the base checkout.');
    return 1;
  }
  if (base.length === 0) {
    error(`No migrations in ${baseDir}.`);
    error('Refusing a vacuous pass: an empty base compared nothing.');
    return 1;
  }

  const current = await listMigrations(currentDir);
  if (!current) {
    error(`No migrations directory at ${currentDir}.`);
    return 1;
  }

  /** The `<version>` half of `<version>_<name>.sql`. */
  const versionOf = (file) => file.split('_')[0];
  const currentSet = new Set(current);
  const currentByVersion = new Map(current.map((file) => [versionOf(file), file]));

  const problems = [];
  for (const baseFile of base) {
    const version = versionOf(baseFile);

    // Check the exact applied file first. A new file can reuse its version and
    // sort after it, taking the version-map entry; that duplicate is the history
    // check's finding, not a rename of the applied file.
    if (!currentSet.has(baseFile)) {
      const sameVersion = currentByVersion.get(version);
      if (sameVersion) {
        // A rename keeps a schema change invisible to a version comparison
        // while making the recorded name disagree with the tree; both are edits.
        problems.push(
          `Applied migration renamed: ${baseFile} -> ${sameVersion} (version ${version}).`
        );
      } else {
        problems.push(`Applied migration deleted: ${baseFile} (version ${version} is recorded).`);
      }
      continue;
    }

    const [baseHash, currentHash] = await Promise.all([
      contentHash(join(baseDir, baseFile)),
      contentHash(join(currentDir, baseFile)),
    ]);
    if (baseHash !== currentHash) {
      problems.push(`Applied migration modified: ${baseFile} (content hash changed).`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) error(problem);
    error('Applied migrations are immutable: revert the edit and add a new migration instead.');
    return 1;
  }

  notice(`${base.length} applied migration(s) are unchanged.`);
  return 0;
}

// Auto-run only when invoked directly: importing this from a test must not
// execute the check. `main` and the two helpers are exported because the
// decision table is the part worth pinning.
const invokedDirectly = process.argv[1]?.endsWith('check-migration-immutability.mjs');
if (invokedDirectly) {
  process.exit(await main());
}
