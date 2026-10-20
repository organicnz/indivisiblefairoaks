// Finishes wiring the Resend delivery-event webhook.
//
//   bun scripts/enable-resend-webhook.mjs            # dry run: report state only
//   bun scripts/enable-resend-webhook.mjs --apply    # write the Vercel secret; enable once live
//
// Order matters, and it is the reason this is a script rather than two
// dashboard clicks. The webhook was created **disabled**: an enabled webhook
// whose endpoint answers 400 or 404 is retried by Svix and then auto-disabled,
// leaving it off with nothing on screen to say why. So:
//
//   1. read the signing secret back from Resend (GET /webhooks/:id returns it,
//      so it never has to be written to a file or pasted anywhere);
//   2. upsert it into Vercel as RESEND_WEBHOOK_SECRET, type `sensitive`, for
//      production and preview — the same targets as RESEND_API_KEY;
//   3. probe the live route, and enable the webhook **only** if it answers
//      `400 Missing signature headers.` That exact body proves both that the
//      route is deployed (not 404) and that the deployment has the secret (an
//      unset secret answers `Webhook secret not configured.` first). Vercel env
//      changes apply at deploy time, so step 2 alone changes nothing live.
//
// Re-runnable: step 2 is an upsert, and step 3 is a no-op until the probe passes.
//
// The project is addressed by id, not through `.vercel/project.json`: that
// link points at a stale project in another team. The live project is the one
// serving test.indivisiblefairoaks.org, in team organicnz2222. Credentials are
// RESEND_API_KEY (webhook scope) and VERCEL_TOKEN from .env.local. Nothing
// secret is printed.


const WEBHOOK_ID = Bun.env.RESEND_WEBHOOK_ID || '736ff3a2-5703-4426-afe4-1e78627de44d';
const VERCEL_PROJECT_ID = Bun.env.VERCEL_PROJECT_ID || 'prj_8RtMjuARvtBuUnepj9oEVyovXyb5';
const VERCEL_TEAM_ID = Bun.env.VERCEL_ORG_ID || 'team_G8IMZRRSHw7ti3HLUs3aWmPS';
const TARGETS = ['production', 'preview'];
// Must match RESEND_TO_EVENT_TYPE in src/app/api/webhooks/resend/route.ts. A
// subscribed event the route does not map is acked and dropped; a mapped event
// that is not subscribed never arrives — email.suppressed was the second case.
const EVENTS = [
  'email.bounced',
  'email.complained',
  'email.suppressed',
  'email.opened',
  'email.clicked',
  'email.delivery_delayed',
];
const PROBE_OK_BODY = 'Missing signature headers.';
const APPLY = process.argv.includes('--apply');

async function readEnvLocal() {
  try {
    const out = {};
    for (const line of (await Bun.file('.env.local').text()).split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      out[m[1]] = v;
    }
    return out;
  } catch {
    return {};
  }
}

const local = await readEnvLocal();
const resendKey = Bun.env.RESEND_API_KEY || local.RESEND_API_KEY;
const vercelToken = Bun.env.VERCEL_TOKEN || local.VERCEL_TOKEN;
if (!resendKey || !vercelToken) {
  console.error('✖ RESEND_API_KEY and VERCEL_TOKEN must be set (env or .env.local).');
  process.exit(1);
}

const resend = (path, init = {}) =>
  fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
  });
const vercel = (path, init = {}) =>
  fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${VERCEL_TEAM_ID}`, {
    ...init,
    headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
  });

// ── 1. Resend: the webhook and its secret ────────────────────────────────────
const res = await resend(`/webhooks/${WEBHOOK_ID}`);
const hook = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`✖ Resend GET /webhooks/${WEBHOOK_ID}: ${res.status} ${hook.message ?? ''}`);
  process.exit(1);
}
const secret = hook.signing_secret;
if (typeof secret !== 'string' || !secret.startsWith('whsec_')) {
  console.error('✖ Resend returned no whsec_ signing secret for this webhook.');
  process.exit(1);
}
console.log(`webhook ${hook.id}: ${hook.status} → ${hook.endpoint}`);
const subscribed = new Set(hook.events ?? []);
const eventsMatch = EVENTS.length === subscribed.size && EVENTS.every((e) => subscribed.has(e));
console.log(`events: ${eventsMatch ? 'match the route' : `DRIFT — subscribed [${[...subscribed].join(', ')}]`}`);

// ── 2. Vercel: is the secret there? ──────────────────────────────────────────
const envRes = await vercel(`/v10/projects/${VERCEL_PROJECT_ID}/env`);
const envBody = await envRes.json().catch(() => ({}));
if (!envRes.ok) {
  console.error(`✖ Vercel env read: ${envRes.status} ${envBody?.error?.message ?? ''}`);
  process.exit(1);
}
const present = new Set(
  (envBody.envs ?? [])
    .filter((e) => e.key === 'RESEND_WEBHOOK_SECRET')
    .flatMap((e) => e.target ?? [])
);
const missing = TARGETS.filter((t) => !present.has(t));
console.log(
  `vercel RESEND_WEBHOOK_SECRET: ${missing.length ? `missing for ${missing.join(', ')}` : 'set for production, preview'}`
);

// ── 3. The live route ────────────────────────────────────────────────────────
async function probe() {
  try {
    const r = await fetch(hook.endpoint, { method: 'POST', signal: AbortSignal.timeout(15_000) });
    return { status: r.status, body: (await r.text()).trim() };
  } catch (err) {
    return { status: 0, body: String(err) };
  }
}
let live = await probe();
console.log(`route probe: ${live.status} ${live.body.slice(0, 60)}`);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply.');
  process.exit(0);
}

if (missing.length) {
  const w = await vercel(`/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true`, {
    method: 'POST',
    body: JSON.stringify({
      key: 'RESEND_WEBHOOK_SECRET',
      value: secret,
      type: 'sensitive',
      target: TARGETS,
      comment: `Svix signing secret of Resend webhook ${WEBHOOK_ID}. Read back by scripts/enable-resend-webhook.mjs.`,
    }),
  });
  const wb = await w.json().catch(() => ({}));
  if (!w.ok) {
    console.error(`✖ Vercel env write: ${w.status} ${wb?.error?.code ?? ''} ${wb?.error?.message ?? ''}`);
    process.exit(1);
  }
  console.log(`✓ RESEND_WEBHOOK_SECRET written (sensitive; ${TARGETS.join(', ')})`);
  live = await probe();
}

if (!eventsMatch) {
  const fix = await resend(`/webhooks/${WEBHOOK_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ events: EVENTS }),
  });
  if (!fix.ok) {
    console.error(`✖ updating webhook events failed: ${fix.status}`);
    process.exit(1);
  }
  console.log('✓ webhook events reset to the set the route handles');
}

if (hook.status === 'enabled') {
  console.log('✓ webhook already enabled');
  process.exit(0);
}
if (live.status !== 400 || live.body !== PROBE_OK_BODY) {
  console.log(
    `• webhook left disabled: the live route answers ${live.status} "${live.body.slice(0, 60)}", ` +
      `not 400 "${PROBE_OK_BODY}".\n  Deploy (the secret applies at deploy time), then re-run --apply.`
  );
  process.exit(0);
}
const upd = await resend(`/webhooks/${WEBHOOK_ID}`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'enabled' }),
});
if (!upd.ok) {
  console.error(`✖ enabling the webhook failed: ${upd.status}`);
  process.exit(1);
}
console.log('✓ webhook enabled — the deployed route has the secret.');
