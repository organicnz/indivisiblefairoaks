# CRM operations

> Broadcasting, the follow-up board, and the rules that keep test traffic out of
> real inboxes. Full context in [`../AGENTS.md`](../AGENTS.md).

## Broadcast lifecycle

```
draft ──▶ queued ──▶ sending ──▶ sent
            │                      └─▶ failed
            └────────────────────▶ failed
```

| State | Meaning | Written by |
|---|---|---|
| `draft` | Unsent compose. Not history — and not a *log entry* either. | `saveCRMBroadcastDraft` |
| `queued` | Accepted, awaiting the sender. | `sendCRMBroadcast`, `sendCRMBroadcastSelfTest` |
| `sending` | The sender has claimed the run. | `crm-broadcast-send` |
| `sent` / `failed` | Terminal. | `crm-broadcast-send` |

A draft is a document, not a log entry. `saveCRMBroadcastDraft` takes a
`broadcastId` and updates in place, scoped `.eq('status', 'draft')` **in the SQL**,
so a second "Save draft" cannot create a second row and a draft that has since
been sent refuses to be rewritten. The scoping is in the `WHERE` clause rather
than a JavaScript check because that is the only way the property holds under
concurrency. It used to insert unconditionally, so pressing the button twice left
two rows and the composer's handle to the intended one lived in component state —
a reload orphaned it and the draft became unremovable.

Drafts have their own read, `getCRMBroadcastDrafts()`, ordered `updated_at DESC`
(a `touch_updated_at()` trigger, migration `20260930140000`) rather than
`created_at`: the resumable draft is the most recently *worked on*, not the most
recently started. They are excluded from `getCRMBroadcasts()` in the query, not
filtered afterwards, so the partial index `crm_broadcasts_recent_idx … WHERE
status <> 'draft'` can actually be used — the query it was written for did not
state the predicate, so the read degraded to a scan of every row the chapter had
ever composed. The composer renders them in an "Unsent drafts" panel above the
history, so excluding them from history does not strand them.

**Sending a draft consumes it.** `handleSend` deletes the draft row *before*
clearing `draftId` locally. It used to only clear the local id, so the row stayed
`status = 'draft'` and reappeared under "Unsent drafts" offering **Resume** —
loading copy that had already gone to the whole list, with the same audience chips,
into a composer one click from Confirm & Blast again.

The delete is fire-and-forget, and the local clear happens either way: a failure
leaves a stale draft, which is the pre-existing behaviour and recoverable, whereas
blocking the UI on it would report a delivered campaign as a failure.

**History and drafts are both bounded at 25 rows and neither had a pager.** A
chapter past 50 campaigns could not see its fifty-first, and a twenty-first draft
was unreachable *and* unremovable — the exact failure the paragraph above records
for a single draft row, at the scale of a whole list. `getCRMBroadcastHistoryPage`
now returns a page with a count, and `BROADCAST_HISTORY_PAGE_SIZE` is shared so one
pager serves both reads.

Delivery is off the request path. The Next action writes a `queued` row and hands
the id to the `crm-broadcast-send` Edge Function, which owns delivery, progress
and the final status. The claim is the conditional
`.is('dispatched_at', null)` update — a second dispatch is refused, so a retry
cannot double-send.

"Off the request path" is about responsibility, not time: the action awaits the
dispatch fetch, and the function's response is the delivery summary — so the
success toast only appears once the sender has very nearly finished. That is
deliberate. It is why the composer's
progress panel resumes on mount via a poll of the same row the sender writes, and
it is why the function's `activityWriteFailures`/`warning` rides the response
body back to the admin instead of an optimistic "sent".

**The sender is deployed by CI, and for its whole life it was not.** It is absent
from no deploy workflow now, but it was absent from all of them:
`.github/workflows/supabase.yml` deploys seven functions and this was not one of
them, while `supabase/functions/secrets.manifest.mjs` already marked
`RESEND_API_KEY` and `APP_URL` as required *for it*. The workflow was asserting
secrets for code nothing shipped, and `CRM_BROADCAST_FUNCTION_URL` pointed
production at a route that only existed once that step ran. The `verify` job now
probes it with the **publishable** key and requires **401** — a 404 means the
function is not deployed, a 200 means it stopped requiring the key. A config var
and a deploy step have to land together; either alone reproduces the failure
above.

### `'queued'` must be in the status CHECK

`crm_broadcasts.status` is `CHECK (status IN ('draft','queued','sending','sent','failed'))`.

This was wrong once and cost every broadcast the site has ever sent: the
constraint omitted `'queued'`, so the insert failed, so `sendCRMBroadcast`
returned "Failed to create broadcast log". The Edge Function also refuses to run
against anything that is not `queued`, so the two halves of the feature
disagreed on the value that means "accepted, not yet delivered".

It was masked because `CRM_BROADCAST_FUNCTION_URL` was unset, which surfaced a
different error first. A CHECK that disagrees with the code is not a constraint,
it is a trap: unit tests mock the client and never see it.

**If you add a status, update the CHECK in a migration in the same change.**

### A saved segment with a search term cannot become an audience

`crm_segments.query` is a free-text filter — "everyone whose notes mention
X". The broadcast composer's audience is status, district and tag chips; there is
no text search, because a broadcast audience has to be re-resolvable at send time.

The composer's "Apply Saved Segment" set the chips and **ignored `seg.query`**,
and then announced success *specifically when a query existed* — so the toast fired
exactly when the applied audience was wrong. A segment saved from a directory
search became a whole-segment blast in the composer, reported as applied.

Those segments are now labelled `(search only — not applicable here)` in the
dropdown, and selecting one says plainly that it has no chips to apply and to check
the recipient count. The live count beside the chips is the real check: applying a
query-only segment leaves every chip empty.

## The self-test send

`sendCRMBroadcastSelfTest` sends the composed message to the signed-in admin and
nobody else.

**The recipient is never an input.** It is read from the server-side session, so
the function has no way to express "send this to someone else". A self-test that
collected an address would be a blast button with a narrow default, and the
failure mode of getting it wrong lands in strangers' inboxes.

**The narrowing lives in the Edge Function, not the caller — and the flag is read
on its own.** `const isSelfTest = broadcast.test_only === true`.

