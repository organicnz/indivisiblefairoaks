# Indivisible Fair Oaks-Carmichael — Infrastructure, DNS & Email Recovery Report

**Date**: September 23, 2026  
**Domain**: `indivisiblefairoaks.org`  
**Status**: All services operational (Next.js test environment live, Google Sites restored, Google Workspace Gmail restored). **Outstanding: Google Workspace DKIM is unpublished on the apex — see §8.**

---

## Executive Summary

During September 22–23, 2026, major infrastructure updates were conducted to:
1. Isolate the new Next.js 16 web application on a dedicated staging subdomain (`test.indivisiblefairoaks.org`).
2. Restore the production apex domain (`indivisiblefairoaks.org`) and `www` subdomain to the organization's active Google Site.
3. Diagnose and resolve a critical Google Workspace email outage caused by an errant AWS SES MX record.
4. Verify global DNS propagation across top public resolvers (Google, Cloudflare, Quad9, OpenDNS).
5. Investigate email traceability and recovery options for inbound messages sent during the MX downtime window.

---

## 1. Subdomain Isolation: New Web Application (`test.indivisiblefairoaks.org`)

### Objective
Deploy the new modern Next.js 16 web application (built with Supabase SSR and Tailwind CSS) to a test environment without disrupting the organization's existing public website or domain assets.

### Actions Taken
1. **Codebase & Type Audit**:
   - Fixed a TypeScript compilation error in `src/components/layout/AccountButton.tsx` (explicit type import: `import type { User } from '@supabase/supabase-js'`).
   - Verified automated unit tests (`npm test`) and type checking (`npm run type-check`), passing 100% with zero warnings.
2. **Vercel Production Deployment**:
   - Deployed the latest build to Vercel production.
   - Assigned the custom domain `test.indivisiblefairoaks.org` in Vercel project settings.
3. **Cloudflare DNS Configuration**:
   - Added CNAME record:
     - **Name**: `test`
     - **Target**: `cname.vercel-dns.com`
     - **Proxy status**: `DNS-only` (grey cloud) to permit Vercel's automated Let's Encrypt / ACME challenge and SSL certificate provisioning.
4. **Verification**:
   - Vercel issued SSL certificate (`cert_ocSl57Dquh8RTOC10rkesEvw`).
   - Verified HTTP/2 200 response directly from edge locations:
     ```bash
     curl -Iv https://test.indivisiblefairoaks.org
     ```
   - Confirmed full functionality and propagation.

---

## 2. Google Sites Production Restoration (`indivisiblefairoaks.org` & `www`)

### Objective
Ensure visitors to `indivisiblefairoaks.org` and `www.indivisiblefairoaks.org` seamlessly load the live Google Site:
`https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks`

### Actions Taken
1. **Cloudflare DNS Placeholders**:
   - Configured Proxied (orange cloud) A/AAAA dummy anchor records (`192.0.2.1` / `100::`) on Cloudflare for both `@` (apex) and `www`.
   - This routes HTTP/HTTPS requests through the Cloudflare edge network, terminating SSL with Cloudflare's Universal SSL certificate.
2. **Cloudflare Edge Redirect Rules**:
   - Configured redirect rules to route all inbound traffic to the Google Site URL:
     - `https://indivisiblefairoaks.org/*` → 302 Redirect → `https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks`
     - `https://www.indivisiblefairoaks.org/*` → 302 Redirect → `https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks`
3. **Verification**:
   - Both HTTP and HTTPS queries return clean redirects to the Google Site with zero SSL/TLS certificate warnings.

---

## 3. Google Workspace Gmail Restoration (MX & SPF Records)

### Incident Root Cause
Inbound emails to `@indivisiblefairoaks.org` stopped delivering because the domain's primary MX record had been pointed to AWS Simple Email Service (SES):
`10 inbound-smtp.us-east-1.amazonaws.com`
This routed all incoming internet mail away from Google Workspace into AWS, where no receipt rules or storage pipelines existed.

### Actions Taken
1. **Cloudflare Zone Identification**:
   - Cloudflare Zone Name: `indivisiblefairoaks.org`
   - Zone ID: `71ef77fe00dfafb4fa2864da8748ed81`
2. **Removed Outdated Records**:
   - Deleted the AWS SES MX record (`inbound-smtp.us-east-1.amazonaws.com`).
