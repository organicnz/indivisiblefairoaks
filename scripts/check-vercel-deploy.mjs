#!/usr/bin/env node
/**
 * Post-merge deploy confirmation: did *this commit* actually ship, and does the
 * deployed app work?
 *
 *   node scripts/check-vercel-deploy.mjs
 *   node scripts/check-vercel-deploy.mjs --sha=<full-sha>
 *
 * ## Why this exists instead of polling a URL
 *
 * The job this replaces slept for a fixed 90 seconds and then curled
 * `NEXT_PUBLIC_SITE_URL` (falling back to a hardcoded staging host). That had
 * four defects, all of them consequences of *guessing*:
 *
 *   1. The 90 s was a guess at how long a Vercel build takes. Slow builds went
 *      red; fast ones wasted 90 s.
 *   2. The host was a guess, with a fallback and a whole branch of the script
 *      dedicated to detecting that the apex 302s to Google Sites.
 *   3. A failure carried no attribution. "Health check failed after 90 s" reads
 *      as *our* CI failing, even when Vercel was simply slow.
 *   4. It could not say *which* build it was probing.
 *
 * Asking Vercel removes all four. The deployment for this commit has a `state`
 * and a `url`; there is nothing to guess.
 *
 * ## What this deliberately does NOT replace
 *
 * Stage 2 hits `/api/health`, which fetches `products?select=id&limit=1` from
 * Supabase. That is a live app-to-database check, and **no build log can stand
 * in for it** — a clean compile says nothing about whether the deployed app can
 * reach the database with production environment values. Vercel reporting
 * `READY` means the code compiled, not that the site works.
 *
 * Runtime logs are the weakest of the three options and are deliberately not
 * read here: nobody requests the app after a deploy, so there are no runtime
 * invocations to inspect. Logs are diagnostic *after* something exercises the
 * app, which makes them a debugging aid rather than a gate.
 *
 * ## Exit codes — each failure mode is distinguishable
 *
 *   0  READY, and health returned 200 (503 is a warning: up, DB degraded)
 *   1  deployment ERROR/CANCELED — Vercel's own build text is printed
 *   1  no deployment appeared for this SHA within the budget
 *   1  the Vercel API was unreachable — our probe broke, not the deploy
 *   1  READY but health never served — the genuine deploy failure
 *
 * That last distinction is the one that used to be impossible.
 */

import {
  credentialsFromEnv,
  failureReason,
  FAILURE_STATES,
  getBuildLog,
  listDeployments,
  TERMINAL_STATES,
  VercelApiError,
} from './vercel-api.mjs';

const args = process.argv.slice(2);
const shaArg = args.find((a) => a.startsWith('--sha='))?.slice('--sha='.length) ?? '';
const budgetMs = Number(args.find((a) => a.startsWith('--budget='))?.slice('--budget='.length) ?? 600_000);
const intervalMs = Number(args.find((a) => a.startsWith('--interval='))?.slice('--interval='.length) ?? 15_000);