It used to be read as `test_only === true && typeof test_recipient === 'string'`,
and that conjunction *was* the safety property. Both columns are nullable and
nothing constrained the pair, so a `test_only` row whose `test_recipient` was
never written evaluated false, dropped out of the branch, and the audience loop
then ran against **every opted-in contact in the database**. No bad intent was
required and no caller change was needed — just a row missing a value. A preview
that quietly resolved to the real list is worse than no preview, because the
author would ship on the strength of it.

So a self-test with no usable address is now a hard **422**, not a fallback. The
row is finished `failed` and returns `self-test has no usable test_recipient;
refusing to fall back to the full audience`. The audience loop is now reached
only when `test_only` is false outright. `isDeliverableAddress()` is a
deliberately closed single-address pattern, so a value carrying a comma is
rejected rather than split — a self-test that resolved to several recipients
would be exactly the widening the function exists to prevent.

### `isDeliverableAddress` rejected every real address

That guard is in `_shared/broadcast.ts` now, exported and unit-tested, and it was
**broken in the one direction that matters**. It was a local helper in
`crm-broadcast-send/index.ts` with no test in any runner, and its pattern was
`[^@[:space:],]` — written for a POSIX regex. JavaScript has no POSIX character
classes: inside `[...]` that is the literal run `[ : s p a c e :]`, so the negated
set forbade `@`, `:`, `,` **and the letters `s`, `p`, `a`, `c`, `e`**.

`alice@example.com` was rejected. So was `test@example.com`. The guard stopped a
self-test resolving to several recipients by refusing to resolve to *any*
recipient — the same shape as the broadcast that had never been sent. A narrow
guard that fails closed on legitimate input is still broken, and a broken guard
nobody can see reads as protection.

Three things are load-bearing about the fix:

- **It lives in `_shared` and is imported by the parity test.** The delivery path
  is Deno, so the Next test runner cannot exercise an Edge Function directly. That
  gap is why the editor and the CRM are covered and the code deciding who actually
  receives email was not. Anything a `crm-broadcast-send` guard must be right
  about belongs in `_shared` for the same reason.
- **The pattern is `\s`, not `[:space:]`.** The forbidden set has to be the one
  the comment claims; a pattern that rejects the wrong characters is worse than no
  pattern, because it looks like a control.
- **The test is mostly real addresses.** A synthetic fixture would not have caught
  this: the failure is precisely that ordinary addresses were refused, so the
  regression to guard is `"alice@example.com" and friends are accepted`.

A `CHECK` (`crm_broadcasts_test_only_needs_recipient`, migration
`20260930120000`) makes the shape unreachable as well as unreachable-by-code. It
repairs any pre-existing offender in place — a self-test with no address becomes
a draft, which is what it actually is: unsent — and then validates.

A preview also:

- is prefixed `[TEST — not sent to the list]`, so a stray one is obvious in a real inbox
- carries no unsubscribe link and no `List-Unsubscribe` header — there is no subscription behind it
- writes no `crm_activities` row, because `contact_id` references `crm_contacts(id)` and a preview has no contact
- is answered by a sender that reports `activityWriteFailures` / `activityRowsLost` / `warning` in its JSON when a **real** campaign's activity insert fails. `ok` is then `false` while `status` is `sent`: delivery is what `status` reports, and the timeline is a separate, truthful statement — the mail went out, the record of it did not

**How it reads in the history.** Previews are kept in the same
`Past Campaigns` table as real campaigns — a test is something the author did,
and hiding it would leave a campaign in the record with no visible trace. Every
column therefore says what happened:

| Column | A real campaign | A preview |
|---|---|---|
| Subject | the subject | `[TEST — not sent to the list] …` plus a Test chip |
| Audience | `All Constituents` or the filters | `Nobody — sent only to you` |
| Recipients | the count | `1 (you)` |
| Status | green `sent` | amber `test`, no success check |

The audience column is the one that matters. A preview row is saved with no
filters at all, so rendering it the way a campaign renders would read
`All Constituents` beside a green `sent` — telling an organizer a blast had
gone out when nobody had received anything. A count line above the table says how
many rows are previews, so the headline number is not read as "campaigns sent".

To verify the guard without mailing anyone, insert a row whose audience filter
matches nobody (`target_status: ['__no_such_status__']`) **with** a
`test_recipient`. A working guard returns `recipientCount: 1`; a guard that fell
through would return `0` and send to the real list. Both are safe; only the first
sends.

To confirm the *pairing* holds rather than the branch, try to write
`test_only = true` with a NULL or blank `test_recipient`: the insert must be
refused by `crm_broadcasts_test_only_needs_recipient` before any application
code runs. The old recipe assumed you could stage the dangerous row by hand, and
you no longer can — which is the point.

## The audience is paged in a stable order, and the ceiling is exact

Two defects in the same loop, in both `crm.ts` and `crm-broadcast-send/index.ts`.

**`.range(offset, …)` is offset paging, so it needs a total order.** Neither loop
called `.order()`, so PostgREST emitted no `order` parameter and the row order was
whatever the plan happened to produce — and, crucially, not guaranteed to match
the previous page's. `.range()` is coherent only against an order that does not
change between statements. A contact who opted out, or a CSV import that landed,
between page 3 and page 4 shifts every later row by one: the boundary contact
appears in two pages and **is mailed twice**, and `recipient_count` is wrong. A
concurrent insert is the mirror case, and one contact is silently skipped with no
trace anywhere.

Both now `.order('id', { ascending: true })` before the range. `id` is the primary
key, so it is a total order; a non-unique column would still tie and re-open the
same hole. `getCRMExistingTags` in the same file already did this, which is what
made it an oversight rather than a decision.

**An audience of exactly the ceiling was refused as "larger than the limit".** The
loop condition was `offset < CEILING`, which stops one page *before* the boundary
and so can never learn whether the list ended at 5,000 or continued past it. With
a full final page, `exhausted` stayed false and the send was refused. The
condition is now `<=` with an explicit `recipients.length > CEILING` break: the
loop reads one page further, which is the only way to tell those apart, and it
still breaks the moment the ceiling is passed, so the work stays bounded rather
than proportional to the list.

