#!/usr/bin/env node
/**
 * Post-merge deploy confirmation: did *this commit* actually ship, and does the
 * deployed app work?
 *
 *   node scripts/check-vercel-deploy.mjs
 *   node scripts/check-vercel-deploy.mjs --sha=<full-sha>
 *   node scripts/check-vercel-deploy.mjs --sha=<full-sha> --out=vercel-logs
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
 * The probe targets the deployment URL first — that proves *this build*
 * serves. Team SSO protection gates `*.vercel.app` behind a vercel.com login,
 * so on exactly that redirect (and only that one) the check falls back to the
 * declared production origin (`--site-url`, the repo variable, never a guess)
 * and says so in the summary. Any other redirect still fails: the apex 302 to
 * Google Sites is a genuine misconfiguration, not gating.
 *
 * Runtime logs are the weakest of the three options and are deliberately not
 * read here: nobody requests the app after a deploy, so there are no runtime
 * invocations to inspect. Logs are diagnostic *after* something exercises the
 * app, which makes them a debugging aid rather than a gate.
 *
 * ## Capture: the full build log, every execution
 *
 * Once the deployment reaches a terminal state the script pages its complete
 * build-event log, scrubs it (`scrub-secrets.mjs` — workflow-log masking does
 * not cover artifact bytes) and writes `vercel-build-<sha>.log` plus a
 * `vercel-build-<sha>.summary.md` into `--out`. The workflow uploads both as
 * an artifact, so every production deploy leaves its evidence behind without
 * anyone opening the Vercel dashboard.
 *
 * Capture is verdict-neutral by construction: the verdict comes only from the
 * deployment state and the health probe. A capture failure degrades to a
 * `::warning::` and a note in the summary — it can neither clear a failed
 * deploy nor fail a healthy one. The ordering inside `main` is verdict first,
 * evidence second, for exactly this reason.
 *
 * ## Exit codes — each failure mode is distinguishable
 *
 *   0  READY, and health returned 200 (503 is a warning: up, DB degraded)
 *   0  no deployment for this SHA, but a newer SHA has one (superseded push)
 *   0  deployment CANCELED, but a newer SHA has one (superseded, not failed)
 *   1  deployment ERROR/CANCELED/BLOCKED — Vercel's own build text is printed
 *   1  no deployment appeared for this SHA within the budget, and none newer
 *   1  the Vercel API never answered — our probe broke, not the deploy
 *   1  READY but health never served — the genuine deploy failure
 *
 * That last distinction is the one that used to be impossible.
 */

import {
  credentialsFromEnv,
  failureReason,
  FAILURE_STATES,
  getBuildLog,
  getFullBuildLog,
  listDeployments,
  TERMINAL_STATES,
  VercelApiError,
} from './vercel-api.mjs';
import { scrubSecrets } from './scrub-secrets.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const shaArg = args.find((a) => a.startsWith('--sha='))?.slice('--sha='.length) ?? '';
const outArg = args.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? '';
// Declared production origin, probed when the deployment URL itself is
// unreachable for reasons outside the app (SSO-gating below). A repo variable,
// not a guess: the workflow passes vars.NEXT_PUBLIC_SITE_URL, the same source
// site.ts builds every canonical URL from.
const siteUrlArg = args.find((a) => a.startsWith('--site-url='))?.slice('--site-url='.length) ?? '';
const budgetMs = Number(args.find((a) => a.startsWith('--budget='))?.slice('--budget='.length) ?? 600_000);
const intervalMs = Number(args.find((a) => a.startsWith('--interval='))?.slice('--interval='.length) ?? 15_000);