/** `/api/health` gets 200 when the DB is reachable and 503 when it is not. */
async function probeHealth(origin) {
  try {
    const res = await fetch(`${origin}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      redirect: 'manual',
    });
    // A redirect here is the *old* failure mode this job used to guess its way
    // around: a host that does not serve this app. Report it as such instead of
    // inferring it from a 302.
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, reason: `redirected (HTTP ${res.status}) — this host does not serve the app` };
    }
    if (res.status === 200) return { ok: true, degraded: false };
    if (res.status === 503) return { ok: true, degraded: true };
    return { ok: false, reason: `unexpected status HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'timed out' : String(err?.message ?? err) };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function main(deps = {}) {
  // All of these are read inside `main` rather than at module scope: a
  // module-scope read of the environment captures it at import time, and makes
  // every branch unreachable from a test. `deps` overrides are injectable so the
  // decision tables can be exercised without real time or real credentials.
  const list = deps.listDeployments ?? listDeployments;
  const log = deps.getBuildLog ?? getBuildLog;
  const budget = deps.budget ?? budgetMs;
  const interval = deps.interval ?? intervalMs;
  // Separate from `budget`: once Vercel says READY the app needs a moment to
  // boot, and deriving that window from the poll interval would make it zero for
  // a fast poll — the probe would be skipped entirely rather than run once.
  const healthBudget = deps.healthBudget ?? 120_000;

  const creds = credentialsFromEnv(deps.env ?? process.env);
  if (!creds) {
    console.error('✖  VERCEL_PROJECT_ID / VERCEL_TOKEN are not set — cannot verify the deploy.');
    console.error('   This is a configuration fault on our side, not a deploy failure.');
    return 1;
  }

  // The SHA is required as an argument, not read from the environment.
  //
  // `GITHUB_SHA` would work — GitHub injects it — but reading `process.env`
  // outside the validated env layer is exactly what
  // `scripts/hooks/no-raw-env-access.mjs` exists to prevent, and adding a
  // CI-injected variable to `.env.example` would be worse: it would describe an
  // app setting that does not exist. The workflow knows the SHA and can state it.
  const sha = deps.shaArg ?? shaArg;
  if (!sha) {
    console.error('✖  No commit SHA given. Pass --sha=<full-sha>.');
    return 1;
  }

  console.log(`🔍 Looking for the Vercel deployment of ${sha.slice(0, 8)}…`);

  const deadline = Date.now() + budget;
  let deployment = null;
  let lastSeen = null;

  while (Date.now() < deadline) {
    try {
      const found = await list(creds.projectId, creds.teamId, creds.token, { sha });
      if (found.length > 0) {
        deployment = found[0];
        if (TERMINAL_STATES.has(deployment.state)) break;
        lastSeen = deployment.state;
        console.log(`   … ${deployment.state} (build in progress)`);
      } else if (lastSeen) {
        // Once seen, a later empty page means the deployment dropped out of the
        // filtered list. Say so rather than silently restarting the wait.
        console.log(`   … ${lastSeen}, not currently listed — still waiting`);
      } else {
        console.log('   … no deployment listed yet');
      }
    } catch (err) {
      if (err instanceof VercelApiError) {
        console.error(`✖  Vercel API unreachable: ${err.message}`);
        console.error('   Our probe failed. This is NOT evidence about the deploy.');
        return 1;
      }
      throw err;
    }
    await sleep(interval);
  }

  if (!deployment) {
    console.error(`✖  No deployment for ${sha.slice(0, 8)} after ${Math.round(budget / 1000)}s.`);
    console.error('   Either Vercel has not started one, or it was superseded by a newer push.');
    return 1;
  }

  const state = deployment.state;
  const url = deployment.url ? `https://${deployment.url}` : '';

  if (FAILURE_STATES.has(state)) {
    console.error(`✖  Deployment ${state}.`);
    // Vercel's own words first: `errorCode`/`errorMessage` ride on the
    // deployment object, so this cannot fail separately from the state we just
    // read and needs no second request.
    const reason = failureReason(deployment);
    if (reason) console.error(`   Vercel says: ${reason}`);
    // Then the raw log, for detail. Best-effort only — see `getBuildLog`.
    const buildLog = await log(deployment.url ?? deployment.uid, creds.teamId, creds.token);
    if (buildLog) {
      console.error('--- Vercel build log (tail) ---');
      console.error(buildLog.split('\n').slice(-60).join('\n'));
      console.error('-------------------------------');
    }
    if (deployment.inspectorUrl) console.error(`   Inspect: ${deployment.inspectorUrl}`);
    return 1;
  }

  if (state !== 'READY') {
    console.error(`✖  Deployment never left ${state} within the budget.`);
    return 1;
  }

  console.log(`✅ Vercel reports READY — ${url}`);

  if (!url) {
    console.error('✖  Deployment is READY but reported no URL; cannot probe it.');
    return 1;
  }

  // Stage 2 — the part no build log can do.
  //
  // `do…while`, not `while`: the first probe must happen unconditionally. With a
  // plain `while` against a deadline computed from the clock, a short budget
  // could elapse before the loop body ever ran and the script would report
  // "never served" without having asked once. The retry gap is `interval` and
  // the loop re-checks the deadline *before* sleeping, so it cannot overrun the
  // budget the way a fixed sleep did.
  const healthDeadline = Date.now() + healthBudget;
  let last = null;
  do {
    last = await probeHealth(url);
    if (last.ok) break;
    if (Date.now() >= healthDeadline) break;
    await sleep(interval);
  } while (Date.now() < healthDeadline);

  if (!last?.ok) {
    console.error(`✖  Deployment is READY but ${url}/api/health never served (${last?.reason}).`);
    console.error('   The build succeeded and the site does not work. Check runtime env and egress.');
    return 1;
  }

  if (last.degraded) {
    // Deployed and serving; the database is the problem. Keeping this a warning
    // rather than a failure is the point of the 503 branch — it tells you the
    // deploy is not what broke.
    console.warn('::warning::/api/health reports 503 — the app is serving but cannot reach Supabase.');
    console.warn('::warning::This is not a deploy failure. Check the database.');
  } else {
    console.log('✅ App is serving and can reach the database.');
  }

  return 0;
}

// Auto-run only when invoked directly. Importing this module from a test must
// not execute the check — the exit-code contract below is the thing CI acts on,
// so it is the thing most worth pinning with a test, and it cannot be reached
// through a module that runs on import.
const invokedDirectly = process.argv[1]?.endsWith('check-vercel-deploy.mjs');
if (invokedDirectly) {
  process.exit(await main());
}