| Audience | Outcome |
|---|---|
| 4,999 | sent |
| 5,000 (exactly the ceiling) | sent |
| 5,001 | refused, nothing sent |

## Unsubscribe: a GET must never change state

`GET /api/crm/unsubscribe?token=…` used to write `do_not_email = true` and insert
a `crm_activities` row, and only *then* branch on the method to decide what to
render. The route's own docblock said "GET renders a tiny branded confirmation;
POST performs the opt-out", so the code did the opposite of its documentation.

That is a mass-unsubscribe waiting to happen. **Corporate mail security products
fetch every URL in an inbound message** — Proofpoint, Barracuda, Microsoft Safe
Links — and web and chat clients prefetch links on hover. Any of them turns "the
recipient clicked unsubscribe" into "the recipient's mail gateway clicked
unsubscribe", and a 5,000-recipient chapter has 5,000 gateways watching for that
exact URL. The outcome is a silent mass opt-out in which every recipient believes
they are still subscribed.

So the two methods now do genuinely different things:

- **GET** looks the contact up and renders a confirmation page. It writes nothing.
- **POST** performs the opt-out, in two shapes told apart **by the body** — a
  browser form carrying `confirm=1` gets the page back, and an RFC 8058
  `List-Unsubscribe-Post` auto-confirm (same URL, empty body) gets `204`.

Distinguishing on the body rather than on `Accept` or a user-agent is deliberate.
Inferring it from headers is the kind of cleverness that silently starts returning
an empty `204` to a real person when a mail client changes a header, and both
failures are bad: a subscriber who sees nothing happen and assumes it worked, or
does not.

The confirmation page says why it asks — a chapter that explains the extra click
gets more honest clicks than one that silently unsubscribes people.

**The unsubscribe token is not rotated on re-subscribe.** Deliberate: rotating it
would break the link in every historical broadcast the contact still has, and
someone who has deliberately re-subscribed is not being attacked by their own old
email. The exposure is a token that leaks once via a shared inbox, a gateway log
or a proxy log, and the mitigation is the contact's own re-subscribe rather than
silent invalidation of links they may still be looking at. If that trade is ever
revisited, it is a decision about the chapter's threat model, not a bug fix.

## Consent is filterable and counted — the reasons are still not recorded

`do_not_email` is enforced in four places and all four agree: the broadcast
resolver, the recipient count, the direct-email action, and the sender itself. That
part was already correct and is not what this section is about.

What an organizer could not do was **check**. "Opted-out contacts are excluded
automatically" told them a rule, not a fact: if a third of the chapter had quietly
opted out since the last blast, the audience on screen was two thirds of what they
expected and nothing said so. And answering "who has opted out?" meant paging the
whole directory reading a 9px badge on each row, or writing SQL against production.

Both are now first-class:

- `getCRMContacts` takes `consent: 'opted_out' | 'opted_in' | 'unasked'`, filtered on
  `do_not_email` in the query rather than in JavaScript. The directory filter bar
  has a **Consent** select for it, and the URL carries `consent=` so a filtered
  view survives a reload, a shared link, and the pager. `unasked` uses `.is(…)`,
  never `.eq(…, null)` — see the tri-state section below.
- `getBroadcastRecipientCount` returns `{ count, excludedCount }` instead of a bare
  number. Both numbers come from one target specification — the same statuses,
  districts and tags — so they reconcile: *count + excludedCount* is every contact
  the audience rules matched. The dispatch bar names the exclusion
  ("37 matching contacts are opted out and excluded") rather than asserting that
  exclusion happens.

**The count is not the same as an audit trail, and the difference matters.** An
organizer can now prove *how many* are excluded and *who* they are. They still
cannot read *why* someone opted out, because the reason lives in an email thread
and nowhere else. If a constituent asks, the honest answer is "we have it in a
thread somewhere". Recording it is a schema change and a decision about what the
chapter is willing to store about its own members — so it is deliberately left
undone rather than guessed at.

## Never send email from a test

Two different mechanisms, because the two send paths are not alike.

### The contact form: redirected, not stubbed

`playwright.config.ts` points `CONTACT_FUNCTION_URL` at
`scripts/mock-notify-contact.mjs`, so `contact.spec.ts` exercises the real
delivery-status UI — including its 502 and `copied: false` branches — without a
send. The action still calls the notifier; it just cannot be the real one.

In an e2e build `notifyUrl()` **requires** that override and returns `''`
otherwise, which `invokeNotify` reports as a failed delivery. It does not fall
back to the live URL. A default that reappears if someone edits the Playwright
config is a mail-sending accident waiting for a maintenance window.

The `NEXT_E2E_BUILD` flag additionally skips the database write, so a test run
writes nothing. Both halves are needed: the write stub, and the notifier
redirection.

### The CRM send paths: refused in code

These are different. They dispatch to a live Edge Function that talks to Resend,
and the audience is a real list of real constituents. No redirect exists for
them, so `sendCRMBroadcast`, `sendCRMBroadcastSelfTest` and
`sendCRMDirectEmail` return `Sending is disabled in test builds.` when
`isE2EMode()` is true.

The check is in the action rather than in the harness so the guarantee travels
with the code: a future test author does not have to know the rule, and a
misconfigured environment cannot quietly undo it. This matters the moment e2e
gains a seeded admin session — the obvious next step for testing the CRM.

`isE2EMode()` requires **both** `CONTACT_SUBMISSION_TEST_MODE=1` and
`NEXT_E2E_BUILD=true`. Either alone is deliberately insufficient: the first
would be a production switch that silently stops delivering, the second is true
of any CI build, where sending is exactly what is wanted.

### If an admin says the CRM "can't send"

Check one thing first: is `/admin` showing the amber **E2E test build** banner
(`src/app/admin/layout.tsx`)? It renders whenever `isE2EMode()` is true, and it is
the difference between "the CRM is broken" and "this deployment has the test
harness's environment variables set". The fix for the second is to remove
`CONTACT_SUBMISSION_TEST_MODE` / `NEXT_E2E_BUILD` from the Vercel project — they
are a property of Playwright's spawned server and should never be environment
variables a human sets. Do not delete the banner: without it the same failure
reports itself as a broken product.

## Tags are stored lowercase, everywhere

