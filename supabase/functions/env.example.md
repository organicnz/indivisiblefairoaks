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
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Never expose it to a client.

---

## Operator-managed

`[required]` means the deploy pipeline fails if it is absent from the project.

### `APP_URL` [required] — set this correctly today

```
APP_URL=https://test.indivisiblefairoaks.org
```

Used for CORS `access-control-allow-origin`, Stripe `success_url`/`cancel_url`,
and the URLs WALL-E cites as sources. The code falls back to
`https://indivisiblefairoaks.org`, which is **currently wrong**: the apex 302s to
the legacy Google Site, so every WALL-E citation and checkout return URL points
somewhere that does not serve this app. Update at cutover alongside
`NEXT_PUBLIC_SITE_URL`.

### Stripe — `checkout`, `webhook` [required]

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Absent → webhook signature verification is skipped, which accepts forged events.

### Email — `notify-contact`, `webhook`

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=contact@indivisiblefairoaks.org
ADMIN_ORDER_EMAIL=contact@indivisiblefairoaks.org
```

`RESEND_API_KEY` is required; a missing key means a silently unsent contact form.

### AI providers — `wall-e-chat` (all optional; the function degrades)

At least one provider key is needed for WALL-E to answer at all.

```
ZAI_API_KEY=
GROQ_API_KEY=
WALLE_ZAI_MODEL=
WALLE_GROQ_MODEL=
```

### Rate limits and tuning — all optional, defaults live in code

```
SEARCH_RATE_LIMIT_MAX=30
SEARCH_RATE_LIMIT_WINDOW_MIN=10
SEARCH_RPC_TIMEOUT_MS=10000
WALLE_RATE_LIMIT_MAX=
WALLE_RATE_LIMIT_WINDOW_MIN=
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

## Supabase Vault: not used

`vault.decrypted_secrets` is available on this project and nothing queries it —
only a commented-out `[db.vault]` block in `supabase/config.toml`.

Environment injection is the right model at this size: every consumer is an edge
function in this repository, and the values must be readable at cold start without
a database round trip. Vault earns its place when a **server-side** consumer needs
a secret — a Postgres function or a trigger, say — because a function that only
reads environment variables can never use it.

---

## The gap this file exists to close

`supabase functions deploy` ships **code only**. The deploy workflow
(`.github/workflows/supabase.yml`) never runs `supabase secrets set`. So:

- Secrets are set **out of band**, by hand, in the Supabase dashboard.
- CI cannot see them.
- The "Verify live edge functions" job probes each function, but every probe
  fails on a validation or method check that happens **before** any secret is
  read — a missing `STRIPE_SECRET_KEY` or `ZAI_API_KEY` passes verification green
  and breaks silently for users at runtime.

`supabase/functions/secrets.manifest.mjs` declares what each function needs;
`scripts/check-edge-secrets.mjs` (pre-commit) keeps that in sync with the code and
with this file. The deploy workflow asserts the `[required]` secrets are actually
present in the hosted project.

This is a **different store** from GitHub Actions secrets — see
[`../../docs/ci-secrets.md`](../../docs/ci-secrets.md) for that inventory.