3. **Added Authoritative Google Workspace MX Records (Canonical 5-Record Standard)**:
   - Priority `1` : `aspmx.l.google.com`
   - Priority `5` : `alt1.aspmx.l.google.com`
   - Priority `5` : `alt2.aspmx.l.google.com`
   - Priority `10`: `alt3.aspmx.l.google.com`
   - Priority `10`: `alt4.aspmx.l.google.com`
   *(Redundant `smtp.google.com` was purged to strictly adhere to Google's official canonical priority hierarchy).*
4. **Configured SPF Record**:
   - Created TXT record on `@`:
     `v=spf1 include:_spf.google.com ~all`
5. **Propagation Verification**:
   - Queried major global DNS resolvers:
     - Google DNS (`8.8.8.8`): Confirmed Google MX and SPF.
     - Cloudflare DNS (`1.1.1.1`): Confirmed Google MX and SPF.
     - Quad9 (`9.9.9.9`): Confirmed Google MX and SPF.
     - OpenDNS (`208.67.222.222`): Confirmed Google MX and SPF.
   - User confirmed live incoming mail to Gmail resumed successfully.

---

## 4. Missing Email Traceability & Recovery Analysis

### Context
Between approximately **September 21, 2026, 04:45 UTC** and **September 23, 2026, 19:35 UTC** (~48 hours), external email servers sent messages to `inbound-smtp.us-east-1.amazonaws.com`.

### Forensic Findings
1. **AWS SES Receipt Pipeline**:
   - Queried AWS SES via AWS CLI (`aws ses list-receipt-rule-sets`, `aws ses list-identities`, `aws sesv2 list-email-identities`).
   - Finding: AWS SES had **zero active receipt rule sets**, zero verified email identities, and zero S3 buckets configured for email archiving in this account.
   - Result: AWS SES did not store or hold the body of any inbound emails.

2. **What Happened to Incoming Emails During the 48-Hour Downtime**:
   Depending on the sender's mail transfer agent (MTA), messages fall into two categories:

   | Category | Mechanism | Outcome | Action Required |
   |---|---|---|---|
   | **Delayed / Queued Retries** | Standard enterprise MTAs (Microsoft 365, Google Workspace, SendGrid, Postfix) queue failed deliveries for **48 to 72 hours** with exponential backoff. | As sending servers re-query DNS and discover the restored Google MX records, queued emails are **automatically delivered directly into Gmail inboxes**. | Monitor inboxes over the next 12–24 hours as backlogged queues flush. |
   | **Hard Bounces (5xx NDR)** | Senders whose servers received a permanent 550 error generated an immediate Non-Delivery Report (NDR) back to the sender's own inbox. | Google's servers never received these messages, so they cannot be retrieved from Google or AWS. | Senders received a formal bounce notice and know to resend upon contact. |

3. **Google Admin Email Log Search (ELS)**:
   - Direct Link: `https://admin.google.com/ac/emaillogsearch`
   - Navigation: Google Admin Console → Menu (☰) → **Reporting** → **Email Log Search**.
   - Note on Log Data: ELS records **metadata only** (sender, recipient, subject, timestamp, delivery status). It does not store email bodies for privacy/security reasons; messages cannot be replayed directly from the log interface.

4. **Recommended Recovery Workflow**:
   - Obtain the exported email log CSV from the administrator/user.
   - Parse the CSV to extract:
     1. Unique sender email addresses.
     2. Exact timestamps.
     3. Subject lines.
     4. Delivery error/bounce status.
   - Generate a concise follow-up contact list to notify affected senders that mail service is restored and request re-sending of missed communications.

---

## 5. Active DNS Records Reference

Verified against the Cloudflare API on 2026-09-25 (zone `71ef77fe00dfafb4fa2864da8748ed81`, account `organicnz`, 20 records). This is a snapshot; re-query rather than trusting it if drift is suspected.

| Type | Name | Content / Target | Proxy | Notes |
|---|---|---|---|---|
| `CNAME` | `test` | `e95178ae6acfb942.vercel-dns-017.com` | DNS-Only | Next.js 16 staging on Vercel |
| `TXT` | `_vercel` | `vc-domain-verify=test.indivisiblefairoaks.org` | DNS-Only | Vercel domain ownership proof |
| `AAAA` | `@` | `100::` | **Proxied** | Cloudflare edge anchor → Google Site (Cloudflare supplies the IPv4 edge A record) |
| `AAAA` | `www` | `100::` | **Proxied** | Cloudflare edge anchor → Google Site (as above) |
| `MX` | `@` | `aspmx.l.google.com` (1), `alt1` (5), `alt2` (5), `alt3` (10), `alt4` (10) | DNS-Only | Google Workspace inbound |
| `TXT` | `@` | `v=spf1 include:_spf.google.com ~all` | DNS-Only | **Google only** — does not authorize Resend, see §8 |
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:tamerlanium@gmail.com; sp=none; aspf=r` | DNS-Only | Monitoring only, no enforcement |
| `TXT` | `@` | `resend-domain-verification=273cfe2f…` | DNS-Only | Resend apex ownership proof |
| `TXT` | `resend._domainkey` | `p=MIGfMA0GCSq…` | DNS-Only | Resend DKIM — apex sending depends on this |
| `TXT` | `resend._domainkey.test` | `p=MIGfMA0GCSq…` | DNS-Only | Resend DKIM — staging |
| `CNAME` | `send` | `send.forge.rmta.net` | DNS-Only | Resend SPF/bounce scheme (apex) |
| `CNAME` | `rsend` | `rsend.forge.rmta.net` | DNS-Only | Resend mail CNAME (apex) |
| `CNAME` | `tracking` | `links2.resend-dns.com` | DNS-Only | Resend click/open tracking |
| `MX` | `send.test` | `feedback-smtp.us-east-1.amazonses.com` (10) | DNS-Only | Resend bounce handling (staging) |
| `TXT` | `send.test` | `v=spf1 include:amazonses.com ~all` | DNS-Only | Resend SPF (staging) |
| `CNAME` | `rsend.test` | `send.forge.rmta.net` | DNS-Only | Resend mail CNAME (staging) |
| `TXT` | `google._domainkey` | **MISSING** | — | **Google Workspace DKIM for apex — see §8** |

### Drift Found During This Audit
Two prior assumptions in this document were wrong. Both are recorded here so the next operator does not act on them:

1. **There is no `A` record for `@` or `www`, and no `www` CNAME.** Earlier revisions listed `192.0.2.1` and `www → indivisiblefairoaks.org`. Neither exists. **This is not a fault**: for proxied hostnames Cloudflare provisions its own dual-stack edge addresses, so the zone answers with `104.21.32.95` / `172.67.150.172` over IPv4 and `100::` over IPv6. Confirmed working — both hosts return `302` to the Google Site over forced IPv4. The §2 "operational" claim holds.
2. **The apex uses Resend's modern CNAME record scheme, not the `send.` MX+TXT pair.** Apex `send`/`rsend` are `CNAME` to `send.forge.rmta.net`; only the staging subdomain `send.test` carries the MX + `include:amazonses.com` pattern. The apex is therefore already complete for Resend and should **not** have `send.` MX/TXT records added to it.



---

## 6. Environment Variables Configuration

| Variable | Environment(s) | Value | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Production, Preview, Development | `https://test.indivisiblefairoaks.org` | Ensures auth callbacks, sitemaps, and robots point to staging |
| `RESEND_FROM_EMAIL` | Production, Preview, Development | `contact@test.indivisiblefairoaks.org` | Resend verified sender address for test subdomain |
| `CLOUDFLARE_ZONE_ID` | Production, Preview, Development | `71ef77fe00dfafb4fa2864da8748ed81` | Real active zone ID in Cloudflare |
| `RESEND_API_KEY` | Production, Preview, Development | `re_G3mBcMkv...` | Authenticates Resend email dispatch |

---

## 7. Next Steps & Recommendations
1. **Email Log CSV Ingestion**: Once Christiana provides the exported log file, parse it to extract the affected sender list.
2. **Google Workspace DKIM (blocking — see §8)**: Generate the DKIM key in Google Admin Console (`Apps` → `Google Workspace` → `Gmail` → `Authenticate email` → *Start authentication*) and publish the returned value as a `TXT` record at `google._domainkey.indivisiblefairoaks.org`, DNS-only. Confirm the Admin console reports **Authenticate email: verified**.
3. **DMARC Enforcement**: After a clean reporting window, ramp `_dmarc` from `p=none` to `p=quarantine`, then `p=reject`. Hold `adkim=r` and `aspf=r` (strict alignment) throughout.
4. **DMARC Reporting Address**: `rua=mailto:tamerlanium@gmail.com` points at a personal mailbox. Move to a role address on the domain so reports outlive any one person.
5. **Apex SPF vs. Resend (see §8)**: Decide whether the apex will keep sending application mail. Current SPF authorizes Google only, so Resend-sent mail soft-fails SPF and relies on DKIM alignment alone.
6. **Staging Review**: Review `test.indivisiblefairoaks.org` with the stakeholder team prior to any future production cutovers.

---

## 8. DKIM Failures in DMARC Aggregate Report — Diagnosis (September 24, 2026)

### Report Summary
A Google DMARC aggregate report (`report_id` 1368680657850673824, window 2026-09-24 00:00–23:59 UTC) reported **5 messages** across two source IPs, all `spf=pass dkim=fail`.

| Source IP | rDNS | Count | DKIM |
|---|---|---|---|
| 209.85.220.41 | `mail-sor-f41.google.com` | 3 | fail (selector `google`) |
| 209.85.220.69 | `mail-sor-f69.google.com` | 2 | fail (selector `google`) |

Published policy: `adkim=r`, `aspf=r`, `pct=100`, `p=none`, `sp=none`.

### Diagnosis
This is **not spoofing and not an application fault**.

1. Both source IPs are Google LLC infrastructure, and both fall inside `209.85.128.0/17`, which `include:_spf.google.com` authorizes. Hence `spf=pass`.
2. Live DNS confirms **`google._domainkey.indivisiblefairoaks.org` is NXDOMAIN**. The only DKIM key published on the apex is `resend._domainkey`.
3. Google Workspace therefore signed with its fallback `s=google` selector, and with no public key at that selector, receivers cannot validate the signature — hence `dkim=fail`.

The failing mail is outbound from the organization domain via Google Workspace: a Gmail "Send mail as" alias, a Google Group, or a forwarded/rewritten message. The most likely cause is that DKIM was never enabled, or the `google._domainkey` record was lost during the September 22–23 MX restore documented in §3.

### Verification Commands
```bash
dig +short indivisiblefairoaks.org            TXT   # SPF — Google only
dig +short _dmarc.indivisiblefairoaks.org     TXT   # DMARC — p=none
dig +short google._domainkey.indivisiblefairoaks.org TXT   # NXDOMAIN = the defect
dig +short resend._domainkey.indivisiblefairoaks.org TXT   # present, Resend DKIM
dig +short -x 209.85.220.41                   # mail-sor-f41.google.com
```

### Remediation
1. Google Admin → Apps → Google Workspace → Gmail → **Authenticate email** → *Start authentication*. Copy the generated `google._domainkey` TXT value.
2. Publish it in Cloudflare as a **TXT** record for `google._domainkey.indivisiblefairoaks.org`, **DNS-only** (no proxy).
3. Wait for the Admin console to report **verified** (typically minutes; up to 24h for full resolver propagation).
4. Identify the sending path: Admin → Reporting → Email Log Search filtered on the source IPs, or "Show original" on a failing message.
5. Re-check the next aggregate report for `dkim=pass` before tightening DMARC.

### Related Finding — Apex SPF Does Not Authorize Resend
The application sends from `contact@indivisiblefairoaks.org` (see `src/lib/email.ts`, `supabase/functions/_shared/email.ts`, `.env.example`), but the apex SPF authorizes Google only. Application mail consequently soft-fails SPF and passes DMARC **solely** through Resend's `resend._domainkey` DKIM alignment. That alignment is valid, but it is a single point of failure — any Resend key rotation or selector change breaks DMARC outright.

**Do not** add `include:_spf.resend.com`: that hostname is now NXDOMAIN, and an unresolvable `include` makes the whole SPF record a `permerror`. The apex is already complete for Resend under its modern CNAME scheme (`send`/`rsend` → `send.forge.rmta.net`, plus a `tracking` CNAME), which covers bounce handling and tracking but **cannot** authorize apex sending — a CNAME at `send.` does not redirect an apex `TXT` SPF record. Resolving apex SPF therefore requires either a deliberate inclusion authorized for this account, or moving application sends to the verified `test.` subdomain. Treat as a decision, not a mechanical fix.