`contains('tags', [...])` compares against stored values, so `Choir` and `choir`
are different tags in the database. Every path that can write or match a tag runs
through `normalizeTags` (`src/lib/crm-import.ts`): the contact schema, the segment
schema, the broadcast audiences (`saveCRMBroadcastDraft`, `sendCRMBroadcast`,
`getBroadcastRecipientCount`, the recipient resolver), the contact merge, and the
directory filter parser — so a hand-typed `Choir`, a CSV row, and a `?tag=Choir`
link all resolve to the same chip.

Rows written before that landed still hold mixed case, which is why the filter
can show a chip that matches nothing. The one-time `UPDATE … lower(tags)` is a
data change and belongs to the chapter, not to a deploy.

## The follow-up board

`crm_tasks.contact_id` is nullable. A follow-up belongs either to a
constituent or to the chapter — "call the county clerk", "confirm the venue",
"chase the AV rental". When it is `NULL` the board labels the row *Chapter-wide*;
that is not missing data, and rendering no name at all reads as a bug.

Every destructive CRM action — delete constituent, delete follow-up, delete
segment, merge contacts, opt out / re-subscribe — goes through the shared
`ConfirmAction` component: idle control, then the consequence, then an inline
Confirm/Cancel. No `window.confirm()` anywhere. A native dialog asks a blind
question and cannot be automated, so the paths behind it went untested.

Tasks can be created from the board or from a constituent's profile. The board
used to tell authors to go via a profile, which was no route at all to the tasks
that are not about a person.

Rate limits, in addition to the database flood guard:

| Action | Budget |
|---|---|
| Direct email | 30 / min / admin |
| Broadcast (real or test) | 5 / min / admin |

A broadcast is **refused**, not truncated — and the refusal is made on
*completeness*, not on a count. `resolveBroadcastRecipients` returns
`{ recipients, exhausted }`, and `sendCRMBroadcast` refuses when `!exhausted`,
**before the log row is written**, so nothing is queued and nothing is dispatched.

The previous version compared `recipients.length > BROADCAST_RECIPIENT_CEILING`
against a resolver that paged with `offset < CEILING` and could therefore return
at most exactly `CEILING` rows. The branch was structurally dead code, and a
12,000-recipient audience was quietly cut to 5,000 and reported `sent` — the
organizer would believe everyone had heard from them. Only a query that ran dry
proves the list is complete; a loop that stopped because it hit the ceiling is an
audience nobody has finished counting.

`crm-broadcast-send` applies the same rule independently and answers **422** with
`audience exceeds the 5,000 recipient ceiling for one broadcast; nothing was
sent`, marking the row `failed`. The action refuses first, so a row over the
ceiling should never exist; this is defence in depth.

### The database flood guard splits its budget by origin

`check_crm_email_flood()` RAISEs past 2,000 `email_sent` activities in the last
hour, whatever created them — a number sized for the direct-email path, where a
runaway loop is the thing to stop. A broadcast writes **one `email_sent` row per
recipient**, so a legitimate 2,500-recipient campaign crossed the line mid-run:
the trigger fires per statement, so every activity insert from that point raised,
**the sender discarded the returned error**, kept counting `sent`, and the
campaign finished green with no timeline entry on any recipient after the 2,000th.
The mail was delivered and the chapter's record of it was not.

Migration `20260930120000` rewrote the function to exempt rows carrying
`metadata->>'broadcast_id'` — only the sender writes that — from the window
count, and to bound *those* separately at 50,000/hour, which is ten broadcasts at
the 5,000 ceiling. A genuine runaway is still stopped. The sender's half of the
fix is that it no longer discards the error: it counts the failures, logs them,
and reports `activityWriteFailures` / `activityRowsLost` / `warning` in its
response, so a lost timeline is visible rather than inferred from a green row.

## Configuration

| Variable | Where | Why |
|---|---|---|
| `CRM_BROADCAST_FUNCTION_URL` | Vercel env (**var**, not secret) | Without it, a queued broadcast never goes out and the UI says so. It is a plain URL, not a credential, so it belongs in **Plain**. |
| `SUPABASE_SECRET_KEY` | Vercel env (secret) | Service-role auth for the sender. Bypasses RLS. |
| `APP_URL` | Edge Function secret | Used for the unsubscribe URL. Must not be the pre-cutover apex. |

**Setting the variable alone was not the fix, and never could have been.**
`crm-broadcast-send` was not in `.github/workflows/supabase.yml`, so the variable
pointed production at a route no pipeline shipped. A config var and a deploy step
have to land together; either one alone reproduces the "the broadcast sender is
not configured on this deployment" failure, which is safe — it queues nothing —
but which also means no broadcast has ever gone out.

This is the exact inverse of the mistake the audit exists to catch:
`vercel env add` stores values as **Sensitive/Secret** by default, so pushing
this value the obvious way recreates the public-in-a-secret-store bug that
`NEXT_PUBLIC_*` already caused twice. `scripts/secrets-registry.mjs` expects it in
`vercel-var`.

No test sends through it: the CRM send paths refuse to run in an e2e build.

### The brand link follows the sending origin

The template's site link used to be a hardcoded apex (`BROADCAST_SITE_URL`) in
both copies, so a staging build mailed brand links to a host that 302s to
Google Sites until the cutover — while the unsubscribe URL in the same message
already pointed at staging. The origin is now a `siteUrl` parameter on
`buildBroadcastEmail` and every function beneath it: the composer preview and
direct sends pass `NEXT_PUBLIC_SITE_URL`, the sender passes `APP_URL`. The
parity test asserts neither copy hardcodes an origin and that a staging origin
is what every link carries. `brandShell` in `src/lib/email.ts` keeps its
default for transactional mail — the production apex from `src/config/site.ts`,
never a literal — and broadcast-adjacent callers pass the origin explicitly.

---

## Browser coverage

`e2e/admin-authenticated.spec.ts` drives the CRM and the content editor through a
real sign-in, seeded once per run and stored as a Playwright `storageState`. It
requires `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` for a **non-MFA-enrolled** admin
on the target Supabase project, and `test.skip`s without them.

That admin must not be MFA-enrolled: an AAL2 requirement would redirect the suite
away from every admin route it means to drive.

