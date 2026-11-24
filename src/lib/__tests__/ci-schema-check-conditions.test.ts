// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { run } from '../../../scripts/bun-exec.mjs';
import { main as checkMigrations } from '../../../scripts/check-migrations.mjs';
import { main as checkSchemaHygiene } from '../../../scripts/check-schema-hygiene.mjs';

/**
 * The schema gate's trust boundary, pinned as behaviour.
 *
 * `schema-check-trusted.yml` is split by what each half can answer:
 *
 *   - `schema-pr` (name "Schema checks (PR, trusted)") runs on
 *     `pull_request_target` and is **tokenless**. It executes the base branch's
 *     scripts, checks out only the merge ref's migration directory as data, and
 *     validates immutability and SQL. No secret, no network, no database, so it
 *     cannot go red because the hosted project is behind.
 *   - `schema` (name "Migration History") is the **hosted** half. It runs only
 *     when the `Supabase` workflow completed successfully on `main`, at the
 *     commit that run migrated. Only this half holds the read-only token.
 *
 * Four rules are load-bearing:
 *
 *   1. the hosted half never runs on `push` or on a PR — it is gated on
 *      `workflow_run` plus `conclusion == 'success'`, so it cannot race the
 *      migration workflow;
 *   2. the tokenless half runs on every PR, receives no Supabase credential,
 *      executes no PR script, and reads only `trusted/pr-migrations`;
 *   3. the hosted half checks out the migrated commit, not the current default
 *      branch tip;
 *   4. schema hygiene still runs after a migration-history failure.
 *
 * `ci.yml` keeps the token-free checks that inspect PR source in a separate
 * `Schema checks (PR)` job. That job is deliberately not named "Migration
 * History", so its green result cannot stand in for the hosted check.
 */

const CI_WORKFLOW = `${process.cwd()}/.github/workflows/ci.yml`;
const TRUSTED_WORKFLOW = `${process.cwd()}/.github/workflows/schema-check-trusted.yml`;

/** The checks that need `SUPABASE_ACCESS_TOKEN` (and a network call). */
const HOSTED_CHECKS = ['scripts/check-migrations.mjs', 'scripts/check-schema-hygiene.mjs'];

/** Migration checks that run the trusted script against the copied merge set. */
const TRUSTED_MIGRATION_CHECKS = [
  'scripts/check-migration-immutability.mjs',
  'scripts/check-migration-sql.mjs',
  'scripts/check-migration-schema-invariants.mjs',
];

/** Token-free checks that need the PR tree. They stay in `ci.yml`. */
const TOKEN_FREE_PR_CHECKS = [
  'scripts/check-migration-immutability.mjs',
  'scripts/check-migration-sql.mjs',
  'scripts/check-migration-schema-invariants.mjs',
  'scripts/check-migration-types.mjs',
  'scripts/check-supabase-cli-pin.mjs',
];

const PR_JOB_NAME = 'Schema checks (PR, trusted)';
const HOSTED_JOB_NAME = 'Migration History';

/** Run after a failed check, but never against a failed migration copy. */
const RUN_AFTER_COPY = "always() && steps.copy_migrations.outcome == 'success'";

/** Run even when the preceding hosted migration-history check failed. */
const RUN_ALWAYS = 'always()';

/** Where the PR migration data is copied inside the trusted checkout. */
const COPIED_MIGRATIONS = 'trusted/pr-migrations';

/** The PR checkout's migration source. */
const PR_MIGRATIONS = 'pr/supabase/migrations';

