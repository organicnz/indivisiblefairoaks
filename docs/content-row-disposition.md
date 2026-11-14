# Unreachable content: row dispositions

> Snapshot: the read-only archive exported on 2026-11-08
> (`tmp/content-archive-2026-11-08.json`). All 14 rows are
> `status = 'publish'`; none has a revision. **No rows have been changed.**
> This table is a recommendation for the content owner, not authorization to
> delete anything.
>
> **2026-11-14:** the six review rows were read against the live `/`, `/about`,
> `/faqs`, `/privacy-policy` and `/terms-and-conditions` pages. The final copy
> findings are in [Final copy review](#2026-11-14-final-copy-review). Still no
> rows changed.

The admin list marks these rows **Unreachable** and the **Hide unreachable**
filter shows how many matching rows it hides. Only `copy-home-hero` is live;
the other 14 rows cannot be reached at their own slug because a legacy redirect
or a coded App Router page wins.

## Decision key

- **Archive** — superseded by the live page; no reusable copy found.
- **Review** — the row may contain a sentence, policy, or answer that is not on
  the live page. A person must read it before deciding.

Archiving means `content.metadata.archived = true` (or deleting only with
explicit approval). Do **not** set `status = 'draft'` as an archive: drafts keep
publish semantics and stay in the admin list.

## Preview

`bun run content:archive:preview` reads the current rows and prints the
candidates, the review rows, and any unclassified row. It is read-only and has
no apply path; the six review rows cannot be included by the preview.

## Disposition table

`Body chars` is the archived `content.body` length, not visible text. Every
destination below was checked against `src/config/legacy-redirects.ts`, `ROUTES`,
and the App Router files on 2026-11-08.

| ID | Slug | Type | Body chars | Destination | Unreachable because | Recommended |
|---:|---|---|---:|---|---|---|
| 1 | `home` | page | 2,252 | `/` | Legacy redirect | **Review** — mission statement and contact details are buried in old Google Sites chrome. |
| 2 | `about-us` | page | 182 | `/about` | Legacy redirect | **Review** — short, clear blurb; compare one sentence with `/about` before archiving. |
| 3 | `upcoming-events` | event | 5,256 | `/events` | Legacy redirect | **Archive** — old event listings; `/events` has its own programme. |
| 4 | `good-trouble` | event | 798 | `/news` | Legacy redirect | **Archive** — old campaign page; no current event. |
| 5 | `weekend-of-protest-song` | event | 760 | `/choir` | Legacy redirect | **Archive** — old event page; `/choir` is the live surface. |
| 6 | `upcoming-fall-events` | event | 2,618 | `/events` | Legacy redirect | **Archive** — duplicate of the old events import. |
| 7 | `resistance-choir` | page | 1,497 | `/choir` | Legacy redirect | **Archive** — old choir page; `/choir` is live. |
| 8 | `voter-information` | page | 1,122 | `/voter-info` | Legacy redirect | **Archive** — old voter page; `/voter-info` is live. |
| 9 | `newsletters` | post | 784 | `/news` | Legacy redirect | **Archive** — old newsletter index; `/news` is live. |
| 10 | `coalition-links` | page | 1,521 | `/links` | Legacy redirect | **Archive** — old links page; only shared organisation names overlap. |
| 11 | `privacy-policy` | page | 1,242 | `/privacy-policy` | Reserved route | **Review** — legal copy; compare data, email, ActBlue/Stripe, and contact clauses. |
| 12 | `terms-and-conditions` | page | 1,092 | `/terms-and-conditions` | Reserved route | **Review** — legal copy; gear/price terms may be obsolete since commerce was removed. |
| 13 | `shipping-returns` | page | 846 | `/shipping-returns` → `/` | Reserved route plus removed-commerce redirect; no page of its own | **Review** — only copy of pickup, shipping, and damaged-item terms. |
| 14 | `faqs` | page | 1,065 | `/faqs` | Reserved route | **Review** — meeting, choir, and donation answers; transfer any that are missing from the live FAQ. |

## Review notes

### `home`

After the repeated Google Sites navigation, the body contains the chapter's
mission statement, a contact address, and a mailing-list address. The mission
statement is the one durable piece; the rest is navigation chrome. Preserve the
mission sentence on `/` or `/about` if it is not already there, then archive the
row.

### `about-us`

This is only 182 characters, but it is a clean, standalone description of the
chapter. Compare it with `/about`; if the live page already says the same thing
in different words, archive it. It is not a reason to keep the whole row.

### `faqs`

The archived answers cover the monthly meeting time and location, hybrid Zoom,
the choir's no-audition policy, and the tax-deductibility of donations. The live
`/faqs` page was rewritten, so check each answer rather than assuming the live
page is complete. Move only missing answers; do not reuse the shadowed slug.

### `shipping-returns`

This is the only copy of the chapter's pickup, USPS shipping, and
damaged/incorrect-item terms. Commerce has been removed and `/shipping-returns`
now redirects to `/`, so the text has no live home. Decide whether the chapter
still needs the policy at all. If it does, it needs a real page or a policy
section elsewhere; if not, archive it.

### `privacy-policy` and `terms-and-conditions`

Both coded pages exist and were rewritten. The archived rows still contain
specific operational language: what data is collected, how email is used, which
payment processors are named, how gear proceeds are described, the non-violence
commitment, and the photo/copyright terms. This is legal copy, so a person — not
an overlap score — should confirm the live pages cover anything the chapter still
needs to promise.

## 2026-11-14 final copy review

The six review rows were fetched read-only and compared with the live pages on
`test.indivisiblefairoaks.org`. The live pages are the current coded routes; the
archived rows are still unreachable shadow copies. No content row was edited.

| Row | What the live page already covers | Final disposition |
|---|---|---|
| `home` | The mission sentence is present **verbatim** on `/`; `contact@` and `subscribe@` are in the live footer. The rest is Google Sites navigation, a September 1 event and the old Good Trouble listing. | **Archive.** No copy migration. |
| `about-us` | `/about` has an equivalent, newer description ("local grassroots chapter representing residents in and near Fair Oaks and Carmichael…"). The old 182-character blurb contains no unique fact. | **Archive.** Optionally reuse the old phrasing if the chapter prefers it, but there is no content gap. |
| `faqs` | `/faqs` has all four archived answers, with the same first-Tuesday 6:30–8:00 PM meeting, St. Michael's address, hybrid Zoom, no-audition choir policy and non-tax-deductible contribution policy. | **Archive.** No copy migration. |
| `privacy-policy` | The live policy covers data collection, cookies, embedded content, retention and security, but it omits the archived email-communications promise, the ActBlue third-party reference, and the unsubscribe/contact route. | **Preserve three clauses** in the live policy: (1) email is used only for chapter updates and is never sold, rented or shared; (2) ActBlue is the contribution processor; (3) contact/unsubscribe via `contact@indivisiblefairoaks.org`. The archived Stripe reference is obsolete and must not be copied. |
| `terms-and-conditions` | The live terms cover the grassroots/non-violence commitment and non-tax-deductible ActBlue contributions. The archived photo/copyright permission (community photos and protest art may be shared for non-commercial, civic or educational use with attribution) is absent. | **Preserve the photo/copyright/attribution clause** if it is still chapter policy. Discard the archived gear prices, shipping and order terms; commerce was removed. |
| `shipping-returns` | The only copy of the pickup, USPS shipping and damaged/incorrect-item terms. `/shipping-returns` now redirects to `/`; there is no live page. | **Content-owner decision.** Archive if the chapter no longer ships or distributes gear. If it still hands out yard signs/songbooks at meetings, preserve only the community-pickup and damaged-item paragraphs in a real page or FAQ; do not publish the old USPS/commerce terms. |

### What this means for archiving

- Safe to archive now: `home`, `about-us`, `faqs`.
- Do not archive until the live legal copy is updated (or the owner explicitly
  accepts the gap): `privacy-policy`, `terms-and-conditions`.
- Do not archive until the chapter decides whether it still distributes gear:
  `shipping-returns`.
- The archived rows are not authorization to rewrite the live pages. The two
  legal edits should be made through the normal content workflow and reviewed
  by the chapter.

## What not to do

- Do not rename a shadowed row to make it reachable. That publishes old copy at
  a new URL, which is the opposite of the fix.
- Do not delete a row before the content owner signs off. Re-export first if the
  row has been edited; the 2026-11-08 archive has zero revisions for these rows.
- Do not assume a 0% overlap score means there is nothing worth keeping. It
  means the live page does not contain the archived text, not that the text is
  worthless.
- Do not archive the live `copy-home-hero` row. It is the homepage's region
  content, not a dead page.