**The create/edit/delete test also needs `E2E_ALLOW_DB_WRITES=1`.** Staging and
production share one Supabase project, so that test writes to the real
constituent directory, and a failure mid-test leaves an
`e2e-directory-*@example.com` row behind. `isE2EMode()` blocks sends, not
writes, so credentials alone are not enough. The other admin tests are
read-only and run once the credentials exist. The MFA step-up path has its own
spec and its own seeded admin — see [`mfa.md`](./mfa.md).

**A skipped auth suite is not a passing suite.** Without the seeds, `/admin` and
`/auth/mfa` have no browser coverage at all, and `sendBlockedInE2E()` is what
prevents a test run from mailing the real list in the meantime.

`e2e/a11y.spec.ts` still excludes all of `/admin` from its route list, because that
list is static and cannot be conditional on seeded credentials. The authenticated
suite carries its own axe scan over `/admin/crm` instead, which is the surface where
a contrast or label regression would actually land.

## Recovery

A broadcast stuck in `sending` means the sender died mid-run. `sent_count` and
`failed_count` show how far it got, and `dispatched_at` is already set — so
clearing `dispatched_at` to re-dispatch will **re-send to everyone already
delivered to**. To finish a partial send, narrow the audience and send a new
broadcast instead, then mark the old one failed.

### Marking a stranded campaign failed

That last step used to require editing the database by hand. `markCRMBroadcastFailed`
now does it, from the expanded history row in the composer.

It is **deliberately one-directional**, because the one irreversible mistake
available here is restarting a campaign:

- It can only move a row to `failed`, never back to a sendable state.
- It refuses a row already `sent` or `failed`, and points a `draft` at Discard.
- It refuses a row dispatched in the last **15 minutes**. 5,000 recipients at ten
  per provider round-trip is a genuinely long send, so "still sending" is often
  just "sending", and killing one of those would have the chapter believe the
  remainder was never contacted.
- `failed_count` is set to `recipient_count - sent_count`, so the row's two counts
  still reconcile and the history does not claim a campaign went to everyone.
- `marked_failed_at` / `marked_failed_by` are written alongside `status`, so a
  reader six months later can tell a **sender-reported** failure from an
  **organizer's decision**. A row that says only `failed` cannot.

**It does not re-send anything, and it does not reach the remainder.** A new,
narrower campaign is still the way to contact people the stranded one missed.

A row sitting at `sending` is narrower than it used to be. Both refusal paths in
the sender call `finish(..., 'failed', …)` before returning 422, so an
over-ceiling audience and a self-test with no usable address both **terminate** the
row rather than stranding it amber. A row that is *still* `sending` means the
isolate died mid-loop, not that a guard fired.

### Every step of a send is now bounded

Three waits that had no timeout, each of which turned a failure into a silence:

| Wait | Bound | What a hang used to be |
|---|---|---|
| `dispatchBroadcastSender` → Edge Function | 15 min | The action hung, the composer button stayed disabled forever, the row stayed `queued`, no failure and no message. |
| Resend API, per recipient | 20 s | The row stranded at `sending` with `dispatched_at` set — the one state that must never be re-dispatched. |
| Each progress poll, client-side | 15 s | The poll loop froze with no fallback, because its only exit is a `catch` a hang never reaches. |

The dispatch bound is deliberately long: the function is synchronous by design and
returns the whole campaign's outcome, so a bound shorter than a legitimate 5,000-recipient
send would report a healthy campaign as failed. It is a **hang** detector, not a
performance target.

The poll bound is what makes "still sending" and "we lost the feed" distinguishable
states. Losing the feed now says so, rather than leaving a frozen "Sending 120 of
5,000".

**The composer's tab stops watching, and says so.** `followProgress` runs
`ceil(BROADCAST_RECIPIENT_CEILING / 10) + 30` attempts at 2 s — roughly half an
hour, derived from the ceiling rather than a fixed 90 — then sets
`stillWatching: false`, refreshes, and renders *"Still sending, but this view has
stopped updating."* That is a statement about the **view**, not about the send:
the row may well be fine. A campaign at the full ceiling is five hundred
ten-at-a-time round-trips to the provider. Refresh the page, or read
`sent_count` / `failed_count` directly, before concluding anything is stuck. The
poll used to return silently without refreshing, so a large campaign left the row
reading `sending` in that tab with no way to tell a slow send from a stuck one.

---

## Consent is enforced, counted, and captured

Three states, not two, and this is the part of the CRM most likely to surprise a
chapter reading this document for the first time.

| Value    | Means                             | In a broadcast audience? |
| -------- | --------------------------------- | ------------------------ |
| `false`  | asked, and agreed                 | **yes**                  |
| `true`   | asked and declined, or unsubscribed | no                     |
| `NULL`   | **never asked**                   | no                       |

**Enforced** in four places — the recipient resolver, the Edge Function, direct
email, and the recipient count — via `.eq('do_not_email', false)`. That predicate was
already correct for a column that could not then express its own third state: `col =
false` is `NULL` for a null row, and `NULL` is not true, so never-asked contacts were
already excluded. The resolver needed no change; it had been written for a stricter
column than it had.

**Counted** by `getBroadcastRecipientCount`, which returns `{ count, excludedCount }`
from one target specification so the two numbers reconcile: `count + excludedCount`
is every contact the audience rules matched. The exclusion half is
`.not('do_not_email', 'is', false)` — `IS NOT FALSE`, one query covering both `true`
and `NULL`. It was `.eq('do_not_email', true)` alone, which was exact while the
column was `NOT NULL` and stopped being exact the moment `NULL` became expressible:
the bar reported "0 excluded" while never-asked contacts were being dropped, which
is the one number an organiser would use to decide whether anything was silently
missing.

Do not "simplify" that to `.neq('do_not_email', false)`. The two are opposites on a
null row — `IS DISTINCT FROM` includes it, `<>` excludes it as `UNKNOWN` — and
picking the wrong one turns the audit into a mail run.

**Captured** by the contact form, which now has a second checkbox. `sendCopy` is
transactional (a reply to this one message); `consentToEmail` is marketing (a
standing opt-in). They were the same checkbox by omission, which meant the consent
that reached a broadcast audience had never been separately given — a resident who
wanted a receipt was on a mailing list.

