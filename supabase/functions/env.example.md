# Supabase Edge Function secrets — copy to `.env.local` and fill in real values.

```bash
cp supabase/functions/env.example.md supabase/functions/.env.local
# or just edit the block below directly

supabase secrets set --env-file supabase/functions/.env.local \
  --project-ref <your-project-ref>
```

The `KEY=value` block below is machine-readable: `scripts/check-edge-secrets.mjs`
parses it and fails the pre-commit gate if a secret the code reads is missing.
Everything after the block is documentation.

---

## Platform-injected — supplied automatically by the hosted runtime

Not settable and not listed by `supabase secrets list`. Declared here so the
`supabase start` local path works.

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEYS={"default":"sb_secret_..."}
```

`SUPABASE_SERVICE_ROLE_KEY` and every value in `SUPABASE_SECRET_KEYS` bypass
RLS. Never expose them to a client. The plural variable is a JSON dictionary
keyed by key name; `ice-scan` accepts its values on the `apikey` header because
new `sb_secret_` keys are not JWTs and cannot be checked by `verify_jwt`.

---

## Operator-managed

`[required]` means the deploy pipeline fails if it is absent from the project.

### `APP_URL` [required] — set this correctly today

```
APP_URL=https://test.indivisiblefairoaks.org
```

Used for CORS `access-control-allow-origin` and the URLs WALL-E cites as
sources. The code falls back to
`https://indivisiblefairoaks.org`, which is **currently wrong**: the apex 302s to
the legacy Google Site, so every WALL-E citation and checkout return URL points
somewhere that does not serve this app. Update at cutover alongside
`NEXT_PUBLIC_SITE_URL`.

### Email — `notify-contact`, `webhook`

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=contact@indivisiblefairoaks.org
ADMIN_ORDER_EMAIL=contact@indivisiblefairoaks.org
# Optional. Marked backend verification probes go here instead of the chapter inbox.
BACKEND_VERIFY_EMAIL=tamerlanium@gmail.com
```

`RESEND_API_KEY` is required; a missing key means a silently unsent contact form.

### AI providers — `wall-e-chat`, `ice-case-brief` (all optional; both functions degrade)

At least one provider key is needed for WALL-E to answer at all. `ice-case-brief`
uses the same providers and returns a deterministic dataset note if neither is
available or if the model output fails its grounding checks.

```
ZAI_API_KEY=
GROQ_API_KEY=
WALLE_ZAI_MODEL=
WALLE_GROQ_MODEL=
ICE_ZAI_MODEL=
ICE_GROQ_MODEL=
```

### Discovery publication — `ice-scan` and the Next intake

```
# Off by default. Discovery rows are drafts; an admin must confirm rights and
# publish. When true, new rows are submitted for publication but still remain
# invisible until rights_status = confirmed.
ICE_DISCOVERY_AUTO_PUBLISH=false
```

### Rate limits and tuning — all optional, defaults live in code

```
SEARCH_RATE_LIMIT_MAX=30
SEARCH_RATE_LIMIT_WINDOW_MIN=10
SEARCH_RPC_TIMEOUT_MS=10000
WALLE_RATE_LIMIT_MAX=
WALLE_RATE_LIMIT_WINDOW_MIN=
ICE_AI_RATE_LIMIT_MAX=
ICE_AI_RATE_LIMIT_WINDOW_MIN=
ICE_REFINE_RATE_LIMIT_MAX=
ICE_REFINE_RATE_LIMIT_WINDOW_MIN=
```

### `walle-refresh` — deliberately unset

```
WALLE_REFRESH_TOKEN=
```

This is an alternate auth path (`x-walle-refresh-token` header) for a function
that already accepts `Authorization: Bearer <service-role key>` — the scheduled
workflow in `.github/workflows/walle-refresh.yml` uses the bearer form. No caller
in this repository uses the token header, so if it is set in the hosted project it
is a second way into a service-role-key function. Confirm it is unset, or
document the caller that needs it.

---

## Supabase Vault: used by pg_cron only

Edge Functions still read their credentials from environment variables at cold
start. Supabase Vault holds the values that **pg_cron / pg_net** need at run
time: the app URL, the Next.js cron bearer, the Functions base URL, and the
scan key. `scripts/seed-ice-alert-cron.mjs` upserts those rows and reads them
from `vault.decrypted_secrets` inside each scheduled command, so no secret is
stored in `cron.job.command`.

That separation is deliberate: a database-side consumer cannot read an edge
function's environment, and an edge function should not need a database round
trip just to learn a job credential.

---

## The gap this file exists to close

`supabase functions deploy` ships **code only**. The deploy workflow
(`.github/workflows/supabase.yml`) never runs `supabase secrets set`. So:

- Secrets are set **out of band**, by hand, in the Supabase dashboard.
- CI cannot see them.
- The "Verify live edge functions" job probes each function, but every probe
  fails on a validation or method check that happens **before** any secret is
  read — a missing `ZAI_API_KEY` passes verification green and breaks silently
  for users at runtime.

`supabase/functions/secrets.manifest.mjs` declares what each function needs;
`scripts/check-edge-secrets.mjs` (pre-commit) keeps that in sync with the code and
with this file. The deploy workflow asserts the `[required]` secrets are actually
present in the hosted project.

This is a **different store** from GitHub Actions secrets — see
[`../../docs/ci-secrets.md`](../../docs/ci-secrets.md) for that inventory.
