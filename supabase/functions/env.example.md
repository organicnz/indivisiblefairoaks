# Supabase Edge Function secrets — copy to .env.local and fill in real values.
# Deploy all secrets to production with:
#   supabase secrets set --env-file supabase/functions/.env.local \
#     --project-ref mojsubkqjdruhpxbzgme

# ── Supabase (auto-injected in hosted runtime, required for local dev) ───────
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