/** A path or command that names the untrusted PR checkout. */
const PR_PATH = /(^|[/\s"'=(])(\.\/)?pr\//;

/** A working directory that resolves into the untrusted PR checkout. */
const PR_DIR = /(^|[/\\])pr([/\\]|$)/;

type Trigger = {
  branches?: string[];
  types?: string[];
  workflows?: string[];
};

type Step = {
  name?: string;
  id?: string;
  uses?: string;
  with?: Record<string, unknown>;
  if?: unknown;
  run?: string;
  env?: Record<string, unknown>;
  'working-directory'?: string;
  'continue-on-error'?: unknown;
};

type Job = {
  name?: string;
  if?: unknown;
  'continue-on-error'?: unknown;
  steps?: Step[];
  defaults?: { run?: { 'working-directory'?: string } };
};

type Workflow = {
  on?: Record<string, Trigger>;
  permissions?: Record<string, unknown>;
  jobs: Record<string, Job>;
};

const ciWorkflow = Bun.YAML.parse(await Bun.file(CI_WORKFLOW).text()) as Workflow;
const trustedWorkflow = Bun.YAML.parse(await Bun.file(TRUSTED_WORKFLOW).text()) as Workflow;
const prJob = trustedWorkflow.jobs['schema-pr'];
if (!prJob) throw new Error('schema-check-trusted.yml must have a "schema-pr" job');
const hostedJob = trustedWorkflow.jobs.schema;
if (!hostedJob) throw new Error('schema-check-trusted.yml must have a "schema" job');
const ciJob = ciWorkflow.jobs['schema-pr-checks'];
if (!ciJob) throw new Error('ci.yml must have a "schema-pr-checks" job');

const prSteps = prJob.steps ?? [];
const hostedSteps = hostedJob.steps ?? [];
const ciSteps = ciJob.steps ?? [];

function label(step: Step): string {
  return step.name ?? step.run ?? 'unnamed step';
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function checkStep(candidates: Step[], script: string): Step {
  const command = new RegExp(`\\bbun\\s+(?:--bun\\s+)?${escapeRegExp(script)}\\b`);
  const matches = candidates.filter((step) => command.test(step.run ?? ''));
  const [match, ...extra] = matches;
  if (!match || extra.length > 0) {
    throw new Error(
      `${script} must be the only command in exactly one schema step (found ${matches.length})`
    );
  }
  return match;
}

function blocking(step: Step): boolean {
  return (step['continue-on-error'] ?? false) === false;
}

/** The one `actions/checkout` writing into `path`. */
function checkoutAt(candidates: Step[], path: string): Step {
  const matches = candidates.filter(
    (step) => (step.uses ?? '').startsWith('actions/checkout@') && step.with?.path === path
  );
  const [match, ...extra] = matches;
  if (!match || extra.length > 0) {
    throw new Error(`expected exactly one checkout at "${path}" (found ${matches.length})`);
  }
  return match;
}

/** A step's own working directory, falling back to the job default. */
function workingDirectory(step: Step, job: Job): string | undefined {
  return step['working-directory'] ?? job.defaults?.run?.['working-directory'];
}

/** The one step that copies PR migrations into the trusted checkout. */
function migrationCopy(): Step {
  const matches = prSteps.filter(
    (step) =>
      (step.run ?? '').includes(PR_MIGRATIONS) && (step.run ?? '').includes(COPIED_MIGRATIONS)
  );
  const [match, ...extra] = matches;
  if (!match || extra.length > 0) {
    throw new Error(`expected exactly one PR-migration copy step (found ${matches.length})`);
  }
  return match;
}

/** The job-level condition that selects an event. */
function eventGate(job: Job): string {
  return String(job.if ?? '');
}

describe('trusted schema workflow', () => {
  it('splits into a tokenless PR check and a post-migration hosted check', () => {
    const events = Object.keys(trustedWorkflow.on ?? {}).sort();
    expect(events).toEqual(['pull_request_target', 'workflow_run']);
    expect(trustedWorkflow.on?.push, 'a push would race the migration workflow').toBeUndefined();
    expect(trustedWorkflow.on?.pull_request).toBeUndefined();

    expect(trustedWorkflow.on?.pull_request_target?.branches).toEqual(['main']);
    expect(trustedWorkflow.on?.workflow_run?.workflows).toEqual(['Supabase']);
    expect(trustedWorkflow.on?.workflow_run?.types).toEqual(['completed']);
    expect(trustedWorkflow.on?.workflow_run?.branches).toEqual(['main']);

    expect(prJob.name).toBe(PR_JOB_NAME);
    expect(hostedJob.name).toBe(HOSTED_JOB_NAME);
    expect(trustedWorkflow.permissions).toEqual({ contents: 'read' });
  });

  it('runs the hosted check only after a successful migration run on main', () => {
    const gate = eventGate(hostedJob);
    expect(gate).toContain("github.event_name == 'workflow_run'");
    expect(gate).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(gate, 'the hosted half must not run on a PR').not.toContain('pull_request_target');

    expect(eventGate(prJob)).toContain("github.event_name == 'pull_request_target'");

    const checkout = hostedSteps.find((step) => (step.uses ?? '').startsWith('actions/checkout@'));
    expect(checkout, 'the hosted job must check out a commit').toBeDefined();
    expect(
      String(checkout?.with?.ref ?? ''),
      'the hosted job must check out the migrated commit'
    ).toContain('github.event.workflow_run.head_sha');
    expect(checkout?.with?.path, 'the hosted job must not check out PR data').toBeUndefined();

    for (const script of TRUSTED_MIGRATION_CHECKS) {
      expect(
        hostedSteps.some((step) => (step.run ?? '').includes(script)),
        `${script} belongs to the tokenless PR half`
      ).toBe(false);
    }
    expect(hostedSteps.filter((step) => PR_PATH.test(step.run ?? ''))).toEqual([]);
  });

  it('keeps the tokenless PR half free of credentials and hosted checks', () => {
    for (const step of prSteps) {
      expect(
        step.env?.SUPABASE_ACCESS_TOKEN,
        `${label(step)} must not receive a Supabase token`
      ).toBeUndefined();
      expect(
        JSON.stringify(step.env ?? {}),
        `${label(step)} must not reference repository secrets`
      ).not.toContain('secrets.');
    }

    for (const script of HOSTED_CHECKS) {
      expect(
        prSteps.some((step) => (step.run ?? '').includes(script)),
        `${script} must not run at PR time`
      ).toBe(false);
    }

    for (const script of TRUSTED_MIGRATION_CHECKS) {
      const step = checkStep(prSteps, script);
      expect(step.env?.SUPABASE_ACCESS_TOKEN, `${script} must be token-free`).toBeUndefined();
      expect(blocking(step), `${script} must fail the job`).toBe(true);
      expect(step.if, `${script} must run after a failed sibling`).toBe(RUN_AFTER_COPY);
    }
  });

  it('checks out only the merge migration directory, as data', () => {
    const prCheckout = checkoutAt(prSteps, 'pr');
    const prRef = String(prCheckout.with?.ref ?? '');
    expect(prRef).toContain('refs/pull/');
    expect(prRef).toContain('/merge');
    expect(prCheckout.with?.['sparse-checkout']).toBe('supabase/migrations');
    expect(prCheckout.with?.['persist-credentials']).toBe(false);
    expect(prCheckout.with?.['allow-unsafe-pr-checkout']).toBe(true);

    const trusted = checkoutAt(prSteps, 'trusted');
    const trustedRef = String(trusted.with?.ref ?? '');
    expect(trustedRef).toContain('github.event.pull_request.base.sha');
    expect(trusted.with?.['persist-credentials']).toBe(false);
  });

  it('does not execute any PR script in the privileged workflow', () => {
    for (const step of prSteps.filter((candidate) => candidate.run !== undefined)) {
      expect(
        workingDirectory(step, prJob) ?? '',
        `${label(step)} must not run from the PR`
      ).not.toMatch(PR_DIR);
    }

    const copy = migrationCopy();
    expect(prSteps.filter((step) => PR_PATH.test(step.run ?? ''))).toEqual([copy]);

    for (const script of [
      'scripts/check-migration-types.mjs',
      'scripts/check-supabase-cli-pin.mjs',
    ]) {
      expect(
        prSteps.some((step) => (step.run ?? '').includes(script)),
        `${script} must stay out of the privileged workflow`
      ).toBe(false);
    }
  });

  it('copies only the migration directory before the tokenless checks', () => {
    const copy = migrationCopy();
    expect(copy.id).toBe('copy_migrations');
    expect(copy.if, 'the copy must run on every PR event').toBeUndefined();
    expect(blocking(copy), 'the copy must fail the job').toBe(true);
    expect(copy.env?.SUPABASE_ACCESS_TOKEN).toBeUndefined();
    expect(copy.run).toContain('DEST="$GITHUB_WORKSPACE/trusted/pr-migrations"');
    expect(copy.run, 'the copy must reject a symlinked source').toContain('-L "$SOURCE"');
    expect(copy.run, 'the copy must reject a symlinked destination').toContain('-L "$DEST"');
    expect(copy.run, 'the copy must reject symlinks and special files').toContain(
      '-mindepth 1 ! -type f'
    );
    expect(copy.run, 'the copy must not execute a PR script').not.toMatch(
      /\b(?:bun|node|bash|sh|deno|python)\b/
    );
    expect(copy.run, 'the copy must not invoke the scripts tree').not.toContain('scripts/');

    const copyIndex = prSteps.indexOf(copy);
    for (const script of TRUSTED_MIGRATION_CHECKS) {
      expect(
        prSteps.indexOf(checkStep(prSteps, script)),
        `${script} must run after the migration copy`
      ).toBeGreaterThan(copyIndex);
    }
  });

  it('copies the PR migrations without changing the base checkout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-copy-'));
    const source = join(root, 'pr', 'supabase', 'migrations');
    const base = join(root, 'trusted', 'supabase', 'migrations');
    const copied = join(root, 'trusted', 'pr-migrations');

    try {
      await mkdir(source, { recursive: true });
      await mkdir(base, { recursive: true });
      await Bun.write(join(source, '20260101000000_new.sql'), 'select 1;\n');
      await Bun.write(join(base, '20250101000000_base.sql'), 'select 2;\n');

      const result = run(['bash', '-e', '-c', migrationCopy().run ?? ''], {
        env: { ...Bun.env, GITHUB_WORKSPACE: root },
      });

      expect(result.exitCode, result.stderr).toBe(0);
      expect(await Bun.file(join(copied, '20260101000000_new.sql')).text()).toBe('select 1;\n');
      expect(await Bun.file(join(copied, '20250101000000_base.sql')).exists()).toBe(false);
      expect(await Bun.file(join(base, '20250101000000_base.sql')).text()).toBe('select 2;\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('runs the hosted checks with the read-only token at the migrated commit', () => {
    for (const script of HOSTED_CHECKS) {
      const step = checkStep(hostedSteps, script);
      expect(blocking(step), `${script} must fail the job`).toBe(true);
      expect(step.run, `${script} must not execute from the PR`).not.toMatch(PR_PATH);
      expect(
        String(step.env?.MIGRATIONS_DIR ?? ''),
        `${script} must not read the PR checkout`
      ).not.toContain(`/${PR_MIGRATIONS}`);
      expect(String(step.env?.SUPABASE_ACCESS_TOKEN)).toContain(
        'secrets.SUPABASE_READ_ONLY_ACCESS_TOKEN'
      );
    }

    const history = checkStep(hostedSteps, 'scripts/check-migrations.mjs');
    expect(
      history.if,
      'migration history must be unconditional inside the hosted job'
    ).toBeUndefined();
    expect(String(history.env?.MIGRATIONS_DIR)).toContain('/supabase/migrations');
  });

  it('runs schema hygiene even when migration history fails', () => {
    const history = checkStep(hostedSteps, 'scripts/check-migrations.mjs');
    const hygiene = checkStep(hostedSteps, 'scripts/check-schema-hygiene.mjs');

    expect(hygiene.if, 'schema hygiene must not be skipped after a history failure').toBe(
      RUN_ALWAYS
    );
    expect(hostedSteps.indexOf(hygiene)).toBeGreaterThan(hostedSteps.indexOf(history));
    expect(blocking(history), 'migration history must fail the job').toBe(true);
    expect(blocking(hygiene), 'schema hygiene must fail the job').toBe(true);
  });
});

describe('ci.yml', () => {
  it('no longer owns a Migration History job or a hosted check', () => {
    expect(ciWorkflow.jobs['schema-check']).toBeUndefined();
    expect(Object.values(ciWorkflow.jobs).filter((job) => job.name === HOSTED_JOB_NAME)).toEqual(
      []
    );

    for (const job of Object.values(ciWorkflow.jobs)) {
      for (const step of job.steps ?? []) {
        for (const script of HOSTED_CHECKS) {
          expect(step.run ?? '', `${script} must not run in ci.yml`).not.toContain(script);
        }
      }
    }
  });

  it('keeps the token-free checks in a separate, clearly named job', () => {
    expect(ciJob.name).toBe('Schema checks (PR)');
    expect(ciJob.if).toBeUndefined();
    expect(ciJob['continue-on-error'], 'the PR schema checks must be blocking').toBeUndefined();

    for (const script of TOKEN_FREE_PR_CHECKS) {
      const step = checkStep(ciSteps, script);
      expect(workingDirectory(step, ciJob), `${script} must inspect the PR`).toBe('pr');
      expect(step.if, `${script} must not be gated`).toBeUndefined();
      expect(step.env?.SUPABASE_ACCESS_TOKEN, `${script} must be token-free`).toBeUndefined();
      expect(blocking(step), `${script} must fail the job`).toBe(true);
    }
  });

  it('compares the PR migrations against the trusted base, not against themselves', () => {
    for (const script of [
      'scripts/check-migration-immutability.mjs',
      'scripts/check-migration-sql.mjs',
    ]) {
      const step = checkStep(ciSteps, script);
      expect(String(step.env?.BASE_MIGRATIONS_DIR)).toContain('/trusted/supabase/migrations');
      expect(String(step.env?.BASE_MIGRATIONS_DIR)).not.toContain('/pr/supabase/migrations');
    }
  });

  it('leaves the trusted workflow as the only owner of the migration-history check', async () => {
    const glob = new Bun.Glob('*.yml');
    const owners: string[] = [];
    for await (const file of glob.scan({ cwd: '.github/workflows' })) {
      const source = await Bun.file(`.github/workflows/${file}`).text();
      if (source.includes('scripts/check-migrations.mjs')) owners.push(file);
    }
    owners.sort();
    expect(owners).toEqual(['schema-check-trusted.yml']);
  });
});

describe('missing credentials', () => {
  it('fails in the scripts themselves instead of returning a green skip', async () => {
    const lines: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '));
    });

    try {
      expect(await checkMigrations({ MIGRATIONS_DIR: 'supabase/migrations' })).toBe(1);
      expect(await checkSchemaHygiene({})).toBe(1);
    } finally {
      log.mockRestore();
    }

    expect(lines.join('\n')).toMatch(/configuration fault on our side/g);
  });
});
