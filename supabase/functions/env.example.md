# Supabase Edge Function secrets

## How secrets reach the edge runtime

**Vercel is the primary store.** The `supabase.yml` CI workflow does:

1. `vercel env pull` — writes `SUPABASE_*`, `STRIPE_*`, and any other vars
   stored in the Vercel project to a local `.env` file.
2. A merge step appends edge-only secrets from GitHub Actions secrets
   (`RESEND_API_KEY`, `SEARCH_*`, etc.) that aren't stored in Vercel.
3. `supabase secrets set --env-file` pushes the merged file atomically.

**To rotate a secret:**
- If stored in Vercel → update in the [Vercel dashboard](https://vercel.com/indivisiblefairoaks/indivisiblefairoaks/settings/environment-variables), then re-run the `Supabase` workflow via `workflow_dispatch`.
- If stored only in GitHub Secrets → update in repo Settings → Secrets → Actions, then re-run.
- The `.env.production` file is written, used, and scrubbed within the same CI job — it is never committed.

---

## Local development

Copy this file to `supabase/functions/.env.local` and fill in real values.
The Supabase CLI reads `.env.local` automatically for `supabase functions serve`.

```sh
cp supabase/functions/env.example.md supabase/functions/.env.local
# edit .env.local with real values
supabase functions serve --env-file supabase/functions/.env.local
```

---

## Variables

```
# ── Supabase (auto-injected in the hosted runtime; required for local dev) ───
SUPABASE_URL=https://mojsubkqjdruhpxbzgme.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── Stripe (checkout + webhook functions) ────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── App origin (CORS, redirect URLs) ─────────────────────────────────────────
APP_URL=https://indivisiblefairoaks.org

# ── Email delivery (notify-contact + webhook order notification) ─────────────
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=orders@indivisiblefairoaks.org
ADMIN_ORDER_EMAIL=indivisible@indivisiblefairoaks.org

# ── Search rate-limiting (search function) ───────────────────────────────────
SEARCH_RATE_LIMIT_MAX=30
SEARCH_RATE_LIMIT_WINDOW_MIN=10
SEARCH_RPC_TIMEOUT_MS=10000

# ── WALL-E assistant (server-side only) ─────────────────────────────────────
ZAI_API_KEY=
GROQ_API_KEY=
WALLE_ZAI_MODEL=glm-4.5-flash
WALLE_GROQ_MODEL=llama-3.3-70b-versatile
WALLE_RATE_LIMIT_MAX=20
WALLE_RATE_LIMIT_WINDOW_MIN=10
```

---

## Pooler URL (local CLI only)

`supabase/.temp/pooler-url` is used by the local Supabase CLI for `db diff`
and `db remote show`. It is gitignored. Get the correct value from:

**Supabase Dashboard → Project `mojsubkqjdruhpxbzgme` → Settings → Database → Connection string → Connection pooling (Transaction mode)**

It will look like:
```
postgresql://postgres.mojsubkqjdruhpxbzgme@<aws-region>.pooler.supabase.com:6543/postgres
```

Note: pooler uses port **6543** (transaction mode), not 5432.
