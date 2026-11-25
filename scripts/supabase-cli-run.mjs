#!/usr/bin/env bun
/**
 * Run the pinned Supabase CLI with argv passthrough.
 *
 * A workflow that needs the CLI cannot write the package literal a second
 * time: `check-supabase-cli-pin.mjs` allows it only in `supabase-cli.mjs`.
 * It also cannot hold the version in a shell variable — the unpinned-package-
 * runner guard rejects `bun x "pkg@${VERSION}"` because the token stream has no
 * exact version at edit time, which is the property that makes a run
 * reproducible. This entry point spreads the canonical tuple instead, so both
 * rules hold and an upgrade stays one edit.
 *
 * Usage:
 *   bun scripts/supabase-cli-run.mjs functions deploy ice-scan --project-ref …
 *
 * The child inherits stdout/stderr so the CLI's progress output streams
 * instead of being buffered, and its exit status is returned unchanged.
 */
import { runInherit } from './bun-exec.mjs';
import { SUPABASE_CLI } from './supabase-cli.mjs';

process.exit(runInherit([...SUPABASE_CLI, ...Bun.argv.slice(2)]));
