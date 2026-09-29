# Apex Cutover Runbook — `indivisiblefairoaks.org`

**Status**: ready to execute. The application side is complete; two DNS/console
steps and one env change remain.
**Predecessor**: [`infrastructure-and-email-recovery-log.md`](./infrastructure-and-email-recovery-log.md)

---

## What changed, and why the cutover is now mechanical

The app previously hardcoded `https://indivisiblefairoaks.org` in some places
and read `NEXT_PUBLIC_SITE_URL` in others. That split is what made the move
risky: canonical URLs, `og:url`, `sitemap.xml` and `robots.txt` each derived the
host independently, and the staging site was advertising apex canonicals that
resolved to a Google Sites redirect.

All site identity now derives from one module, `src/config/site.ts`:

| Consumer | Source |
|---|---|
| `metadataBase`, canonicals, `og:url`, `twitter` | `src/lib/metadata.ts` → `pageMetadata()` |
| `robots.txt` | `src/app/robots.ts` → `IS_PRODUCTION_SITE` |
| `sitemap.xml` | `src/app/sitemap.ts` → `siteUrl()` |
| JSON-LD (`@id`, `url`, `logo`) | `src/config/site.ts` |
| Auth redirect allowlist | `supabase/config.toml` |

**Consequence: the cutover is one environment variable.** Set
`NEXT_PUBLIC_SITE_URL=https://indivisiblefairoaks.org` in Vercel Production,
redeploy, and every one of the above follows. No code change, and no way for them
to disagree.

### The staging noindex guard

`IS_PRODUCTION_SITE` compares the configured origin against
`PRODUCTION_SITE_URL`. When they differ — preview deployments, and staging while
the apex is still a redirect — the build emits `noindex, nofollow` everywhere and
`robots.txt` returns `Disallow: /`.

This is deliberate. While the apex is owned by the Google Site, having
`test.indivisiblefairoaks.org` fully indexable lets it compete with the apex for
the same queries. It flips automatically at cutover.

---

## Pre-flight checklist

| # | Check | Command / where | Expected |
|---|---|---|---|
| 1 | Delivery gates green | `bun run lint:check && bun tsc --noEmit && bun run test` | 0 errors |
| 2 | Production build | `bun run build` | exit 0 |
| 3 | Coverage ≥ 90% | `bun run test:coverage` | 4/4 metrics |
| 4 | Supabase auth URLs | Dashboard → Authentication → URL Configuration | apex in **both** Site URL and Redirect URLs |
| 5 | `supabase/config.toml` | repo | apex first in `site_url` ✅ done |
| 6 | Stripe live keys | Vercel Production env | present |
| 7 | Resend domain verified | Resend dashboard | apex DKIM `resend._domainkey` published (see log §5) |

> `supabase/config.toml` only governs the **local** Supabase CLI stack. The hosted
> project's allowlist lives in the dashboard and must be changed there too — a
> mismatch there is the single most likely cause of "redirect URL not allowed"
> after cutover.

---

## Execution

### Step 1 — Vercel domain

Add the apex to the Vercel project:

```
vercel domains add indivisiblefairoaks.org
```

Verify the challenge completes **before** touching DNS. Vercel must have issued a
certificate for the apex, or the first request will fail TLS.

### Step 2 — www handling

`www` should 301 to the apex. Prefer a platform-level redirect over app code so
it happens before any function runs:

- **Vercel:** add `www` as a domain, then a domain-level redirect to the apex.
- **Cloudflare:** a redirect rule (the current 302-to-Google-Site rules must be
  replaced, not added to).

Do **not** let both hosts serve 200s. Two indexable hosts serving identical
content splits link equity and confuses canonical signals.

### Step 3 — Environment

```bash
vercel env rm NEXT_PUBLIC_SITE_URL production
vercel env add NEXT_PUBLIC_SITE_URL production https://indivisiblefairoaks.org
```