/** A transient API blip must not fail a 10-minute poll. See the loop below. */
const MAX_CONSECUTIVE_API_ERRORS = 5;
/** The summary carries a preview; the full text lives in the artifact. */
const SUMMARY_TAIL_LINES = 40;

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
    // inferring it from a 302. The redirect target rides along so the caller
    // can tell SSO-gating (vercel.com) from a genuine misconfiguration.
    if (res.status >= 300 && res.status < 400) {
      const location =
        typeof res.headers?.get === 'function' ? (res.headers.get('location') ?? '') : '';
      return { ok: false, reason: `redirected (HTTP ${res.status}) — this host does not serve the app`, location };
    }
    if (res.status === 200) return { ok: true, degraded: false };
    if (res.status === 503) return { ok: true, degraded: true };
    return { ok: false, reason: `unexpected status HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'timed out' : String(err?.message ?? err) };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when a redirect target is Vercel's SSO gate rather than the app. */
function isSsoRedirect(location) {
  if (!location) return false;
  try {
    return new URL(location, 'https://placeholder.invalid').hostname === 'vercel.com';
  } catch {
    return false;
  }
}

/** The git SHA Vercel built a deployment from, whatever field carries it. */
function deploymentSha(d) {
  return d?.gitSource?.sha ?? d?.meta?.githubCommitSha ?? d?.gitCommitSha ?? null;
}

export async function main(deps = {}) {
  // All of these are read inside `main` rather than at module scope: a
  // module-scope read of the environment captures it at import time, and makes
  // every branch unreachable from a test. `deps` overrides are injectable so the
  // decision tables can be exercised without real time or real credentials.
  const list = deps.listDeployments ?? listDeployments;
  const log = deps.getBuildLog ?? getBuildLog;
  const fullLog = deps.getFullBuildLog ?? getFullBuildLog;
  const scrub = deps.scrubSecrets ?? scrubSecrets;
  const budget = deps.budget ?? budgetMs;
  const interval = deps.interval ?? intervalMs;
  // Separate from `budget`: once Vercel says READY the app needs a moment to
  // boot, and deriving that window from the poll interval would make it zero for
  // a fast poll — the probe would be skipped entirely rather than run once.
  const healthBudget = deps.healthBudget ?? 120_000;
  const environment = deps.env ?? process.env;
  // File writes happen only when an output dir is configured — the workflow
  // always passes `--out`, unit tests pass a tmp dir or nothing. A null dir
  // skips the writes without changing any verdict.
  const outDir = deps.outDir ?? (outArg || null);
  const siteUrl = deps.siteUrl ?? (siteUrlArg || null);

  const summary = [];
  const note = (line) => summary.push(line);

  const finish = async (code) => {
    if (outDir) {
      try {
        await mkdir(outDir, { recursive: true });
        await writeFile(path.join(outDir, summaryFile), `${summary.join('\n')}\n`);
        const stepSummary = environment.GITHUB_STEP_SUMMARY;
        if (typeof stepSummary === 'string' && stepSummary) {
          await writeFile(stepSummary, `${summary.join('\n')}\n`, { flag: 'a' });
        }
      } catch {
        console.warn('::warning::could not write the deploy summary file.');
      }
    }
    return code;
  };

  // The summary filename needs the SHA, which the config-fault paths below do
  // not have yet — so it is assigned once the SHA is known, and the early
  // paths use a fixed name. `finish` closes over the binding, not the value.
  let summaryFile = 'vercel-deploy.summary.md';

  try {
    const creds = credentialsFromEnv(environment);
    if (!creds) {
      console.error('✖  VERCEL_PROJECT_ID / VERCEL_TOKEN are not set — cannot verify the deploy.');
      console.error('   This is a configuration fault on our side, not a deploy failure.');
      note('# Vercel deploy check — no credentials');
      note('VERCEL_PROJECT_ID / VERCEL_TOKEN are not set. Configuration fault, not a deploy failure.');
      return await finish(1);
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
      note('# Vercel deploy check — no SHA');
      note('No commit SHA given. Pass --sha=<full-sha>.');
      return await finish(1);
    }
    const short = sha.slice(0, 8);
    summaryFile = `vercel-build-${short}.summary.md`;
    note(`# Vercel deploy check — ${short}`);

    // A newer deployment for a *different* SHA means this commit's build was
    // superseded by a fast-follow push — green with a notice, not red. A
    // broken probe here returns null rather than throwing: this refines a
    // verdict, it must not mask one.
    const supersededBy = async () => {
      try {
        const recent = await list(creds.projectId, creds.teamId, creds.token, {});
        for (const d of recent) {
          const s = deploymentSha(d);
          if (s && s !== sha) return s.slice(0, 8);
        }
        return null;
      } catch {
        return null;
      }
    };

    // Best-effort evidence capture. Never throws, never affects the verdict:
    // the caller decides pass/fail from state and health, and this only
    // attaches the log. Returns the artifact filename (or null) for the summary.
    const captureEvidence = async (deployment) => {
      try {
        const full = await fullLog(
          deployment.url ?? deployment.uid,
          creds.teamId,
          creds.token
        );
        const scrubbed = scrub(full.text, [creds.token]);
        let file = null;
        if (outDir) {
          await mkdir(outDir, { recursive: true });
          file = path.join(outDir, `vercel-build-${short}.log`);
          await writeFile(file, scrubbed);
        }
        return {
          ok: true,
          truncated: full.truncated,
          eventCount: full.eventCount,
          lineCount: full.lineCount ?? 0,
          file,
          tail: scrubbed.split('\n').slice(-SUMMARY_TAIL_LINES).join('\n'),
        };
      } catch (err) {
        return { ok: false, truncated: true, eventCount: 0, lineCount: 0, file: null, tail: '', error: String(err?.message ?? err) };
      }
    };

    const noteCapture = (evidence) => {
      if (evidence.ok) {
        note(
          `- Build log: \`${evidence.file ?? '(not written — no --out)'}\` ` +
            `(${evidence.eventCount} events, ${evidence.lineCount} lines${evidence.truncated ? ', TRUNCATED at the size cap' : ''})`
        );
        if (evidence.eventCount > 0 && evidence.lineCount === 0) {
          note('- Build log: Vercel returned events but no text lines — the extraction may not match the event shape. The empty file records the gap; it is not evidence of a clean build.');
        }
        note('<details><summary>Build log tail</summary>');
        note('');
        note('```');
        note(evidence.tail);
        note('```');
        note('</details>');
      } else {
        note(`- Build log: capture failed (${evidence.error ?? 'unknown error'}) — verdict below stands on state and health alone.`);
      }
    };

    console.log(`🔍 Looking for the Vercel deployment of ${short}…`);

    const deadline = Date.now() + budget;
    let deployment = null;
    let lastSeen = null;
    // A single failed poll is a blip, even the first one: failing fast on an
    // early error would report "probe failed" for a transient fault followed
    // by success, while tolerating a handful costs a genuinely broken
    // configuration only a few extra poll gaps before the same verdict.
    let apiErrors = 0;

    const probeFailed = async (message) => {
      console.error(`✖  Vercel API unreachable: ${message}`);
      console.error('   Our probe failed. This is NOT evidence about the deploy.');
      note(`- Probe failure: the Vercel API was unreachable (${message}). NOT evidence about the deploy.`);
      return await finish(1);
    };

    while (Date.now() < deadline) {
      try {
        const found = await list(creds.projectId, creds.teamId, creds.token, { sha });
        apiErrors = 0;
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
        if (!(err instanceof VercelApiError)) throw err;
        apiErrors++;
        if (apiErrors > MAX_CONSECUTIVE_API_ERRORS) {
          return await probeFailed(err.message);
        }
        console.log(`   … Vercel API blip (${apiErrors}/${MAX_CONSECUTIVE_API_ERRORS}) — still waiting`);
      }
      await sleep(interval);
    }

    // The budget ran out mid-blip-streak: the API never gave an answer to wait
    // on, so this is a broken probe rather than a missing deployment.
    if (apiErrors > 0) {
      return await probeFailed('no successful poll within the budget');
    }

    if (!deployment) {
      const by = await supersededBy();
      if (by) {
        console.log(`○  No deployment for ${short} — superseded by ${by}; not a failure.`);
        console.log(`::notice::No Vercel deployment for ${short}; ${by} shipped instead.`);
        note(`- No deployment for this SHA — superseded by ${by}. Not a failure.`);
        return await finish(0);
      }
      console.error(`✖  No deployment for ${short} after ${Math.round(budget / 1000)}s.`);
      console.error('   Either Vercel has not started one, or it was superseded by a newer push.');
      note(`- No deployment for this SHA after ${Math.round(budget / 1000)}s, and none newer. Vercel never started one.`);
      return await finish(1);
    }

    const state = deployment.state;
    const url = deployment.url ? `https://${deployment.url}` : '';
    note(`- Deployment: \`${deployment.uid ?? '?'}\` — ${state}${url ? ` (${url})` : ''}`);

    if (FAILURE_STATES.has(state)) {
      // A CANCELED build behind a newer deployment is a superseded push, not
      // a broken one — rapid pushes cancel the older build on Vercel's side.
      if (state === 'CANCELED') {
        const by = await supersededBy();
        if (by) {
          console.log(`○  Deployment CANCELED — superseded by ${by}; not a failure.`);
          console.log(`::notice::Deployment for ${short} was canceled; ${by} shipped instead.`);
          note(`- Deployment CANCELED, superseded by ${by}. Not a failure.`);
          return await finish(0);
        }
      }
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
      note(`- Verdict: FAILED (${state})${reason ? ` — ${reason}` : ''}`);
      const evidence = await captureEvidence(deployment);
      noteCapture(evidence);
      if (!evidence.ok) {
        console.warn(`::warning::build-log capture failed (${evidence.error}); the verdict above stands.`);
      }
      return await finish(1);
    }

    if (state !== 'READY') {
      console.error(`✖  Deployment never left ${state} within the budget.`);
      note(`- Verdict: FAILED — deployment never left ${state} within the budget (slow, not proven broken).`);
      return await finish(1);
    }

    console.log(`✅ Vercel reports READY — ${url}`);

    if (!url) {
      console.error('✖  Deployment is READY but reported no URL; cannot probe it.');
      note('- Verdict: FAILED — READY but reported no URL; cannot probe it.');
      return await finish(1);
    }

    // Evidence before the probe: the probe loop can burn its whole budget, and
    // the log must be secured regardless of what it concludes.
    const evidence = await captureEvidence(deployment);
    noteCapture(evidence);
    if (!evidence.ok) {
      console.warn(`::warning::build-log capture failed (${evidence.error}); the verdict below stands.`);
    }

    // Stage 2 origin: the deployment URL proves *this build* serves, but team
    // SSO protection gates `*.vercel.app` behind a vercel.com login — an
    // unauthenticated probe 302s there without the app ever seeing it. On
    // exactly that redirect, fall back to the declared production origin for
    // the serving check. Any other redirect keeps failing here: the apex 302
    // to Google Sites this branch used to detect is a genuine misconfiguration.
    let origin = url;
    if (siteUrl) {
      const first = await probeHealth(url);
      if (!first.ok && isSsoRedirect(first.location)) {
        console.log('   … deployment URL is SSO-gated; probing production origin instead');
        note(`- Probed origin: ${siteUrl} (deployment URL is SSO-gated)`);
        origin = siteUrl;
      } else {
        note('- Probed origin: deployment URL');
      }
      // The loop below re-probes unconditionally: one redundant request in the
      // happy path, in exchange for not seeding its deadline accounting from
      // a probe taken outside it. Do not "deduplicate" this.
    } else {
      note('- Probed origin: deployment URL (no --site-url given)');
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
      last = await probeHealth(origin);
      if (last.ok) break;
      if (Date.now() >= healthDeadline) break;
      await sleep(interval);
    } while (Date.now() < healthDeadline);

    if (!last?.ok) {
      console.error(`✖  Deployment is READY but ${origin}/api/health never served (${last?.reason}).`);
      console.error('   The build succeeded and the site does not work. Check runtime env and egress.');
      note(`- Verdict: FAILED — READY but /api/health never served (${last?.reason}). The build succeeded and the site does not work.`);
      return await finish(1);
    }

    if (last.degraded) {
      // Deployed and serving; the database is the problem. Keeping this a warning
      // rather than a failure is the point of the 503 branch — it tells you the
      // deploy is not what broke.
      console.warn('::warning::/api/health reports 503 — the app is serving but cannot reach Supabase.');
      console.warn('::warning::This is not a deploy failure. Check the database.');
      note('- Verdict: READY, serving, database degraded (503). Not a deploy failure.');
    } else {
      console.log('✅ App is serving and can reach the database.');
      note('- Verdict: READY, serving, database reachable.');
    }
    return await finish(0);
  } catch (err) {
    // The check itself crashed. Say so loudly rather than letting a bare stack
    // trace read as a deploy verdict — and still attempt the summary, so the
    // artifact records that the check (not the deploy) is what broke.
    console.error(err?.stack ?? String(err));
    note('# Vercel deploy check — the check crashed');
    note('The check itself threw before reaching a verdict. This is a bug in the check, not evidence about the deploy.');
    return await finish(1);
  }
}

// Auto-run only when invoked directly. Importing this module from a test must
// not execute the check — the exit-code contract below is the thing CI acts on,
// so it is the thing most worth pinning with a test, and it cannot be reached
// through a module that runs on import.
const invokedDirectly = process.argv[1]?.endsWith('check-vercel-deploy.mjs');
if (invokedDirectly) {
  process.exit(await main());
}
