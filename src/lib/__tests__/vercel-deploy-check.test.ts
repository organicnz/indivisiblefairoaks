import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main as checkDeploy } from '../../../scripts/check-vercel-deploy.mjs';
import {
  credentialsFromEnv,
  FAILURE_STATES,
  failureReason,
  TERMINAL_STATES,
  VercelApiError,
} from '../../../scripts/vercel-api.mjs';

/**
 * The post-merge deploy check, and the exit-code contract CI acts on.
 *
 * This script has never run against a live Vercel project from this repository
 * — the fleet has been unable to schedule a job since 2026-10-05 — so its
 * behaviour is pinned here rather than inferred from a green pipeline. The
 * contract that matters is the *distinction between failure modes*: the whole
 * point of the rewrite was that a broken probe, a slow Vercel, a failed build
 * and a deployed-but-dead site are four different things, and the old job
 * reported all four as "health check failed after 90 s".
 *
 * `fetch` is mocked rather than the Vercel client, so the request shape is
 * asserted too — the endpoint version and the parameter name were both wrong in
 * the first draft (`/v6` + `meta-githubCommitSha`, against a documented `/v7` +
 * `sha`), and that would have failed at runtime, not at review.
 */

/** The commit under test. Passed as --sha by the workflow, never read from env. */
const SHA = 'a'.repeat(40);

/**
 * Credentials as an *object*, not by mutating `process.env`.
 *
 * The client takes `env` as a parameter precisely so this is possible, and
 * mutating the process environment leaks between test files in one worker — which
 * is how a suite ends up passing on another suite's setup. It would also trip
 * `no-raw-env-access.mjs`, and the honest reading of that guard is that a test
 * configuring the code under test is not application code reaching past the
 * validated env layer.
 */
function env(over: Record<string, string | undefined> = {}) {
  return {
    VERCEL_PROJECT_ID: 'prj_test',
    VERCEL_ORG_ID: 'team_test',
    VERCEL_TOKEN: 'tok_test',
    ...over,
  };
}

/**
 * Credentials for the API-shape tests, asserted rather than asserted-away with
 * `!`. A non-null assertion here would silence the one condition that matters
 * most for this module — a half-populated credential must not reach a request.
 */
function creds(over: Record<string, string | undefined> = {}) {
  const c = credentialsFromEnv(env(over));
  expect(c, 'env() must produce a complete credential').not.toBeNull();
  if (!c) throw new Error('unreachable — the expectation above already failed');
  return c;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** A deployment object shaped like the documented `/v7` response. */
function deployment(over: Record<string, unknown> = {}) {
  return {
    uid: 'dpl_1',
    state: 'READY',
    url: 'indivisible-fairoaks-abc123',
    gitSource: { sha: 'a'.repeat(40), ref: 'main' },
    errorCode: null,
    errorMessage: null,
    inspectorUrl: 'https://vercel.com/acme/nextjs/abc123',
    ...over,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('credentialsFromEnv', () => {
  it('returns null rather than a half-populated credential', () => {
    // The class of bug this whole module exists to avoid: a missing value
    // treated as an empty result rather than an unreachable store.
    expect(credentialsFromEnv(env({ VERCEL_TOKEN: undefined }))).toBeNull();
    expect(credentialsFromEnv(env({ VERCEL_PROJECT_ID: undefined }))).toBeNull();
  });

  it('treats teamId as optional, because a personal project has none', () => {
    expect(credentialsFromEnv(env({ VERCEL_ORG_ID: undefined }))).toEqual({
      projectId: 'prj_test',
      teamId: '',
      token: 'tok_test',
    });
  });
});

describe('terminal and failure state sets', () => {
  it('treats BLOCKED and DELETED as terminal failures', () => {
    // Both are in Vercel's documented `state` enum and both are outcomes the
    // check must fail on. Treating them as "still building" would leave the job
    // polling until its timeout and then report the wrong cause.
    for (const s of ['ERROR', 'CANCELED', 'BLOCKED', 'DELETED']) {
      expect(TERMINAL_STATES.has(s)).toBe(true);
      expect(FAILURE_STATES.has(s)).toBe(true);
    }
    for (const s of ['BUILDING', 'QUEUED', 'INITIALIZING']) {
      expect(TERMINAL_STATES.has(s)).toBe(false);
      expect(FAILURE_STATES.has(s)).toBe(false);
    }
    expect(TERMINAL_STATES.has('READY')).toBe(true);
    expect(FAILURE_STATES.has('READY')).toBe(false);
  });
});

describe('failureReason', () => {
  it("surfaces Vercel's own code and message", () => {
    expect(
      failureReason(
        deployment({ errorCode: 'BUILD_FAILED', errorMessage: 'Command "next build" exited 1' })
      )
    ).toBe('code: BUILD_FAILED — Command "next build" exited 1');
  });

  it('returns empty when Vercel gave no reason', () => {
    // Empty means "no reason given", NOT "no failure". A caller that
    // conflated them would report a successful deploy.
    expect(failureReason(deployment({ state: 'ERROR' }))).toBe('');
    expect(failureReason(null)).toBe('');
  });
});

describe('listDeployments request shape', () => {
  it('uses /v7 with projectId and sha', async () => {
    // Both were wrong in the first draft. The API is the thing being asserted
    // because a wrong version or parameter name produces a 404 at runtime that
    // no amount of reading the script would catch.

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ deployments: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { listDeployments } = await import('../../../scripts/vercel-api.mjs');
    const c = creds();
    await listDeployments(c.projectId, c.teamId, c.token, { sha: 'b'.repeat(40) });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://api.vercel.com');
    expect(url.pathname).toBe('/v7/deployments');
    expect(url.searchParams.get('projectId')).toBe('prj_test');
    expect(url.searchParams.get('teamId')).toBe('team_test');
    expect(url.searchParams.get('sha')).toBe('b'.repeat(40));
  });

  it('filters client-side, so a stale listing cannot report on the wrong build', async () => {
    const wanted = 'c'.repeat(40);
    const other = deployment({ uid: 'dpl_other', gitSource: { sha: 'd'.repeat(40) } });
    const mine = deployment({ uid: 'dpl_mine', gitSource: { sha: wanted } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ deployments: [other, mine] })));

    const { listDeployments } = await import('../../../scripts/vercel-api.mjs');
    const c = creds();
    const found = await listDeployments(c.projectId, c.teamId, c.token, {
      sha: wanted,
    });

    expect(found.map((d: { uid: string }) => d.uid)).toEqual(['dpl_mine']);
  });

  it('throws VercelApiError with the status, so the caller can tell it apart', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 403)));

    const { listDeployments } = await import('../../../scripts/vercel-api.mjs');
    const c = creds();
    await expect(listDeployments(c.projectId, c.teamId, c.token, {})).rejects.toBeInstanceOf(
      VercelApiError
    );
  });
});