Also confirm in Production:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://indivisiblefairoaks.org` |
| `RESEND_FROM_EMAIL` | `contact@indivisiblefairoaks.org` — **see §8 of the recovery log** |
| `ADMIN_ORDER_EMAIL` | `contact@indivisiblefairoaks.org` |

### Step 4 — Deploy

```bash
bun run build && vercel deploy --prod
```

### Step 5 — DNS

Replace the Cloudflare apex `AAAA 100::` placeholder anchor with the Vercel
record. Keep proxy **DNS-only** so ACME validation can complete.

### Step 6 — Remove the Google Site redirect

Delete the Cloudflare 302 rules for `@` and `www`. Until this is done the apex
still points at the Google Site and the new deployment is unreachable.

---

## Verification

Run against the **apex**, not staging:

```bash
HOST=https://indivisiblefairoaks.org

# 1. Canonical and og:url agree and are self-referential
curl -s $HOST/about | grep -oE '<link rel="canonical"[^>]*>|<meta property="og:url"[^>]*>'

# 2. Robots is indexable (was noindex while staging)
curl -s $HOST/robots.txt

# 3. Sitemap advertises the apex and includes the product catalog
curl -s $HOST/sitemap.xml | grep -c '<loc>'
curl -s $HOST/sitemap.xml | grep -c '/products/'

# 4. Every route has a social card
curl -s $HOST/ | grep -o 'og:image[^>]*'

# 5. Legacy URLs 301 to their replacements
for p in about-us resistance-choir voter-information upcoming-events \
         newsletters coalition-links home; do
  printf '%-22s ' "$p"; curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$HOST/$p"
done

# 6. Private surfaces are noindex
for p in cart login wishlist account admin; do
  printf '%-10s ' "$p"; curl -sI $HOST/$p | grep -i 'x-robots-tag'
done

# 7. Fingerprinting header is gone
curl -sI $HOST/ | grep -i x-powered-by   # expect no output
```

Note: Next emits **308** for `redirects()` with `permanent: true`. Google treats
308 identically to 301 for canonicalisation; do not "fix" it to 301.

---

## Post-cutover

1. Submit `https://indivisiblefairoaks.org/sitemap.xml` in Google Search Console.
2. Verify the Organization rich result renders (the `NGO` node in the root layout).
3. Publish Google Workspace DKIM at `google._domainkey` — still outstanding, see
   recovery log §8. Outbound Google mail currently fails DMARC.
4. Leave `test.indivisiblefairoaks.org` deployed but noindex for at least one
   release cycle as a rollback target.
5. Once comfortable, decommission staging and drop its entries from
   `additional_redirect_urls` and the CSP / `remotePatterns` allowlists.

---

## Rollback

The cutover is reversible because the app never hardcodes the host.

| Failure | Action | Time to recover |
|---|---|---|
| Bad deploy on apex | `vercel rollback` | ~1 min |
| App unacceptable | Restore the Cloudflare 302 → Google Site rules | ~2 min (propagation) |
| DNS/SSL problem | Revert the apex record to the Cloudflare anchor | ~5 min |
| Bad metadata (wrong canonicals) | Set `NEXT_PUBLIC_SITE_URL` back to staging, redeploy | ~3 min |

**Do not** delete the Google Site until the new apex has been live for at least
one full news cycle and Search Console shows the sitemaps processed. The Google
Site is the only zero-cost rollback.

---

## Known follow-ups (not blocking)

- **Apex SPF does not authorise Resend.** Application mail passes DMARC on
  Resend DKIM alignment alone — a single point of failure. Recovery log §8.
  `_spf.resend.com` is NXDOMAIN, so do **not** add that include; resolving this
  needs a decision, not a mechanical edit.
- **Apex `google._domainkey` is unpublished**, so every outbound Workspace
  message fails DKIM.
- **Shipping rates are placeholders** carried over from the previous site's New
  Zealand tariff. See the note in `src/config/commerce.ts` — a business decision.
- **`HSTS preload`** is set with `includeSubDomains`. Submitting to the preload
  list pins every subdomain to HTTPS for ~12 months, including staging.
