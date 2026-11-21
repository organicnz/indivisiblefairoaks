// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { main as checkMigrations } from '../../../scripts/check-migrations.mjs';
import { main as checkSchemaHygiene } from '../../../scripts/check-schema-hygiene.mjs';

/**
 * The schema-check job's token/fork policy, pinned as behaviour.
 *
 * Four rules are load-bearing and until now lived only in YAML comments:
 *
 *   1. a hosted check runs when a token exists, and also when it does not but
 *      the event is not a fork PR — where the script then fails on the missing
 *      credential, so the job fails rather than passing unverified;
 *   2. a tokenless fork PR skips the two hosted checks and nothing else;
 *   3. the token-free checks are never gated and never advisory, so they fail
 *      the job on every event;
 *   4. every token-bearing step runs from the pinned base checkout and reads
 *      the PR's migrations as data, never executes from the PR checkout — and
 *      the fork companion does the same with its sparse data-only checkout.
 *
 * A test that compared the `if:` strings would fail on a harmless rewrite and
 * would still pass on a condition that reads the same but evaluates the other
 * way. So this parses the workflow, evaluates each step's condition against
 * the four contexts, and asserts which steps would be skipped. The evaluator
 * below is the GitHub expression subset these conditions use — no more.
 */

const WORKFLOW = `${process.cwd()}/.github/workflows/ci.yml`;
const FORK_WORKFLOW = `${process.cwd()}/.github/workflows/schema-check-fork.yml`;

/** The two checks that need `SUPABASE_ACCESS_TOKEN` (and a network call). */
const HOSTED_CHECKS = ['scripts/check-migrations.mjs', 'scripts/check-schema-hygiene.mjs'];

/** The checks that read only the checkout, and so must always run. */
const TOKEN_FREE_CHECKS = [
  'scripts/check-migration-immutability.mjs',
  'scripts/check-migration-sql.mjs',
];

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
  if?: unknown;
  steps?: Step[];
  defaults?: { run?: { 'working-directory'?: string } };
};

type Workflow = {
  on?: Record<string, unknown>;
  jobs: Record<string, Job>;
};

const workflow = Bun.YAML.parse(await Bun.file(WORKFLOW).text()) as Workflow;
const job = workflow.jobs['schema-check'];
const steps = job?.steps ?? [];

const forkWorkflow = Bun.YAML.parse(await Bun.file(FORK_WORKFLOW).text()) as Workflow;
const forkJob = forkWorkflow.jobs.hosted;
const forkSteps = forkJob?.steps ?? [];

type ExpressionValue = boolean | string | undefined;
type ExpressionContext = Record<string, ExpressionValue>;

/** GitHub truthiness for the values these conditions can produce. */
function truthy(value: ExpressionValue): boolean {
  return typeof value === 'boolean' ? value : value !== undefined;
}

/**
 * Evaluate a GitHub Actions `if:` expression.
 *
 * Grammar, in precedence order: `||`, `&&`, `==` / `!=`, `!`, parentheses,
 * string literals and dotted context paths. That is the whole subset the
 * schema-check job uses; anything else throws rather than guessing, so a
 * condition that reaches for a new operator fails loudly instead of passing
 * vacuously.
 */
