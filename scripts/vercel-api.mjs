#!/usr/bin/env node
/**
 * Minimal read-only Vercel REST client.
 *
 * ## Why the API and never the CLI
 *
 * The Vercel CLI **aborts on a CI runner** — it is not present, and it requires
 * `vercel link` state that must not exist on a runner. Both facts were learned
 * the hard way: `secrets-audit.mjs` grew an explicit REST path for exactly
 * these reasons, and `ci.yml` removed a CLI deploy job after the free-tier
 * upload API rate-limited it into permanent red.
 *
 * So every Vercel read in this repository goes through here. That is not a
 * style preference — it is the only shape that works on the fleet.
 *
 * ## Read-only, by construction
 *
 * There is no mutation path in this file and no function here that accepts a
 * method other than GET. A caller that needs to write should not reach for this
 * module: deploying is Vercel's job, triggered by git (see
 * `docs/ci-separation-plan.md`).
 *
 * ## Credentials
 *
 * `VERCEL_TOKEN` is the secret; `VERCEL_PROJECT_ID` / `VERCEL_ORG_ID` are
 * *public* identifiers and belong in the repository **variables** store, never
 * in secrets. They are declared in `scripts/ci-env.mjs` and injected by the
 * workflows. The env endpoint redacts secret-typed values, so reading it cannot
 * leak a credential even in principle.
 */

const API_BASE = 'https://api.vercel.com';

export class VercelApiError extends Error {
  // Plain property access, not a destructuring default: `status = null` with no
  // annotation infers the literal type `null`, so a caller passing
  // `{ status: 502 }` is type-errored. This is the third time that inference
  // trap appeared in this file's siblings — `checkDeploy`'s deps and
  // `check-migrations`'s `main` both had it too.
  constructor(message, options = {}) {
    super(message);
    this.name = 'VercelApiError';
    this.status = options.status ?? null;
    if (options.cause) this.cause = options.cause;
  }
}

/**
 * Read the project's environment variable *names* and types.
 *
 * Returns `{ plain, secret, unknown }`. The endpoint redacts secret-typed
 * values, so this cannot leak a credential.
 */
export async function probeEnv(projectId, teamId, token) {
  const params = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(
    `${API_BASE}/v9/projects/${encodeURIComponent(projectId)}/env${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new VercelApiError(`vercel env API ${res.status}`, { status: res.status });
  const body = await res.json();
  const out = { plain: [], secret: [], unknown: [] };
  for (const e of body.envs ?? []) {
    const t = String(e.type ?? '').toLowerCase();
    if (t === 'secret' || t === 'encrypted' || t === 'sensitive') out.secret.push(e.key);
    else if (t === 'plain') out.plain.push(e.key);
    else out.unknown.push(e.key);
  }
  return out;
}

/**
 * The log line an event carries, or `''` when it carries none.
 *
 * Two shapes exist in the wild. The documented `/v3` shape nests the output
 * under `payload.text` (`{ created, type: 'stdout', payload: { text } }`);
 * older responses carry a top-level `text`. Reading only the top level is how
 * a successful production deploy once captured 47 events and zero lines — the
 * artifact proved the request worked and the extraction did not.
 */
export function eventText(e) {
  if (typeof e?.text === 'string' && e.text !== '') return e.text;
  const nested = e?.payload?.text;
  return typeof nested === 'string' ? nested : '';
}

/** Millisecond timestamp of an event, tolerating the documented string form. */
function eventTime(e) {
  const t = typeof e?.created === 'number' ? e.created : Number(e?.created);
  return Number.isFinite(t) ? t : null;
}

/** Stable dedupe key across both event shapes. */
function eventKey(e, text) {
  return e?.id ?? e?.payload?.id ?? `${e?.created}:${text}`;
}

/**
 * Terminal deployment states — everything else means "still working".
 *
 * `BLOCKED` and `DELETED` are terminal too, and both are failure outcomes for
 * our purposes: a blocked deployment never became one.
 */
export const TERMINAL_STATES = new Set(['READY', 'ERROR', 'CANCELED', 'BLOCKED', 'DELETED']);

export const FAILURE_STATES = new Set(['ERROR', 'CANCELED', 'BLOCKED', 'DELETED']);

/**
 * Deployments for a project, newest first.
 *
 * `sha` narrows to the deployment Vercel built from a specific commit, which is
 * what lets the deploy check ask "did *this* commit ship" instead of guessing a
 * URL and polling it.
 *
 * Endpoint and parameter names are taken from Vercel's `list-deployments`
 * reference: `GET /v7/deployments` with `projectId`, `teamId` and `sha`.
 */
export async function listDeployments(projectId, teamId, token, { sha = '', limit = 20 } = {}) {
  const params = new URLSearchParams();
  params.set('projectId', projectId);
  if (teamId) params.set('teamId', teamId);
  if (sha) params.set('sha', sha);
  params.set('limit', String(limit));

  const res = await fetch(`${API_BASE}/v7/deployments?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Vercel's list endpoint is eventually consistent with the git push that
    // triggered the build; a cached response would make the poll miss the
    // deployment it is looking for.
    cache: 'no-store',
  });
  if (!res.ok)
    throw new VercelApiError(`vercel deployments API ${res.status}`, { status: res.status });
  const body = await res.json();
  const deployments = body.deployments ?? [];

  // Filter client-side too. The server-side `sha` filter is authoritative, but a
  // deployment's git source is also carried in `meta` (a Git-provider object)
  // and reporting on the wrong build would be worse than reporting nothing.
  if (sha) {
    return deployments.filter((d) => {
      const fromMeta = d?.meta?.githubCommitSha ?? d?.meta?.githubCommitSha;
      const fromGit = d?.gitSource?.sha ?? d?.gitCommitSha;
      return fromGit === sha || fromMeta === sha;
    });
  }
  return deployments;
}