### What a submitter's answer does and does not change

- A submitter who ticks the box is `false` — agreed.
- A submitter who leaves it unticked is `true` — declined, **not** unknown. They were
  shown the box. Recording silence as `NULL` would keep them in the unasked pool for
  ever, re-asking about a question they had answered.
- A contact created any other way — profile signup, store order, a CSV import with
  no consent column — is `NULL`. The column has **no default**, deliberately, so any
  INSERT that forgets to think about consent records "never asked" rather than
  "agreed".

The `ON CONFLICT` branch in `fn_sync_contact_submission_to_crm` fills in consent
**only where the row has no answer yet** (`IS NULL`, not `IS NOT TRUE`). An existing
decline is an answer, and a repeat form visit is not consent — overwriting it would
resubscribe people who opted out. Leaving the branch entirely alone was right when
the column had two states and wrong now, because `NULL` is precisely the state a form
submission answers.

`submit_contact_submission`'s old four-argument overload is **dropped**, not left
alongside: `CREATE OR REPLACE` cannot change a function's arity, so a five-argument
version would have been defined *next to* the original rather than in place of it,
leaving a `GRANT EXECUTE … TO anon` on a function none of this migration revokes.

### Existing rows keep their current answer

The migration does not backfill. Every existing row holds `false` and keeps it, so
the audience the day it deploys is exactly the audience the day before — and
`opted_in` in the directory still means "the column is false" for those rows, **not**
"this person agreed to be emailed". Nothing in this deployment turns that historical
`false` into a real agreement; it only stops new unasked contacts from being treated
as agreements. Converting the existing rows is a chapter decision about what the
chapter can honestly claim about people who were never asked, not a deploy. Until it
is made, treat the pre-migration `false` values as unknown-but-reachable and use the
`unasked` filter to find the genuinely unasked ones.

The visible effect of all this: **the next campaign reaches fewer people than the
last one.** Every contact created by a path that does not ask is now excluded. That
is the correct direction, and it is a chapter-visible number, so it is stated here
rather than discovered mid-campaign.

### A filter can be applied but not saved

`crm_segments` had no `consent` column until migration `20261005000000`, and the
"Save current filter as segment" button's enablement check did not read the field
either. So the opt-out audit — the filter a chapter most often needs to repeat —
could be applied on screen and could not be saved, and the button sat disabled
beside four engaged controls.

`consent` is now `NULL` or `opted_out` / `opted_in`, where **NULL means "no consent
filter"**, not "opted in". An existing segment keeps its exact previous meaning,
which is what a new column on a filter definition has to do: adding an opinion to
a saved audience must not change that audience.

---

## Every read that caps, says so

Four CRM reads hit a row limit, and each one was silent. A cap is a resource
decision; the failure is not *having* one, it is a chapter being unable to tell the
difference between a complete answer and a shortened one.

| Read | Cap | What it returns now |
|---|---|---|
| `exportCRMContacts` | `CRM_EXPORT_LIMIT` (10,000) | `{ count, matchedCount, truncated }` — the toast reads "10,000 of 12,341", not "Exported 10,000" |
| `getCRMExistingTags` | `TAG_SCAN_LIMIT` (20,000) | `{ tags, truncated, scanned }` — both surfaces say the tag list is partial |
| `getCRMBroadcastHistoryPage` | none (paged) | `{ broadcasts, totalCount, page }` — a pager, and the heading names the total |
| `getCRMBroadcastDrafts` | `BROADCAST_HISTORY_PAGE_SIZE` (25) | bounded, and drafts are deletable so an unreachable row is recoverable |

**The export is the serious one.** It is the only CRM artefact that leaves the
building, it re-imports cleanly, and nothing inside a CSV says it is short. A
silent cap produced a file indistinguishable from a complete backup — the failure
would surface when somebody tried to restore it, weeks later, with no way to know
what was missing. `count` is the rows *in the file* and `matchedCount` is what the
filter matched; reporting the matched total as `count` next to a `truncated` flag
would leave the two contradicting each other.

**The tag scan is quiet in a worse way.** Postgres cannot return distinct elements
of an array column, so the chips are built by paging the whole directory on every
CRM page load. Past the ceiling, a tag held only by unscanned rows has no chip — so
a chapter cannot target those constituents at all and concludes from an absent chip
that the tag does not exist. Both call sites render the flag, and the composer words
it differently from the 40-chip cap on purpose: a capped chip list hides a tag that
*was* read and is reachable from the directory, while an exhausted scan hides one
that was never read and is reachable from nowhere.

### The history pager, and a NaN that emptied it

`getCRMBroadcastHistoryPage` existed and nothing called it. The page handed the
composer `getCRMBroadcasts()` — `.limit(25)`, no offset — so a chapter past
twenty-five campaigns could see its first twenty-five and no indication the list
ended. The heading rendered `initialBroadcasts.length`, which reads as "twenty-five
campaigns exist" rather than "twenty-five are shown". The unpaged read is now gone
rather than left for a caller to find.

