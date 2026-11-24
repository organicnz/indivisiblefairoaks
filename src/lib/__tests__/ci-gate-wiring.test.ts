// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runText } from '../../../scripts/bun-exec.mjs';

/**
 * Gate wiring is easy to break silently: renaming a script leaves a workflow
 * pointing at a path that no longer exists, adding a check without wiring it
 * leaves a gate that never runs, and a copy-pasted `env:` block can hand the
 * Supabase token to a step that was supposed to be token-free.
 *
 * The sources are parsed rather than restated. A test that hard-coded the
 * current list of scripts would pass after a rename that broke both the gate
 * and the test's copy of the answer.
 *
 * "Gate" here means a GitHub Actions workflow or a lefthook command. A
 * `package.json` script is a convenience entry point, not a gate: nothing runs
 * it unless a workflow or hook does.
 */

const ROOT = process.cwd();
const WORKFLOW_DIR = `${ROOT}/.github/workflows`;
const LEFTHOOK = `${ROOT}/lefthook.yml`;
const SCRIPT_DIR = `${ROOT}/scripts`;

/** A `bun scripts/...` command, including the `bun --bun` form. */
const BUN_SCRIPT = /\bbun(?:\s+--bun)?\s+(scripts\/[A-Za-z0-9_./-]+)/g;

/** A check script invoked through Bun. */
const CHECK_INVOCATION = /\bbun(?:\s+--bun)?\s+scripts\/(check-[A-Za-z0-9_.-]+\.mjs)\b/g;

/** The two scripts that may hold a Supabase access token in the schema gate. */
const HOSTED_CHECKS = ['scripts/check-migrations.mjs', 'scripts/check-schema-hygiene.mjs'];

const TOKEN_NAME = /SUPABASE_(?:READ_ONLY_)?ACCESS_TOKEN/;

type WorkflowStep = {
  name?: string;
  run?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
  [key: string]: unknown;
};

type WorkflowJob = {
  env?: Record<string, unknown>;
  steps?: WorkflowStep[];
  [key: string]: unknown;
};

type Workflow = {
  env?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
  [key: string]: unknown;
};

type LocatedStep = {
  file: string;
  jobId: string;
  job: WorkflowJob;
  step: WorkflowStep;
  index: number;
};

type LoadedWorkflow = {
  file: string;
  workflow: Workflow;
  steps: LocatedStep[];
};

/**
 * Every `run:` string in a parsed YAML document. Recursing rather than reading
 * the raw file is what keeps comments out of the scan: a comment mentioning a
 * script is not a step that runs it.
 */
function collectRunBlocks(value: unknown): string[] {
  const runs: string[] = [];

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!node || typeof node !== 'object') return;

    for (const [key, child] of Object.entries(node)) {
      if (key === 'run' && typeof child === 'string') runs.push(child);
      else walk(child);
    }
  };

  walk(value);
  return runs;
}

/** Ignore whole-line shell comments so a commented command is not wiring. */
function commandLines(runs: string[]): string[] {
  return runs.flatMap((run) => run.split('\n').filter((line) => !line.trimStart().startsWith('#')));
}

function referencedScripts(runs: string[]): Set<string> {
  const scripts = new Set<string>();
  for (const run of runs) {
    for (const match of run.matchAll(BUN_SCRIPT)) scripts.add(match[1]);
  }
  return scripts;
}

function invokedChecks(runs: string[]): Set<string> {
  const checks = new Set<string>();
  for (const run of runs) {
    for (const match of run.matchAll(CHECK_INVOCATION)) checks.add(`scripts/${match[1]}`);
  }
  return checks;
}

function envMentionsToken(env: Record<string, unknown> | undefined): boolean {
  if (!env) return false;
  return Object.entries(env).some(([key, value]) => {
    return TOKEN_NAME.test(key) || TOKEN_NAME.test(String(value));
  });
}

/** A token in `env`, `with`, or a command still means the step receives it. */
function mentionsToken(step: WorkflowStep): boolean {
  if (envMentionsToken(step.env) || envMentionsToken(step.with)) return true;
  return commandLines([step.run ?? '']).some((line) => TOKEN_NAME.test(line));
}