/** A single deployment's detail, by id or by its canonical URL. */
export async function getDeployment(idOrUrl, teamId, token) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const res = await fetch(
    `${API_BASE}/v13/deployments/${encodeURIComponent(idOrUrl)}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );
  if (!res.ok)
    throw new VercelApiError(`vercel deployment API ${res.status}`, { status: res.status });
  return await res.json();
}

/**
 * Vercel's own account of why a deployment failed.
 *
 * `errorCode` and `errorMessage` are fields on the deployment object itself, so
 * this needs no second request and cannot fail independently of the state we
 * already read. That ordering is deliberate: the state is authoritative, the
 * message is decoration. An empty string means "Vercel gave no reason", which
 * is different from "there was no failure" — callers must not conflate them.
 */
export function failureReason(deployment) {
  if (!deployment) return '';
  const parts = [];
  if (deployment.errorCode) parts.push(`code: ${deployment.errorCode}`);
  if (deployment.errorMessage) parts.push(deployment.errorMessage);
  return parts.join(' — ');
}

/**
 * Best-effort raw build-log text, for more detail than `failureReason` gives.
 *
 * Never fatal and never load-bearing: an empty string must be read as "we could
 * not print the log", never as "no error". The `inspectorUrl` on the deployment
 * is the always-available fallback for a human.
 */
export async function getBuildLog(idOrUrl, teamId, token) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  params.set('direction', 'backward');
  params.set('limit', '200');
  try {
    const res = await fetch(
      `${API_BASE}/v2/deployments/${encodeURIComponent(idOrUrl)}/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    if (!res.ok) return '';
    const body = await res.json();
    return (Array.isArray(body) ? body : [])
      .map((e) => eventText(e))
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

/**
 * The complete build-log text for a deployment, oldest event first.
 *
 * `getBuildLog` takes the last 200 events for the failure tail the poll loop
 * prints. The artifact needs the whole thing instead, so this pages
 * `direction=forward` from the first event until a page yields nothing new.
 * A terminal deployment's log is static, so there is no live-tail race to
 * handle — "no fresh events" means drained, not "wait for more".
 *
 * Two caps bound the artifact: `maxEvents` and `maxBytes`. Either cap sets
 * `truncated: true`, which callers must surface rather than clipping silently.
 *
 * Best-effort like `getBuildLog`: a transport failure part-way returns what
 * was collected with `truncated: true` instead of throwing. Capture is
 * evidence, and evidence degrades to partial rather than aborting the verdict.
 *
 * @param {string} idOrUrl
 * @param {string} teamId
 * @param {string} token
 * @param {{ maxEvents?: number, maxBytes?: number }} [opts]
 * @returns {Promise<{ text: string, truncated: boolean, eventCount: number, lineCount: number }>}
 */
export async function getFullBuildLog(idOrUrl, teamId, token, opts = {}) {
  const maxEvents = opts.maxEvents ?? 5000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const lines = [];
  const seen = new Set();
  let bytes = 0;
  let truncated = false;
  // ms epoch of the newest event served; null reads from the start. Advanced
  // on every event whether or not it is new, so a page of retransmitted
  // events still moves the cursor and the loop below can terminate on it.
  let cursor = null;
  for (;;) {
    const params = new URLSearchParams();
    if (teamId) params.set('teamId', teamId);
    params.set('direction', 'forward');
    params.set('limit', '100');
    if (cursor !== null) params.set('since', String(cursor));
    let page;
    try {
      const res = await fetch(
        `${API_BASE}/v2/deployments/${encodeURIComponent(idOrUrl)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      if (!res.ok) {
        truncated = true;
        break;
      }
      const body = await res.json();
      page = Array.isArray(body) ? body : [];
    } catch {
      truncated = true;
      break;
    }
    let fresh = 0;
    for (const e of page) {
      const text = eventText(e);
      const t = eventTime(e);
      if (t !== null) cursor = cursor === null ? t : Math.max(cursor, t);
      const key = eventKey(e, text);
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > maxEvents) {
        truncated = true;
        break;
      }
      if (text === '') continue;
      if (bytes + text.length + 1 > maxBytes) {
        truncated = true;
        break;
      }
      lines.push(text);
      bytes += text.length + 1;
      fresh++;
    }
    if (truncated) break;
    // No new events: drained (duplicate retransmits also land here, via the
    // cursor advance above, so this cannot spin on a stuck page).
    if (fresh === 0) break;
  }
  return { text: lines.join('\n'), truncated, eventCount: seen.size, lineCount: lines.length };
}

/**
 * Resolve credentials from an environment, or `null` when incomplete.
 *
 * The parameter is annotated as a partial record for the same reason as
 * `check-migrations`' `main`: an unannotated `env = process.env` infers
 * `ProcessEnv`, which requires `NODE_ENV` and so rejects any caller passing the
 * three keys actually read — including every test. It also lets a caller supply
 * an environment without mutating the process one, which leaks across test files
 * sharing a worker.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{projectId: string, teamId: string, token: string} | null}
 */
export function credentialsFromEnv(env = process.env) {
  const { VERCEL_PROJECT_ID, VERCEL_ORG_ID, VERCEL_TOKEN } = env;
  if (!VERCEL_PROJECT_ID || !VERCEL_TOKEN) return null;
  return { projectId: VERCEL_PROJECT_ID, teamId: VERCEL_ORG_ID ?? '', token: VERCEL_TOKEN };
}