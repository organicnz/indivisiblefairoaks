// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { main as checkMigrations } from '../../../scripts/check-migrations.mjs';
import { main as checkSchemaHygiene } from '../../../scripts/check-schema-hygiene.mjs';

/**
 * The schema gate's trust boundary, pinned as behaviour.
 *
 * `schema-check-trusted.yml` owns the required `Migration History` check. It
 * runs on `pull_request_target` and `push`, executes base-branch scripts, and
 * checks out only the merge ref's migration directory as data. It has no
 * fork-only condition and no tokenless skip: a fork PR either runs the hosted
 * checks or fails.
 *
 * `ci.yml` keeps the token-free checks that inspect PR source in a separate
 * `Schema checks (PR)` job. That job is deliberately not named "Migration
 * History", so its green result cannot stand in for the hosted check.
 *
 * Three rules are load-bearing:
 *
 *   1. every event that produces the required check — a fork PR, a same-repo
 *      PR, and a push to main — runs the hosted checks;
 *   2. the trusted workflow executes no PR script and reads only
 *      `trusted/pr-migrations`, never `pr/`;
 *   3. the token-free checks in `ci.yml` receive no credential and are not
 *      presented as the hosted check.
 */

const CI_WORKFLOW = `${process.cwd()}/.github/workflows/ci.yml`;
const TRUSTED_WORKFLOW = `${process.cwd()}/.github/workflows/schema-check-trusted.yml`;

/** The checks that need `SUPABASE_ACCESS_TOKEN` (and a network call). */
const HOSTED_CHECKS = ['scripts/check-migrations.mjs', 'scripts/check-schema-hygiene.mjs'];

/** Migration checks that run the trusted script against the copied merge set. */
const TRUSTED_MIGRATION_CHECKS = [
  'scripts/check-migration-immutability.mjs',
  'scripts/check-migration-sql.mjs',
];

/** Token-free checks that need the PR tree. They stay in `ci.yml`. */
const TOKEN_FREE_PR_CHECKS = [
  'scripts/check-migration-immutability.mjs',
  'scripts/check-migration-sql.mjs',
  'scripts/check-migration-types.mjs',
  'scripts/check-supabase-cli-pin.mjs',
];

const TRUSTED_CHECKS = [...HOSTED_CHECKS, ...TRUSTED_MIGRATION_CHECKS];

/** Where the PR migration data is copied inside the trusted checkout. */
const COPIED_MIGRATIONS = 'trusted/pr-migrations';

/** The PR checkout's migration source. */
const PR_MIGRATIONS = 'pr/supabase/migrations';