function hostedCheckIn(step: WorkflowStep): string | undefined {
  return HOSTED_CHECKS.find((script) => step.run?.includes(script));
}

const workflowFiles: string[] = [];
for await (const file of new Bun.Glob('*.{yml,yaml}').scan({ cwd: WORKFLOW_DIR })) {
  workflowFiles.push(file);
}
workflowFiles.sort();

const workflows: LoadedWorkflow[] = [];
for (const file of workflowFiles) {
  const workflow = Bun.YAML.parse(await Bun.file(`${WORKFLOW_DIR}/${file}`).text()) as Workflow;
  const steps: LocatedStep[] = [];

  for (const [jobId, job] of Object.entries(workflow.jobs ?? {})) {
    (job.steps ?? []).forEach((step, index) => {
      steps.push({ file, jobId, job, step, index });
    });
  }

  workflows.push({ file, workflow, steps });
}

const lefthook = Bun.YAML.parse(await Bun.file(LEFTHOOK).text());
const workflowRuns = workflows.flatMap(({ workflow }) => collectRunBlocks(workflow));
const gateRuns = commandLines([...workflowRuns, ...collectRunBlocks(lefthook)]);

/**
 * Workflows that own the schema gate. `ci.yml` is included even though it is
 * token-free, so a credential added there fails too. Any workflow invoking a
 * hosted check is included, which keeps a new schema gate from escaping the
 * rule; delivery, freshness and reconciliation workflows do not invoke either
 * hosted check and are deliberately out of scope.
 */
const tokenScope = workflows.filter(
  ({ file, steps }) =>
    file === 'ci.yml' || steps.some(({ step }) => hostedCheckIn(step) !== undefined)
);

/** The file names tracked in the commit the test is running against. */
const headFiles = new Set(
  runText(['git', 'ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean)
);

const checkScripts: string[] = [];
for await (const file of new Bun.Glob('check-*.mjs').scan({ cwd: SCRIPT_DIR })) {
  checkScripts.push(`scripts/${file}`);
}
checkScripts.sort();

describe('CI gate wiring', () => {
  it('keeps every bun script referenced by a workflow present at HEAD', () => {
    const referenced = referencedScripts(commandLines(workflowRuns));
    expect(referenced.size).toBeGreaterThan(0);

    const missing = [...referenced].filter((path) => !headFiles.has(path)).sort();
    expect(missing, 'workflow references a script that does not exist at HEAD').toEqual([]);
  });

  it('wires every check script into at least one gate', () => {
    expect(checkScripts.length).toBeGreaterThan(0);

    const invoked = invokedChecks(gateRuns);
    const unwired = checkScripts.filter((script) => !invoked.has(script));
    expect(unwired, 'check script is not invoked by a workflow or lefthook').toEqual([]);
  });

  it('gives SUPABASE_ACCESS_TOKEN only to the two hosted schema checks', () => {
    const findings: string[] = [];

    for (const { file, workflow, steps } of tokenScope) {
      if (envMentionsToken(workflow.env)) findings.push(`${file}: workflow-level env`);
      for (const [jobId, job] of Object.entries(workflow.jobs ?? {})) {
        if (envMentionsToken(job.env)) findings.push(`${file}:${jobId}: job-level env`);
      }
      for (const { jobId, step, index } of steps) {
        if (!mentionsToken(step)) continue;
        if (hostedCheckIn(step)) continue;
        findings.push(`${file}:${jobId}: step ${index + 1} (${step.name ?? 'unnamed'})`);
      }
    }

    expect(findings, 'a non-hosted schema step receives SUPABASE_ACCESS_TOKEN').toEqual([]);

    const trusted = workflows.find(({ file }) => file === 'schema-check-trusted.yml');
    if (!trusted) throw new Error('schema-check-trusted.yml must exist');

    const tokenSteps = trusted.steps.filter(({ step }) => mentionsToken(step));
    expect(tokenSteps).toHaveLength(2);
    expect(tokenSteps.map(({ step }) => hostedCheckIn(step)).sort()).toEqual(
      [...HOSTED_CHECKS].sort()
    );
  });
});