function evaluate(condition: string, context: ExpressionContext): boolean {
  const tokens = condition.match(/'[^']*'|[A-Za-z_][A-Za-z0-9_.]*|&&|\|\||==|!=|!|\(|\)/g) ?? [];
  if (tokens.length === 0) {
    throw new Error(`cannot tokenize condition: ${condition}`);
  }

  let cursor = 0;
  const peek = (): string | undefined => tokens[cursor];

  function take(): string {
    const token = tokens[cursor];
    cursor += 1;
    if (token === undefined) throw new Error(`unexpected end of condition: ${condition}`);
    return token;
  }

  function primary(): ExpressionValue {
    const token = take();
    if (token === '(') {
      const value = disjunction();
      if (take() !== ')') throw new Error(`missing ")" in condition: ${condition}`);
      return value;
    }
    if (token.startsWith("'")) return token.slice(1, -1);
    if (token === 'true') return true;
    if (token === 'false') return false;
    return context[token];
  }

  function unary(): ExpressionValue {
    if (peek() === '!') {
      take();
      return !truthy(unary());
    }
    return primary();
  }

  function comparison(): ExpressionValue {
    const left = unary();
    const operator = peek();
    if (operator !== '==' && operator !== '!=') return left;
    take();
    // These conditions only ever compare booleans and the strings 'true' /
    // 'false', where GitHub's loose equality and this string comparison agree.
    const equal = String(left) === String(unary());
    return operator === '==' ? equal : !equal;
  }

  function conjunction(): ExpressionValue {
    let value = comparison();
    while (peek() === '&&') {
      take();
      // Evaluate both operands before combining: using `&&` here would skip
      // `comparison()` on a false left side and leave the cursor mid-condition.
      const left = truthy(value);
      const right = truthy(comparison());
      value = left && right;
    }
    return value;
  }

  function disjunction(): ExpressionValue {
    let value = conjunction();
    while (peek() === '||') {
      take();
      const left = truthy(value);
      const right = truthy(conjunction());
      value = left || right;
    }
    return value;
  }

  const result = disjunction();
  if (cursor !== tokens.length) {
    throw new Error(`unexpected "${peek()}" in condition: ${condition}`);
  }
  return truthy(result);
}

/** The context a step sees: whether the token was detected, and the event shape. */
function contextFor(tokenAvailable: boolean, fork: boolean | undefined): ExpressionContext {
  return {
    'steps.supabase.outputs.available': tokenAvailable ? 'true' : 'false',
    // Absent on `push`, which is why the condition is `!= true` and not `== false`.
    'github.event.pull_request.head.repo.fork': fork,
  };
}

const TOKEN = true;
const NO_TOKEN = false;
const FORK_PR = true;
const SAME_REPO_PR = false;
const PUSH = undefined;

function runs(step: Step, context: ExpressionContext): boolean {
  const condition = step.if;
  if (condition === undefined || condition === null) return true;
  if (typeof condition === 'boolean') return condition;
  if (typeof condition !== 'string') {
    throw new Error(`unexpected "if" value for step ${step.name ?? step.run ?? '?'}`);
  }
  return evaluate(condition, context);
}

function label(step: Step): string {
  return step.name ?? step.run ?? 'unnamed step';
}

/**
 * The check steps that would not run under a context, by name.
 *
 * Only `bun scripts/check-*` steps count. The fork-PR notice is a step too,
 * and it is *supposed* to be skipped outside a fork PR — counting it would
 * make "nothing is skipped" false for the wrong reason.
 */
function skippedChecks(context: ExpressionContext): string[] {
  return steps
    .filter((step) => !runs(step, context))
    .filter((step) => (step.run ?? '').includes('scripts/check-'))
    .map((step) => label(step));
}