/** A path or command that names the untrusted PR checkout. */
const PR_PATH = /(^|[/\s"'=(])(\.\/)?pr\//;

type Trigger = {
  branches?: string[];
  types?: string[];
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
const trustedJob = trustedWorkflow.jobs.schema;
if (!trustedJob) throw new Error('schema-check-trusted.yml must have a "schema" job');
const ciJob = ciWorkflow.jobs['schema-pr-checks'];
if (!ciJob) throw new Error('ci.yml must have a "schema-pr-checks" job');

const trustedSteps = trustedJob.steps ?? [];
const ciSteps = ciJob.steps ?? [];

function label(step: Step): string {
  return step.name ?? step.run ?? 'unnamed step';
}

function checkStep(candidates: Step[], script: string): Step {
  const matches = candidates.filter((step) => step.run?.includes(script));
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
  const matches = trustedSteps.filter(
    (step) =>
      (step.run ?? '').includes(PR_MIGRATIONS) && (step.run ?? '').includes(COPIED_MIGRATIONS)
  );
  const [match, ...extra] = matches;
  if (!match || extra.length > 0) {
    throw new Error(`expected exactly one PR-migration copy step (found ${matches.length})`);
  }
  return match;
}

describe('trusted schema workflow', () => {
  it('is the required Migration History check for every PR and main push', () => {
    const events = Object.keys(trustedWorkflow.on ?? {}).sort();
    expect(events).toEqual(['pull_request_target', 'push']);
    expect(trustedWorkflow.on?.push?.branches).toEqual(['main']);
    expect(trustedWorkflow.on?.pull_request_target?.branches).toEqual(['main']);
    expect(trustedWorkflow.on?.pull_request).toBeUndefined();

    expect(trustedJob.name).toBe('Migration History');
    expect(trustedWorkflow.permissions).toEqual({ contents: 'read' });
  });

  it('has no level at which an unverified run can skip and stay green', () => {
    // A job-level skip would remove the required check entirely; a step-level
    // skip on the hosted pair would recreate the old fork-PR hole. Both are
    // forbidden. A missing token still fails inside the scripts (below).
    expect(trustedJob.if, 'the required job must not be conditionally skipped').toBeUndefined();
    for (const step of trustedSteps) {
      expect(step.if, `${label(step)} must be unconditional`).toBeUndefined();
    }
    expect(
      trustedSteps.filter((step) => (step.run ?? '').includes('::notice')),
      'there must be no skip notice standing in for a check'
    ).toEqual([]);
  });

  it('checks out only the merge migration directory, as data', () => {
    const prCheckout = checkoutAt(trustedSteps, 'pr');
    const prRef = String(prCheckout.with?.ref ?? '');
    expect(prRef).toContain('refs/pull/');
    expect(prRef).toContain('/merge');
    expect(prRef).toContain('github.sha');
    expect(prCheckout.with?.['sparse-checkout']).toBe('supabase/migrations');
    expect(prCheckout.with?.['persist-credentials']).toBe(false);
    expect(prCheckout.with?.['allow-unsafe-pr-checkout']).toBe(true);

    const trusted = checkoutAt(trustedSteps, 'trusted');
    const trustedRef = String(trusted.with?.ref ?? '');
    expect(trustedRef).toContain('github.event.pull_request.base.sha');
    expect(trustedRef).toContain('github.sha');
    expect(trusted.with?.['persist-credentials']).toBe(false);
  });

  it('finds every trusted check exactly once and keeps it blocking', () => {
    for (const script of TRUSTED_CHECKS) {
      const step = checkStep(trustedSteps, script);
      expect(blocking(step), `${script} must fail the job`).toBe(true);
    }
  });

  it('does not execute any PR script in the privileged workflow', () => {
    const runSteps = trustedSteps.filter((step) => step.run !== undefined);
    for (const step of runSteps) {
      expect(
        workingDirectory(step, trustedJob),
        `${label(step)} must not run from the PR`
      ).not.toBe('pr');
    }

    const copy = migrationCopy();
    expect(trustedSteps.filter((step) => PR_PATH.test(step.run ?? ''))).toEqual([copy]);

    for (const script of [
      'scripts/check-migration-types.mjs',
      'scripts/check-supabase-cli-pin.mjs',
    ]) {
      expect(
        trustedSteps.some((step) => (step.run ?? '').includes(script)),
        `${script} must stay out of the privileged workflow`
      ).toBe(false);
    }
  });

  it('copies only the migration directory before every trusted check', () => {
    const copy = migrationCopy();
    expect(copy.if, 'the copy must run on every event').toBeUndefined();
    expect(blocking(copy), 'the copy must fail the job').toBe(true);
    expect(copy.env?.SUPABASE_ACCESS_TOKEN).toBeUndefined();
    expect(copy.run).toContain('rm -rf');
    expect(copy.run).toContain('cp -R');
    expect(copy.run, 'the copy must reject a symlinked source').toContain('-L "$SOURCE"');
    expect(copy.run, 'the copy must reject a symlinked destination').toContain('-L "$DEST"');
    expect(copy.run, 'the copy must reject symlinks and special files').toContain(
      '-mindepth 1 ! -type f'
    );
    expect(copy.run, 'the copy must not overwrite the base migrations').not.toContain(
      'trusted/supabase/migrations'
    );
    expect(copy.run, 'the copy must not execute a PR script').not.toMatch(
      /\b(?:bun|node|bash|sh|deno|python)\b/
    );
    expect(copy.run, 'the copy must not invoke the scripts tree').not.toContain('scripts/');

    const copyIndex = trustedSteps.indexOf(copy);
    for (const script of TRUSTED_CHECKS) {
      expect(
        trustedSteps.indexOf(checkStep(trustedSteps, script)),
        `${script} must run after the migration copy`
      ).toBeGreaterThan(copyIndex);
    }
  });

  it('runs the hosted checks from trusted against the copied merge set', () => {
    for (const script of HOSTED_CHECKS) {
      const step = checkStep(trustedSteps, script);
      expect(workingDirectory(step, trustedJob), `${script} must run from trusted`).toBe('trusted');
      expect(step.if, `${script} must not be gated`).toBeUndefined();
      expect(step.run, `${script} must not execute from the PR`).not.toMatch(PR_PATH);
      expect(
        String(step.env?.MIGRATIONS_DIR ?? ''),
        `${script} must not read the PR checkout`
      ).not.toContain(`/${PR_MIGRATIONS}`);
      expect(String(step.env?.SUPABASE_ACCESS_TOKEN)).toContain(
        'secrets.SUPABASE_READ_ONLY_ACCESS_TOKEN'
      );
    }

    const history = checkStep(trustedSteps, 'scripts/check-migrations.mjs');
    expect(String(history.env?.MIGRATIONS_DIR)).toContain(`/${COPIED_MIGRATIONS}`);
  });

  it('runs the migration immutability and SQL checks from trusted base code', () => {
    for (const script of TRUSTED_MIGRATION_CHECKS) {
      const step = checkStep(trustedSteps, script);
      expect(workingDirectory(step, trustedJob), `${script} must run from trusted`).toBe('trusted');
      expect(step.if, `${script} must not be gated`).toBeUndefined();
      expect(step.run, `${script} must not execute from the PR`).not.toMatch(PR_PATH);
      expect(step.env?.SUPABASE_ACCESS_TOKEN, `${script} must be token-free`).toBeUndefined();
      expect(String(step.env?.MIGRATIONS_DIR)).toContain(`/${COPIED_MIGRATIONS}`);
      expect(String(step.env?.MIGRATIONS_DIR)).not.toContain(`/${PR_MIGRATIONS}`);
      expect(String(step.env?.BASE_MIGRATIONS_DIR)).toContain('/trusted/supabase/migrations');
    }
  });
});

describe('ci.yml', () => {
  it('no longer owns a Migration History job or a hosted check', () => {
    expect(ciWorkflow.jobs['schema-check']).toBeUndefined();
    expect(
      Object.values(ciWorkflow.jobs).filter((job) => job.name === 'Migration History')
    ).toEqual([]);

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