The clamp that replaced it had its own bug worth recording:
`Math.max(1, Math.trunc(NaN))` is `NaN`, not `1` — both functions propagate it. So
`?page=abc` produced `range(NaN, NaN)` and a history that rendered **empty**. An
empty history is the worst thing this page can show: it reads as "you have never
sent a campaign", and an organizer told their history had vanished would go looking
for the bug in their own account rather than in a URL. `Number.isFinite` first, then
clamp — and the page parses the param too, because this is a `'use server' boundary
callable directly rather than only through the page.

### Delivery events: accepted is not delivered

The history row's `sent_count` counts provider *acceptances* — Resend answering
2xx — and the expanded row used to show nothing else. A campaign with forty
permanent bounces looked exactly as healthy as one with none, because
`crm_email_events` was written by the webhook and read by nothing.
`getBroadcastEmailEvents()` is the read half: per-type counts plus the most
recent events with recipient emails resolved in one batched query, capped at
200 with a `truncated` flag like every other capped read. It fetches when the
row expands, so a long history costs one query per opened row rather than one
per row on screen. The write half stays in the webhook route; no admin action
writes to that table.

## One filter, one URL

`src/lib/crm-filters.ts` owns the mapping from a filter set to a URL, to an action
argument, and to a saved segment. Three call sites used to build their own
`URLSearchParams` and the omissions were different at each one:

| Path | Dropped | Consequence |
|---|---|---|
| Form submit | — | — |
| Quick pills | `consent` | An organiser auditing opt-outs clicks "CA-06 Local" and the whole opted-out population silently reappears. |
| Apply saved segment | `consent` | Same, from the segment chips. |
| **CSV export** | `consent` | Exporting from an "Opted Out of Email" view produced a CSV of **every** contact — the one file a chapter takes off-platform, and exactly the file `importCRMContacts` would round-trip. |
| Save as segment | read `useState`, not the applied filters | You could save a segment that differs from what is on screen. |

All five now go through one helper, and `src/lib/__tests__/crm-filters.test.ts`
asserts the consent parameter survives each path. The export and the save-segment
read the **applied** filters rather than the form state, for the same reason the
pager does: the export must be the set on screen.

A segment is applied as a **replacement**, not a merge. Merging meant applying a
segment appeared to do nothing whenever the search box happened to hold something,
and applying a second segment silently intersected with the first.

Segments are renamed in place, from the chip itself. The rename writes the new
name with the stored filter set passed through untouched, so renaming can never
rewrite what the segment selects. The stored `consent` goes through the same
`parseConsentFilter` the apply path uses: the column has no CHECK, so a
hand-edited value resolves to "no filter" rather than failing the rename or
persisting a value the schema would refuse on the next edit.

## Deleting a campaign image checks broadcasts first

`deleteCRMMedia` used to be an unconditional `storage.remove()` behind a folder
check. A broadcast body holds the image as markdown with the public storage
URL, and email clients fetch remote images at open time — so deleting a file a
*sent* campaign used breaks opens retroactively, not just the admin record, and
deleting under a draft strands the author with a block that previews nothing.
The action now refuses when any `crm_broadcasts.body` still contains the path,
sent or draft, and fails safely when the check itself errors. Declining leaves
an orphan (garbage); deleting breaks mail (visible to every recipient). Same
failure direction as `deleteContentImage`, which checks bodies, heroes and
revisions for the same reason.

---

## Concurrent edits are refused, not merged

Two organizers editing one contact used to be last-write-wins with no signal: both
read, both wrote, and the second silently discarded the first's changes.

`saveCRMContact` now takes an optional `updated_at` — the version the editor was
opened with — and turns it into a precondition on the same UPDATE. A stale save is
refused with `reason: 'conflict'` and a sentence that says what to do about it.

Three details are load-bearing, and each fails silently without its own test
(`src/lib/__tests__/crm-contact-concurrency.test.ts`):

- **The precondition rides on the UPDATE**, not on a SELECT-then-UPDATE, which
  would leave a window in which a colleague's save still lands between the check
  and the write.
- **The returned version is the one the `BEFORE UPDATE` trigger wrote**, not a
  timestamp computed in JS. A second clock disagrees by milliseconds, and then the
  editor's *next* save conflicts with itself — a false positive that teaches people
  to ignore the message.
- **A null claim uses `.is()`, never `.eq()`.** `.eq('updated_at', null)` is
  `col=eq.null` in PostgREST and matches nothing, so the guard would fire against
  every row that had never been edited.

`.maybeSingle()` rather than `.single()` on the write: `.single()` reports "matched
no row" as a PGRST116 *error*, indistinguishable from a genuine failure, and the
caller would get PostgREST's "JSON object requested, multiple (or no) rows
returned" instead of a sentence about the two-organizers case.

---

## Merging is one statement, and it locks

`mergeCRMContacts` was four independent PostgREST statements: move activities, move
tasks, update the survivor, delete the duplicate. Each is its own transaction, so a
failure at step three or four left the duplicate alive with its activities *and*
tasks already re-pointed at the survivor — a double-counted timeline, the same
follow-up twice on the board, and an error naming only the step that happened to
fail.

It is now `merge_crm_contacts()` (migration `20261005030000`): one statement,
`SECURITY DEFINER`, `search_path = ''`, `service_role` only. `requireAdmin()`
remains the authorization boundary.

A transaction alone does not fix the second failure. Two organizers merging the
same pair concurrently both read, both wrote, and both added
`total_donated_cents` to the same pre-merge value — inflating the survivor's
giving total by one copy. `SELECT … FOR UPDATE` on both rows, **survivor first**,
serialises them. Both orderings are asserted in the test.

The combination rules, all in the migration next to the code that implements them:

- Activities and tasks move **before** the delete. `crm_activities` and `crm_tasks`
  both reference `crm_contacts(id)` with `ON DELETE CASCADE`, so a `DELETE` above
  those two `UPDATE`s destroys the timeline and the follow-ups outright.
- The audit row is written before the delete too, so a merge is always recorded.
- `do_not_email` is **OR**ed. Taking the survivor's `false` over a duplicate's
  `true` would put somebody who unsubscribed back into a broadcast audience.
- `unsubscribe_token` is **not** copied. One-click URLs are already in inboxes; the
  survivor keeps its own and the duplicate's stops working rather than silently
  retargeting.
- Tags are unioned through `lower(btrim(...))`, so a merge does not add more
  mixed-case rows for the outstanding backfill to remove.

**A text-asserting test is not a test that runs SQL.** The function is plpgsql
inside the database and no row-based mock can execute it, so
`src/lib/__tests__/merge-crm-contacts-migration.test.ts` reads the migration and
asserts the properties that make it correct — a guard against editing the SQL,
which is the realistic regression.

Nothing else runs it either. `bun scripts/hooks/migration-dryrun.mjs` is
`supabase db push --dry-run`, which diffs the migration history against the linked
project and never applies a statement. So the first execution of
`merge_crm_contacts` is the push that deploys it, and the plpgsql's arithmetic — the
lock order, the survivor-first choice, the tri-state tag union — is reviewed rather
than exercised until then.

---

## Delivery events: bounces and complaints suppress

`POST /api/webhooks/resend` receives Resend's delivery events. Migration
`20261006000000` adds `crm_email_events` and widens the `crm_activities.type`
CHECK with `email_bounced` / `email_complained`. **The migration ships before the
route, and that order matters.** Without it, the suppression `UPDATE` still lands,
but the event row and the activity row are refused.

- **It authenticates by signature only.** It checks the Svix HMAC over
  `id.timestamp.body` against `RESEND_WEBHOOK_SECRET`. A timestamp outside five
  minutes is refused before anything is written, because a signature that
  verifies against a stale timestamp is a replay.
- **It can only suppress.** A permanent bounce, a spam complaint, or an
  `email.suppressed` (Resend dropped the send because the address is on its own
  suppression list) writes `do_not_email = true` when the stored value is
  anything other than `true`. That includes `NULL`: the mail went out, so the
  question was asked, and a hard failure is the answer. Nothing here can write
  `false` or `NULL`, so a forged event is at worst a mailing-list DoS, never a
  re-subscription.
- **Only a `Permanent` bounce suppresses.** Resend sends `email.bounced` for
  temporary bounces too (full inbox, greylisting). A temporary bounce is
  recorded and changes nothing. Otherwise one full inbox would lose a supporter
  for good.
- **A retry is a no-op.** Resend retries with the same `svix-id`.
  `crm_email_events` is unique on `(svix_id, contact_id)`, so the event insert
  is the claim: a duplicate key writes nothing further.
- **Events link to the campaign** through `data.tags.broadcast_id`, our id, which
  `crm-broadcast-send` tags on each message. `data.broadcast_id` is Resend's own
  id and is ignored. A tag naming no campaign keeps the event and drops the link.
- `unsubscribed_at` keeps the **earliest** evidence. This is the same rule as
  the merge RPC and `setCRMEmailConsent`.
- The recipient is lowercased before the lookup, because emails are stored
  lowercase.
- Opens, clicks and delays are recorded and change nothing.

**The key is the decoded secret, not the string.** Svix keys its HMAC with the
base64-decoded part of the secret after `whsec_`. The first version of this
route keyed with the raw string, and its tests signed the same wrong way, so
the suite passed while every real event would have failed with a 400.
`svix-signature.test.ts` now checks Svix's published vector, which a
consistent-but-wrong implementation cannot pass.

**State as of 2026-10-06.** Resend webhook `736ff3a2-5703-4426-afe4-1e78627de44d`
exists. It points at `https://test.indivisiblefairoaks.org/api/webhooks/resend`,
subscribes to the six events the route handles, and is **disabled**. `RESEND_WEBHOOK_SECRET`
is set in Vercel as `sensitive` for production and preview. The webhook stays
disabled until the route is deployed, because an endpoint that answers 404 or
400 gets retried and then auto-disabled by Svix, with nothing to say why. After
the deploy:

