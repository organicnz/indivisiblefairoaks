// @vitest-environment node
import { describe, expect, it } from 'vitest';

/**
 * The JWT posture of every edge function is declared twice: once in
 * `supabase/config.toml` (the default a deploy picks up) and once as a flag in
 * `.github/workflows/supabase.yml` (which wins when present). This file is the
 * thing that keeps them saying the same thing.
 *
 * Why it matters, concretely: `notify-contact` is invoked by a Postgres trigger
 * through pg_net, which sends no JWT. A deploy that ends up with verification
 * *on* makes every contact notification fail with a 401 that nothing surfaces —
 * no admin email, no sender copy. The reverse direction is worse for the keyed
 * functions: a lost flag makes an internal endpoint anonymously reachable.
 *
 * The values are parsed rather than restated. A test that hard-codes the answer
 * would pass after someone changed both files to the wrong pair, which is the
 * only way this can actually break.
 */

const ROOT = process.cwd();

const CONFIG = await Bun.file(`${ROOT}/supabase/config.toml`).text();
const WORKFLOW = await Bun.file(`${ROOT}/.github/workflows/supabase.yml`).text();

/** `[functions.<slug>]` blocks, with the nearest `verify_jwt` in each. */
function declaredInConfig(): Map<string, boolean> {
  const declared = new Map<string, boolean>();
  for (const block of CONFIG.split(/\n(?=\[functions\.)/)) {
    const header = block.match(/^\[functions\.([a-z0-9-]+)\]/);
    if (!header) continue;
    const value = block.match(/verify_jwt\s*=\s*(true|false)/);
    // The CLI's default is verification on, so an omitted key means `true`.
    declared.set(header[1], value ? value[1] === 'true' : true);
  }
  return declared;
}

/**
 * One entry per `supabase functions deploy <slug>`, read with its continuation
 * lines so a flag on the next line counts. The command is emitted one function
 * per line in this workflow, which is what makes the parse honest rather than
 * pattern-matching a shape that may not hold.
 */
function deployedInWorkflow(): Map<string, boolean> {
  const deployed = new Map<string, boolean>();
  const lines = WORKFLOW.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/functions deploy\s+([a-z0-9-]+)/);
    if (!match) continue;

    let invocation = lines[i];
    let j = i + 1;
    while (invocation.trimEnd().endsWith('\\') && j < lines.length) {
      invocation += ` ${lines[j]}`;
      j++;
    }
    deployed.set(match[1], !invocation.includes('--no-verify-jwt'));
  }
  return deployed;
}

const DECLARED = declaredInConfig();
const DEPLOYED = deployedInWorkflow();

/**
 * The four that must stay anonymous. Restated here on purpose: it is the
 * assertion that fails if someone "fixes" a 401 by flipping config instead of
 * looking at why the caller sends no credential.
 */
const PUBLIC = ['data-points', 'health', 'notify-contact', 'search'];

describe('edge function JWT posture', () => {
  it('parses both sources rather than silently finding nothing', () => {
    expect(DECLARED.size).toBeGreaterThan(0);
    expect(DEPLOYED.size).toBeGreaterThan(0);
  });

  it('declares exactly the functions the workflow deploys', () => {
    expect([...DECLARED.keys()].sort()).toEqual([...DEPLOYED.keys()].sort());
  });

  it('agrees on verify_jwt for every function', () => {
    const mismatches = [...DEPLOYED.entries()]
      .filter(([slug, verifyJwt]) => DECLARED.get(slug) !== verifyJwt)
      .map(([slug, verifyJwt]) => `${slug}: workflow=${verifyJwt} config=${DECLARED.get(slug)}`);

    expect(mismatches).toEqual([]);
  });

  it('keeps the deliberately public functions anonymous in both places', () => {
    for (const slug of PUBLIC) {
      expect(DECLARED.get(slug), `${slug} in config.toml`).toBe(false);
      expect(DEPLOYED.get(slug), `${slug} in supabase.yml`).toBe(false);
    }
  });

  it('keeps the credentialed functions verified in both places', () => {
    const keyed = [...DECLARED.entries()]
      .filter(([slug]) => !PUBLIC.includes(slug))
      .map(([slug]) => slug);

    expect(keyed.length).toBeGreaterThan(0);
    for (const slug of keyed) {
      expect(DECLARED.get(slug), `${slug} in config.toml`).toBe(true);
      expect(DEPLOYED.get(slug), `${slug} in supabase.yml`).toBe(true);
    }
  });
});
