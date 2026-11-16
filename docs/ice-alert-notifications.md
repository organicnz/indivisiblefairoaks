# ICE surge alerts

`/ice-alerts` is a city-level rapid-response map. This document covers the
optional surge subscription layer. It does not change the public feed or the
historical FOIA map.

## What triggers an alert

`src/lib/ice-rapid-surges.ts` computes three signals from the community feed
only. Official ICE releases are context and never create a surge.

| Scope | Reports | Window | Extra condition |
|---|---:|---:|---|
| City | 2 | 90 min | Same city and state |
| State | 4 | 120 min | At least two cities |
| National | 8 | 60 min | At least three states |

A subscriber with no area gets national alerts. A state subscriber gets state
and national alerts. A city subscriber gets city, state, and national alerts.
Surge keys use a 15-minute bucket, and each subscriber has a 30-minute
notification cooldown. The `ice_alert_surge_events` ledger prevents the same
surge from being mailed twice.

The feed is a public community export that updates nightly. A surge is a
cluster of published reports, not proof that enforcement is happening now.

## Subscription lifecycle

1. The visitor enters an email and optionally a state, city, and phone/browser
   push permission.
2. `POST /api/ice-rapid/subscribe` stores a pending row and sends a confirmation
   email through Resend.
3. The confirmation email links to `/api/ice-rapid/confirm`. GET renders a form;
   POST confirms. This two-step form keeps mail security scanners from
   confirming subscriptions automatically.
4. Every alert email contains a one-click unsubscribe URL. GET renders a
   confirmation form; POST unsubscribes. RFC 8058 one-click POSTs receive 204.

The confirmation and unsubscribe capabilities are separate tokens. A
confirmation link carries `confirm_token`; unsubscribe links and the RFC 8058
headers carry `unsubscribe_token`. The email builder requires the unsubscribe
token rather than falling back to the confirmation token.

Confirmation tokens are single-use and expire after 24 hours. Sending a new
confirmation email rotates the row's token and expiry, and a successful POST
consumes the token by rotating it again and setting the expiry to NULL. The
confirm route updates the row only when the token still matches, so two
concurrent requests cannot both apply. Unsubscribing also rotates the token and
clears `confirmation_sent_at`, which makes every older confirmation link fail
and lets a deliberate re-subscribe send a fresh link immediately.

Existing rows have a NULL expiry and are treated as expired, so links issued
before this lifecycle existed cannot be replayed.

## Retention

`POST /api/ice-rapid/purge` requires the `CRON_SECRET` bearer token. It deletes
at most 200 rows per run from each category:

- never-confirmed, never-unsubscribed rows with no activity for 7 days
  (`updated_at`, which moves when a fresh confirmation link is issued),
- unsubscribed rows older than 30 days (`unsubscribed_at`) with no newer
  activity (`updated_at`), so a fresh re-subscribe link is not deleted.

`scripts/seed-ice-alert-cron.mjs` installs both the five-minute notify job and
a daily retention job at 04:17. Run it after applying
`supabase/migrations/20261116180000_ice_alert_subscriber_retention.sql`, which
adds `confirm_token_expires_at` and the two partial retention indexes.

```bash
bun scripts/seed-ice-alert-cron.mjs
curl -X POST https://indivisiblefairoaks.org/api/ice-rapid/purge \
  -H "Authorization: Bearer $CRON_SECRET"
```

Rows are service-role only, RLS is enabled with no policies, and the raw
community feed is never joined to an identity. Alerts contain city-level counts
and a map link only: no street addresses, names, faces, or immigration status.

## Abuse controls

The public subscribe endpoint is protected by four durable fixed-window counters
in `ice_alert_rate_limits`:

| Key | Limit per 10 minutes |
|---|---:|
| Visitor IP hash | 5 |
| Normalized email hash | 3 |
| Push endpoint host hash | 20 |
| Global endpoint cap | 120 |

The identifiers are HMAC hashes keyed by the server-only `SUPABASE_SECRET_KEY`;
the raw IP and email are not stored in this table. `POST /api/ice-rapid/subscribe`
calls the service-role-only `ice_alert_consume_rate_limits` RPC, which checks all
four counters under one advisory lock and only increments them when all four
allow the request. A 429 includes `Retry-After`.

Apply `supabase/migrations/20261116170000_ice_alert_rate_limits.sql` before
deploying this route. If the RPC is missing, the route fails closed with a 500
instead of silently accepting unlimited requests.

### Browser proof-of-work

Before posting, the public form calls `GET /api/ice-rapid/challenge`. The route
returns a signed, IP-bound challenge valid for 10 minutes. The browser finds a
nonce whose `SHA-256(challenge:nonce)` begins with 18 zero bits and submits the
challenge and nonce as `proof: { token, nonce }`. The route verifies the HMAC,
expiry, IP binding, and digest before consuming the durable counters. No
third-party CAPTCHA account or key is required.

### Request body and IP trust

`POST /api/ice-rapid/subscribe` reads the request as a stream and stops at 12 KB,
whether or not the client sent a truthful `Content-Length`. A declared oversized
body is rejected before reading; a missing or smaller declaration is still
enforced byte-by-byte while reading.

The IP used for the challenge binding and durable limit is taken from `x-real-ip`.
That is safe only because the production deployment is behind Vercel's edge,
which overwrites the header. The `x-forwarded-for` fallback uses the **last** hop,
never the caller-controlled first entry. If another proxy is placed in front of
the app, it must overwrite `x-real-ip` and strip inbound `x-forwarded-for`.
Do not expose the Next server directly; with neither header, every request shares
one `unknown` bucket.

## Environment

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contact@indivisiblefairoaks.org
CRON_SECRET=...
```

The public and private VAPID values must be a pair. Generate one pair per
deployment with:

```bash
bun -e "const w=require('web-push'); console.log(w.generateVAPIDKeys())"
```

`CRON_SECRET` authenticates the scheduler request. Resend needs
`RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`. If push keys are absent,
the phone-alert control reports that it is unconfigured; email alerts still
work.

## Scheduling

Vercel's free tier does not run sub-daily cron. Apply the migration, then store
the app URL and secret in Vault and install a five-minute `pg_cron` job:

```bash
supabase db push
bun scripts/seed-ice-alert-cron.mjs
```

`scripts/seed-ice-alert-cron.mjs` accepts `SUPABASE_DB_URL` or
`SUPABASE_ACCESS_TOKEN`; it never prints the secret. While the secret is absent,
the job is a no-op and the notify route answers 503.

To exercise the endpoint locally:

```bash
curl -X POST http://localhost:3210/api/ice-rapid/notify \
  -H "Authorization: Bearer $CRON_SECRET"
```

A run with no clusters returns `{ "surges": 0, "deliveries": 0 }`. A real send
requires the migration, a confirmed subscriber, Resend, and (for phone) VAPID
keys.

## Phone notifications

Web Push is implemented with `web-push` in
`src/lib/ice-alert-push.ts`, a service worker at
`public/ice-alert-sw.js`, and the browser helpers in
`src/components/ice-alerts/push-alerts.ts`. It works on Chromium and Firefox,
and on iOS Safari only after the site is installed to the Home Screen. Push
subscriptions are stored on the subscriber row and removed when a push service
returns 404/410.

## Checks

```bash
bun --bun vitest run src/lib/__tests__/ice-rapid-surges.test.ts
bun run typecheck
bun run build
```