describe('check-vercel-deploy exit-code contract', () => {
  /** Run `main` with the poll loop collapsed to one iteration. */
  const run = (opts: { deployments?: unknown[]; deps?: Record<string, unknown> } = {}) =>
    checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      // Non-zero and independent of `interval`: a zero health window would skip
      // the probe entirely, and every "it never served" assertion below would
      // pass without the probe having run.
      healthBudget: 1,
      listDeployments: async () => {
        if (opts.deployments) return opts.deployments;
        return [deployment()];
      },
      getBuildLog: async () => '',
      // The capture path calls the network too. Stub it here so this suite
      // stays offline; the real paginator is covered in
      // vercel-log-capture.test.ts with a sequenced fetch mock.
      getFullBuildLog: async () => ({ text: '', truncated: false, eventCount: 0 }),
      // Spread last so a test can override any of the above. `...undefined` in
      // an object literal is a no-op, so no fallback is needed.
      ...opts.deps,
    });

  it('exits 1 with a configuration message when credentials are absent', async () => {
    // Not a deploy failure. Reporting it as one would page whoever owns
    // Vercel for a problem in our own workflow configuration.
    expect(
      await checkDeploy({
        env: env({ VERCEL_TOKEN: undefined }),
        shaArg: SHA,
        budget: 1,
        interval: 0,
      })
    ).toBe(1);
  });

  it('exits 0 when Vercel is READY and the app reaches the database', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })));
    expect(await run()).toBe(0);
  });

  it('exits 0 on 503 — deployed and serving, database degraded', async () => {
    // The distinction the old job also got right and is worth keeping: 503 is
    // not a deploy failure, and failing here would send someone to look at
    // Vercel when the answer is Supabase.

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'degraded' }, 503)));
    expect(await run()).toBe(0);
  });

  it.each([
    ['ERROR', /Deployment ERROR/],
    ['CANCELED', /Deployment CANCELED/],
    ['BLOCKED', /Deployment BLOCKED/],
    ['DELETED', /Deployment DELETED/],
  ])('reports %s as a failure, not as a build that never settled', async (state, expected) => {
    // The exit code alone is not enough to pin this. A terminal failure and a
    // build that ran out of budget BOTH exit 1, so asserting only the code
    // would pass even with the failure-state set reduced to ERROR/CANCELED —
    // which is exactly what happened when this test was first written. Asserting
    // the message is what makes BLOCKED and DELETED distinguishable from "still
    // building when the budget ran out", which is the diagnostic difference.

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = await run({
      deployments: [deployment({ state, errorCode: 'BUILD_FAILED' })],
    });
    expect(exit).toBe(1);
    const said = err.mock.calls.flat().join(' ');
    expect(said).toMatch(expected);
    expect(said).not.toMatch(/never left/i);
    expect(said).toMatch(/BUILD_FAILED/);
    err.mockRestore();
  });

  it('exits 1 — and says the probe broke, not the deploy — when the API is unreachable', async () => {
    // The distinction the rewrite exists for. Previously a slow or unreachable
    // Vercel produced the same red as a broken deploy.

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      listDeployments: async () => {
        throw new VercelApiError('vercel deployments API 502', { status: 502 });
      },
    });
    expect(exit).toBe(1);
    const said = err.mock.calls.flat().join(' ');
    expect(said).toMatch(/probe failed/i);
    expect(said).toMatch(/NOT evidence about the deploy/i);
    err.mockRestore();
  });

  it('exits 1 when Vercel is READY but the site never serves', async () => {
    // The genuine deploy failure, and the one that is impossible to see from a
    // build log: it compiled, it is deployed, it does not work.

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ...jsonResponse({}, 500), status: 500 }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run()).toBe(1);
    const said = err.mock.calls.flat().join(' ');
    expect(said).toMatch(/never served/i);
    err.mockRestore();
  });

  it('exits 1 when the deployment redirects — a host that does not serve the app', async () => {
    // Previously inferred from a guessed URL plus a hardcoded host. Now the URL
    // comes from Vercel, so a redirect means something is genuinely wrong.

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 302, json: async () => null })
    );
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run()).toBe(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/does not serve the app/i);
    err.mockRestore();
  });
});