```bash
bun scripts/enable-resend-webhook.mjs           # dry run: webhook, secret, live probe
bun scripts/enable-resend-webhook.mjs --apply   # upsert the secret; enable once the probe passes
```

The script reads the signing secret back from Resend, so it never touches a
file. It enables the webhook only when the live route answers
`400 Missing signature headers.`. That exact answer proves the route is deployed
**and** that the deployment has the secret, because an unset secret answers
`Webhook secret not configured.` first.

It addresses the Vercel project by id (`prj_8RtMjuARvtBuUnepj9oEVyovXyb5`, team
`organicnz2222`). The local `.vercel/project.json` points at a stale project in
another team, which is why the `vercel` CLI reports the codebase as unlinked.
**At the apex cutover, `PATCH` the webhook's `endpoint` to the apex.**

## Each send carries an idempotency key

`crm-broadcast-send` sends `Idempotency-Key: crm-broadcast/<broadcast>/<contact>`
on each Resend call. If a request times out at 20 s after Resend had already
accepted it, a retry is answered from Resend's 24-hour cache and nobody is
mailed twice. The checkout rule in AGENTS.md (no idempotency key) does not apply
here. Every campaign is a new broadcast row, so a deliberate second send always
gets a new key.

## The tag list is cached, and the caller check is not

`getCRMExistingTags` used to carry `'use cache'` with `requireAdmin()` inside
the cached body. It is an exported server action, so anyone can POST to it
directly. On a cache hit the body did not run, so the admin check did not run
either. The scan now lives in `src/lib/crm-tag-scan.ts`, which has no
arguments and builds its own service-role client. The action checks the caller
first and then reads the cached data. `crm-reads.test.ts` asserts the check
runs on every call, and that a refused caller never reaches the scan.

## Not ported from `crm-improvements`, on purpose

- **Realtime progress.** `crm_broadcasts` is in no `supabase_realtime`
  publication, so the channel would never fire. The composer would have fallen
  back to its 10 s heartbeat, which is slower than the existing 2 s poll.
- **`useActionState` in the contact editor.** The branch rewrite dropped the
  `updated_at` precondition, so two organizers would be back to
  last-write-wins. The task form version only changes style, so it was not
  ported either.

## CRM panel in the visual editor overlay

The visual editor overlay (`src/components/visual-edit/VisualEditOverlay.tsx`)
includes a **Constituents** panel (`src/components/visual-edit/CRMPanel.tsx`)
that brings full CRM CRUD into the page author's workflow:

- **Search constituents** — debounced `getCRMContacts({ query, page, pageSize, consent })`
- **Create / edit** — reuses `CRMContactEditorModal` (optimistic concurrency via `expectedUpdatedAt`)
- **Delete** — `deleteCRMContact` behind `ConfirmAction`
- **Consent tri-state** — `setCRMEmailConsent` with `opted_in` / `opted_out` / `unasked`
- **Follow-ups** — `CRMTaskForm` reuse via `addCRMTask` / `getCRMTasksForContact`
- **Segments** — read-only chips + link to `/admin/crm/segments`

All mutations go through the existing server actions (`src/lib/actions/crm.ts`);
no new API surface is exposed. The panel is a `Dialog` that opens from the
overlay's dock (`Constituents` button, `UsersRound` icon). It is admin-gated
through the existing `requireAdmin()` checks in the server actions.

No email sending from the overlay — the send paths (`sendCRMBroadcast`,
`sendCRMDirectEmail`) are E2E-refused and dispatch a live Edge Function; the
overlay is not the surface for a blast.