function stepRunning(script: string): Step {
  const matches = steps.filter((step) => step.run?.includes(script));
  const [match, ...extra] = matches;
  if (!match || extra.length > 0) {
    throw new Error(
      `${script} must be the only command in exactly one schema-check step (found ${matches.length})`
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
function workingDirectory(step: Step, stepJob: Job | undefined): string | undefined {
  return step['working-directory'] ?? stepJob?.defaults?.run?.['working-directory'];
}

/** Any `run:` that names the untrusted checkout as a command or path. */
function executesFromPr(candidates: Step[]): string[] {
  return candidates
    .filter((step) => /(^|[\s"'=(])(\.\/)?pr\//.test(step.run ?? ''))
    .map((step) => label(step));
}

describe('schema-check conditions', () => {
  it('finds every expected check exactly once', () => {
    for (const script of [...HOSTED_CHECKS, ...TOKEN_FREE_CHECKS]) {
      expect(
        steps.filter((step) => (step.run ?? '').includes(script)),
        `${script} must appear in exactly one step`
      ).toHaveLength(1);
    }
  });

  it('detects the token in one step that reports "available"', () => {
    const detect = steps.find((step) => step.id === 'supabase');
    if (!detect)
      throw new Error('schema-check must have a token detection step with id "supabase"');

    expect(detect.run ?? '').toContain('available=true');
    expect(detect.run ?? '').toContain('available=false');
    expect(String(detect.env?.SUPABASE_ACCESS_TOKEN)).toContain('secrets.SUPABASE_ACCESS_TOKEN');
  });

  it('announces the fork-PR skip instead of skipping silently', () => {
    const notices = steps.filter(
      (step) => runs(step, contextFor(NO_TOKEN, FORK_PR)) && (step.run ?? '').includes('::notice')
    );
    expect(notices.length).toBeGreaterThan(0);
  });

  it('keeps both hosted checks blocking when they run', () => {
    for (const script of HOSTED_CHECKS) {
      expect(blocking(stepRunning(script)), `${script} must not be advisory`).toBe(true);
    }
  });

  it('keeps the token-free checks unconditional and blocking', () => {
    for (const script of TOKEN_FREE_CHECKS) {
      const step = stepRunning(script);
      expect(step.if, `${script} must not be gated`).toBeUndefined();
      expect(blocking(step), `${script} must fail the job`).toBe(true);
    }
  });
});

describe('hosted path: trusted scripts, PR data', () => {
  it('pins the trusted checkout to the base commit, with a push fallback', () => {
    const trusted = checkoutAt(steps, 'trusted');
    const ref = String(trusted.with?.ref ?? '');
    expect(ref).toContain('github.event.pull_request.base.sha');
    expect(ref).toContain('github.sha');
    expect(trusted.with?.['persist-credentials']).toBe(false);
  });

  it('checks the PR out with no persisted credentials', () => {
    expect(checkoutAt(steps, 'pr').with?.['persist-credentials']).toBe(false);
  });

  it('runs both hosted scripts from the trusted checkout', () => {
    for (const script of HOSTED_CHECKS) {
      expect(workingDirectory(stepRunning(script), job), `${script} must run from trusted`).toBe(
        'trusted'
      );
    }
  });

  it('feeds the history check the PR merge tree migrations', () => {
    const step = stepRunning('scripts/check-migrations.mjs');
    expect(String(step.env?.MIGRATIONS_DIR ?? '')).toContain('/pr/supabase/migrations');
  });

  it('never executes anything from the PR checkout', () => {
    expect(executesFromPr(steps)).toEqual([]);
  });

  it('runs the token-free checks against the PR tree, not the base', () => {
    for (const script of TOKEN_FREE_CHECKS) {
      expect(workingDirectory(stepRunning(script), job), `${script} must inspect the PR`).toBe(
        'pr'
      );
    }
  });

  it('does not let the immutability check compare the PR against itself', () => {
    const step = stepRunning('scripts/check-migration-immutability.mjs');
    const trustedPath = String(checkoutAt(steps, 'trusted').with?.path ?? '');
    const prPath = String(checkoutAt(steps, 'pr').with?.path ?? '');
    const base = String(step.env?.BASE_MIGRATIONS_DIR ?? '');

    // The step runs from `pr/` (the test above), so a relative or PR-relative
    // base would hash every file against itself and pass. It must name the
    // trusted checkout explicitly.
    expect(base, 'the base must be the trusted checkout').toBe(
      `\${{ github.workspace }}/${trustedPath}/supabase/migrations`
    );
    expect(base, 'the base must not be the PR checkout').not.toContain(`/${prPath}/`);
  });
});

describe('fork companion workflow', () => {
  it('runs on pull_request_target, not pull_request', () => {
    expect(Object.keys(forkWorkflow.on ?? {})).toEqual(['pull_request_target']);
  });

  it('is limited to fork PRs', () => {
    if (!forkJob) throw new Error('the fork workflow must have a "hosted" job');
    expect(forkJob.if).toBeTypeOf('string');
    expect(evaluate(String(forkJob.if), contextFor(TOKEN, FORK_PR))).toBe(true);
    expect(evaluate(String(forkJob.if), contextFor(TOKEN, SAME_REPO_PR))).toBe(false);
  });

  it('runs base scripts against a sparse, data-only fork checkout', () => {
    const trusted = checkoutAt(forkSteps, 'trusted');
    expect(String(trusted.with?.ref ?? '')).toContain('github.event.pull_request.base.sha');

    const pr = checkoutAt(forkSteps, 'pr');
    expect(pr.with?.['sparse-checkout']).toBe('supabase/migrations');
    expect(pr.with?.['persist-credentials']).toBe(false);
  });

  it('runs both hosted scripts from the trusted checkout', () => {
    for (const script of HOSTED_CHECKS) {
      const step = forkSteps.find((candidate) => (candidate.run ?? '').includes(script));
      if (!step) throw new Error(`${script} must appear in the fork workflow`);
      expect(workingDirectory(step, forkJob), `${script} must run from trusted`).toBe('trusted');
    }
  });

  it('never executes anything from the fork checkout', () => {
    expect(executesFromPr(forkSteps)).toEqual([]);
  });
});

/**
 * Every row the gate promises to handle, in one place.
 *
 * The rows above test the pieces; this tests the contract. `skips` is the only
 * outcome that leaves the job green, and it is reachable only when there is no
 * token *and* the event is a fork PR. Every other tokenless row runs the
 * hosted checks and fails on the configuration fault.
 */
const TRUTH_TABLE = [
  { label: 'token present, fork PR', token: TOKEN, fork: FORK_PR, hosted: 'runs' },
  { label: 'token present, same-repo PR', token: TOKEN, fork: SAME_REPO_PR, hosted: 'runs' },
  { label: 'token present, push', token: TOKEN, fork: PUSH, hosted: 'runs' },
  { label: 'no token, fork PR', token: NO_TOKEN, fork: FORK_PR, hosted: 'skips' },
  { label: 'no token, same-repo PR', token: NO_TOKEN, fork: SAME_REPO_PR, hosted: 'runs' },
  { label: 'no token, push', token: NO_TOKEN, fork: PUSH, hosted: 'runs' },
] as const;

describe('schema-check truth table', () => {
  const hostedNames = HOSTED_CHECKS.map((script) => label(stepRunning(script))).sort();

  it('has no job-level condition that would bypass every row', () => {
    // A job-level `if:` is evaluated before any step, so one condition there can
    // skip the whole job — and every row below would then describe steps that
    // never ran. The fork companion needs a job `if:` (it must only run for
    // forks); this job must not, so its policy lives in the steps the table
    // evaluates and nowhere else.
    expect(job, 'schema-check job must exist').toBeDefined();
    expect(job?.if, 'schema-check must not have a job-level "if:"').toBeUndefined();
  });

  for (const row of TRUTH_TABLE) {
    it(`${row.label}: hosted checks ${row.hosted}`, () => {
      const skipped = skippedChecks(contextFor(row.token, row.fork));

      if (row.hosted === 'skips') {
        // The only green-without-verification row, and it is limited to the
        // hosted pair: a fork PR must still get every token-free check.
        expect(skipped.sort()).toEqual(hostedNames);
      } else {
        expect(skipped).toEqual([]);
      }
    });
  }

  it('fails a tokenless non-fork run in the scripts themselves', async () => {
    // The workflow half says the steps run; this half says they do not return
    // success on a missing credential. Without it, "runs" could still mean a
    // green job with no verification.
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
