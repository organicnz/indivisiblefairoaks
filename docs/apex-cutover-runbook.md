# Apex Cutover Plan — `indivisiblefairoaks.org`

**Status:** preflight review complete on 2026-11-14. **DNS has not been changed.**
The hosted Supabase auth configuration could not be verified without a management
token; see §2. All other states below were observed directly.
**Live today:** `test.indivisiblefairoaks.org` serves the new app (200); the apex
and `www` still 302 to the legacy Google Site.
**Predecessor:** [`infrastructure-and-email-recovery-log.md`](./infrastructure-and-email-recovery-log.md)

---

## 1. Verified current state

| Area | What was verified |
|---|---|
| Vercel domains | `indivisiblefairoaks.org`, `www.indivisiblefairoaks.org`, and `test.indivisiblefairoaks.org` are attached and verified. `www` is configured to redirect to the apex with status **307**. The apex is not serving the app yet. |
| Vercel environment | `NEXT_PUBLIC_SITE_URL` is one plain entry targeting **production, preview and development**; its current value is the test origin. Present in production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL` (write-only), `ADMIN_ORDER_EMAIL` (write-only), `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`. The legacy `SUPABASE_SERVICE_ROLE_KEY` is also present. |
| DNS | Cloudflare nameservers. Apex and `www` resolve to Cloudflare proxy addresses and return the observed **302** to Google Sites. `test` is a CNAME to Vercel. There are **no CAA records** on the apex or `www`. The `_vercel` TXT record currently proves only `test`. |
| Email | Resend reports both the apex and test domains verified; apex sending and receiving are enabled. SPF includes Google and Resend; Google and Resend DKIM records exist; DMARC is `p=quarantine; pct=100`. Google MX records are present. |
| Resend webhook | One webhook exists: endpoint `https://test.indivisiblefairoaks.org/api/webhooks/resend`, status **disabled**, events include bounced/complained/suppressed/opened/clicked/delivery_delayed. |
| Supabase | Local `supabase/config.toml` already has the apex `site_url` and apex/www/test redirect entries. The hosted auth URL configuration could **not** be verified from this checkout. Edge `APP_URL` is still the test origin (confirmed by CORS on `wall-e-chat` and `search`). `crm-broadcast-send` health returned `{"ready":true,"missing":[]}`. |
| Content | The six unreachable CMS rows were compared with the live pages. See [`content-row-disposition.md`](./content-row-disposition.md#2026-11-14-final-copy-review). No content rows were changed. |
| Code gate | Last recorded gate at `ba32737` was green: 3,492 unit tests, 78 e2e passed / 7 skipped, typecheck, build, peer-dependency and data-point checks. This plan changes no application code. |

`RESEND_FROM_EMAIL` and `ADMIN_ORDER_EMAIL` are sensitive Vercel values, so their
exact contents cannot be read back through the API. Only their presence is
verified. Set them explicitly during cutover rather than assuming the stored
value is the apex address.

---

## 2. Open gates — close these before touching DNS

| # | Gate | Current | Required |
|---:|---|---|---|
| 1 | Hosted Supabase auth | **Unverified** — no `SUPABASE_ACCESS_TOKEN` in this checkout | Set Site URL to the apex and allow the apex callback (plus the test/localhost rollback entries) in the hosted project. |
| 2 | Supabase edge `APP_URL` | Test origin | `https://indivisiblefairoaks.org`, then verify CORS from the apex. |
| 3 | Resend webhook | Test origin, **disabled** | Point at `https://indivisiblefairoaks.org/api/webhooks/resend`, verify `RESEND_WEBHOOK_SECRET`, then enable. |
| 4 | Vercel `NEXT_PUBLIC_SITE_URL` | Test origin for all three targets | Apex for **Production only**; test origin for **Preview** and **Development**. |
| 5 | Vercel `www` redirect | 307 | 301 (permanent). |
| 6 | Staging noindex after the env flip | Current test host is noindex because the env value is non-apex | Decide how `test` stays out of the index after Production moves to the apex. See §3. |
| 7 | Cloudflare redirect rules | Apex and `www` 302 to Google Sites | Export, then delete/replace only after the Vercel records are ready. |
| 8 | DNS records | Cloudflare proxy addresses | Vercel's exact apex and `www` records, **DNS-only** (grey cloud). |
| 9 | `RESEND_FROM_EMAIL` / `ADMIN_ORDER_EMAIL` | Presence only | Re-set Production to `contact@indivisiblefairoaks.org` (or the chapter's confirmed sender) before the redeploy. |

`CRM_BROADCAST_FUNCTION_URL` is not present in Vercel. It is optional in the
declared env contract; set it to
`https://mojsubkqjdruhpxbzgme.supabase.co/functions/v1/crm-broadcast-send` if a
chapter-wide broadcast needs to be tested from the Vercel app. It is not an apex
prerequisite.

### Not blockers

- No CAA records exist, so Vercel's certificate authority is not restricted.
- Resend's apex domain, SPF, DKIM and DMARC are already in place.
- Vercel domain ownership is already verified for the apex and `www`; do not
  re-add the domains from scratch.
- Commerce is gone. There are no Stripe keys, product pages, carts or checkout
  gates to verify. The removed-commerce paths must continue to redirect to `/`.
- The Google Site must remain available as the DNS rollback.

---

## 3. The staging-noindex problem the old plan missed

`IS_PRODUCTION_SITE` compares `NEXT_PUBLIC_SITE_URL` with the apex constant; it
does **not** inspect the request host. The test domain and the apex both point at
the same Vercel Production deployment. Therefore, when Production is changed to
the apex and a new build is made:

- the apex becomes indexable (intended);
- `test.indivisiblefairoaks.org` also becomes indexable, with apex canonicals and
  an apex sitemap (not intended).

The current runbook's instruction to "leave test noindex for one release cycle"
is false after the env flip unless one of these is done:

1. **Add a host-based noindex guard for `test` before the flip** (code + tests),
   if the staging host will remain publicly resolvable. This is the cleanest
   option if staging must stay a real rollback target.
2. **Move `test` to a Preview/custom-environment deployment** that keeps
   `NEXT_PUBLIC_SITE_URL` at the test origin, and verify the domain's deployment
   assignment before cutover.
3. **Redirect or retire `test` at cutover**, and use the previous Vercel
   deployment plus the Google Site DNS rollback instead of a public staging site.

Pick one before Step 5. Do not report that staging remains noindex merely because
it is noindex today.

---

## 4. Pre-cutover configuration (no DNS changes)

### 4.1 Vercel environment and build

`NEXT_PUBLIC_SITE_URL` is a build-time value. Changing it without a new
deployment changes nothing.

In Vercel → Project → Settings → Environment Variables:

- Set `NEXT_PUBLIC_SITE_URL` for **Production** to
  `https://indivisiblefairoaks.org`.
- Remove Production from the existing test-valued entry; leave that entry for
  **Preview** and **Development** with
  `https://test.indivisiblefairoaks.org`.
- Re-set `RESEND_FROM_EMAIL` and `ADMIN_ORDER_EMAIL` for Production to
  `contact@indivisiblefairoaks.org` (or the chapter's confirmed address). They
  are write-only, so this makes the sender explicit instead of assumed.
- Confirm the production secret names above are still present. Do not rotate
  `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, or `RESEND_WEBHOOK_SECRET` during the
  cutover unless the corresponding service is also updated.

Then redeploy the latest commit from Vercel (the normal Git-triggered build is
preferred; do not rely on a local `vercel deploy`). Verify the new build actually
picked up the apex value before changing DNS. Because of §3, the test domain may
become indexable as soon as this deployment is live; apply the chosen mitigation
at the same time.

### 4.2 Hosted Supabase auth

`supabase/config.toml` is only the local stack. The hosted project must be updated
in the Supabase dashboard (Authentication → URL Configuration) or through the
Management API with a token:

- **Site URL:** `https://indivisiblefairoaks.org`
- **Redirect URLs:** keep the exact callback paths, including at least
  - `https://indivisiblefairoaks.org/auth/callback`
  - `https://www.indivisiblefairoaks.org/auth/callback`
  - `https://test.indivisiblefairoaks.org/auth/callback` (rollback)
  - `http://localhost:3000/auth/callback` (development)
- Remove unrelated hosts such as `https://ai.foodshare.club` if they are still
  present. Do not blindly replace the whole allow-list without reading it first:
  the hosted value could not be read from this checkout.

The local `config.toml` already records the apex and the three redirect entries;
it is not proof that the hosted project matches.

### 4.3 Supabase edge `APP_URL`

Set the shared edge secret to the apex, then verify it from the apex origin:

```text
APP_URL=https://indivisiblefairoaks.org
```

`wall-e-chat` and `search` currently return the test origin in CORS. After the
secret update, their preflight must return the apex. `crm-broadcast-send` already
reports `ready: true`; re-check it after the secret change.

### 4.4 Resend webhook

1. Update the existing webhook endpoint to
   `https://indivisiblefairoaks.org/api/webhooks/resend`.
2. Confirm the signing secret in Resend matches Vercel's
   `RESEND_WEBHOOK_SECRET`.
3. Leave it disabled until the apex returns 200, then enable it and send a test
   event. A 200 from the endpoint is not enough; confirm Resend records the test
   delivery as successful.

### 4.5 `www` redirect and Cloudflare snapshot

- Change the Vercel `www` domain redirect from **307** to **301**.
- In Cloudflare, export or screenshot the current apex and `www` DNS records and
  the two 302 redirect rules before editing them. Store the exact rule JSON and
  TTLs with the rollback notes.
- The apex and `www` records are currently proxied Cloudflare A records. They
  must become Vercel's exact records with the proxy **off**. Do not copy an IP
  from this document; use the values Vercel shows for these already-verified
  domains. Keep MX and TXT records untouched.

---

## 5. Cutover sequence

Use a low-traffic window. Do not change nameservers; Cloudflare remains the DNS
provider.

1. **Confirm the new Vercel production deployment** is READY and was built with
   the apex `NEXT_PUBLIC_SITE_URL`. Confirm the §3 mitigation for `test`.
2. **Update hosted Supabase auth and edge `APP_URL`.** Auth email links may not
   work at the apex until DNS resolves; do this immediately before DNS.
3. **Update the Resend webhook endpoint** but leave it disabled until the apex is
   serving. The existing webhook is already disabled, so there is no event gap to
   preserve.
4. **Switch apex and `www` DNS to the Vercel records, DNS-only.** Remove the
   Cloudflare proxy anchors (including the `100::`-style placeholders) and the
   old A records. Do not leave a proxied record in front of Vercel for the
   cutover.
5. **Delete the two Cloudflare 302 rules** that send the apex and `www` to the
   Google Site. If the rules are evaluated before DNS, the new records will still
   appear as a 302 until these are gone.
6. **Wait for Vercel TLS and routing.** Verify the apex over HTTPS. If issuance
   fails, confirm the records are DNS-only, that no CAA was added, and that the
   Vercel domain still shows verified.
7. **Enable the Resend webhook** only after the apex endpoint returns 200.
8. **Run the verification below**, then submit the sitemap in Search Console.

Propagation is normally within the existing ~300-second TTL, but do not declare
success from a DNS answer alone. A Vercel response, a valid certificate, and the
apex canonical/robots checks are the actual gate.

---

## 6. Verification

Run against the **apex**, not `test`.

### Routing and TLS

```bash
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://indivisiblefairoaks.org/
curl -sSI https://indivisiblefairoaks.org/ | sed -n '1,20p'
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.indivisiblefairoaks.org/
```

Expected: apex **200** from Vercel with a valid certificate and HSTS; `www`
**301** to `https://indivisiblefairoaks.org/`. A 307 on `www` is a failed check.

### Indexing and canonical identity

```bash
curl -sS https://indivisiblefairoaks.org/robots.txt
curl -sS https://indivisiblefairoaks.org/sitemap.xml | grep -c '<loc>'
curl -sS https://indivisiblefairoaks.org/about \
  | grep -oE '<link rel="canonical"[^>]*>|<meta property="og:url"[^>]*>|<meta name="robots"[^>]*>'
```

Expected: `robots.txt` allows `/` and advertises the apex sitemap; the canonical,
`og:url`, sitemap and JSON-LD all use the apex; the page is `index, follow`.
The sitemap must not contain `/products/`, `/cart`, `/wishlist`, or
`/shipping-returns`. Do not use a product-count check.

If `test` remains public, its chosen mitigation must be verified too: either a
`noindex`/`Disallow` response or a redirect to the apex.

### Legacy and removed routes

```bash
for p in about-us resistance-choir voter-information upcoming-events \
         newsletters coalition-links home; do
  printf '%-22s ' "$p"
  curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
    "https://indivisiblefairoaks.org/$p"
done

for p in products cart wishlist shipping-returns success cancel; do
  printf '%-22s ' "$p"
  curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
    "https://indivisiblefairoaks.org/$p"
done
```

Expected: the legacy pages **308** to their real equivalents; the removed
commerce paths **308** to `/`. These are Next.js `permanent: true` redirects;
Google treats 308 as permanent, so do not "fix" them to 301.

### Private surfaces

```bash
for p in login search account admin auth; do
  printf '%-10s ' "$p"
  curl -sI "https://indivisiblefairoaks.org/$p" | grep -i 'x-robots-tag'
done
```

Expected: `noindex, nofollow` where the route returns a response. Do not expect
every private path to return 200; the header check is the point.

### Auth, contact and email

Use a test account and a real test message, not a synthetic status check:

1. Open `/login`, complete a magic-link or password flow, confirm the callback
   succeeds on the apex, confirm the session, then sign out.
2. Submit one contact-form message. Confirm the row in Supabase, the admin
   notification, the sender address on the apex domain, and the Resend delivery
   status.
3. Confirm the Resend webhook receives the test event and the application
   verifies its signature.
4. If a chapter-wide broadcast is in scope, confirm
   `crm-broadcast-send` health and the `CRM_BROADCAST_FUNCTION_URL` setting
   before sending. Do not send a real broadcast as a smoke test.

### Edge CORS

```bash
curl -sS -X OPTIONS \
  -H 'Origin: https://indivisiblefairoaks.org' \
  -H 'Access-Control-Request-Method: POST' \
  https://mojsubkqjdruhpxbzgme.supabase.co/functions/v1/wall-e-chat \
  -D - -o /dev/null | grep -i 'access-control-allow-origin'
```

Expected: the apex, not `https://test.indivisiblefairoaks.org`.

### Search Console

Submit `https://indivisiblefairoaks.org/sitemap.xml` after the apex is verified.
Do not claim the sitemap is processed until Search Console reports it.

---

## 7. Rollback

Before cutover, record:

- the exact Cloudflare A/AAAA/CNAME/TXT values, proxy state and TTLs;
- the two 302 redirect rules in full;
- the Vercel domain configuration (`www` status, deployment assignment);
- the current Vercel Production env values and deployment ID;
- the hosted Supabase auth URL configuration and edge `APP_URL`;
- the Resend webhook endpoint and disabled status.

| Failure | Action | Recovery |
|---|---|---|
| Bad deployment on the apex | Vercel **Instant Rollback** to the prior production deployment | ~1 minute |
| Apex app or metadata unacceptable | Restore the Cloudflare proxy records and 302 rules; the Google Site becomes the apex again | ~2–5 minutes, subject to propagation |
| DNS/SSL failure | Revert the apex/`www` records to the recorded Cloudflare values; re-proxy if needed | ~5 minutes |
| Auth redirects broken | Restore the hosted Supabase Site URL/allow-list and edge `APP_URL`; redeploy if the env changed | ~3 minutes |
| Email sender/webhook broken | Restore the previous webhook endpoint/status and `RESEND_FROM_EMAIL`; verify with a test message | ~5 minutes |
| Staging became indexable | Apply the chosen §3 mitigation, or redirect/retire `test`; restoring the test env value and rebuilding restores the old noindex behavior | ~3 minutes |

Do **not** delete the Google Site until the apex has been live for at least one
full news cycle and Search Console shows the sitemap processed. It is the
zero-cost rollback.

---

## 8. Post-cutover

1. Submit the sitemap and confirm Search Console processing.
2. Monitor Sentry, Vercel errors, 404s and Resend delivery/bounce events.
3. Keep `www` at 301 and confirm no second indexable host remains.
4. If `test` is retained, keep its chosen noindex/redirect mitigation; after one
   release cycle, remove it from the Supabase redirect allow-list and from the
   CSP / image-host allow-lists.
5. Update the content rows only after the legal-copy decisions in
   `content-row-disposition.md` are approved. No row was changed during this
   review.
6. Leave commerce out of the cutover checks. The relevant contract is the
   removed-route redirects, not Stripe, carts or product pages.

---

## 9. Known follow-ups (not blocking)

- The CSP still allows Stripe script/frame/connect hosts from the removed
  commerce implementation. Tightening it is a separate security change, not an
  apex prerequisite.
- `HSTS` includes `includeSubDomains` and `preload`. Submitting to the preload
  list pins every subdomain to HTTPS; do not submit it as part of this cutover.
- `CRM_BROADCAST_FUNCTION_URL` is absent from Vercel. Set it only if the
  broadcast feature is being used from the Vercel app.
- The hosted Supabase auth configuration remains unverified until a management
  token is available. This is the one prerequisite that could not be closed
  read-only.
