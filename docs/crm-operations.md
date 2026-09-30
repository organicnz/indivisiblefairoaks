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

Delivery is off the request path. The Next action writes a `queued` row and hands
the id to the `crm-broadcast-send` Edge Function, which owns delivery, progress
and the final status. The claim is the conditional
`.is('dispatched_at', null)` update — a second dispatch is refused, so a retry
cannot double-send.

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

## Recovery

A broadcast stuck in `sending` means the sender died mid-run. `sent_count` and
`failed_count` show how far it got, and `dispatched_at` is already set — so
clearing `dispatched_at` to re-dispatch will **re-send to everyone already
delivered to**. To finish a partial send, narrow the audience and send a new
broadcast instead, then mark the old one failed.

A row sitting at `sending` is narrower than it used to be. Both refusal paths in
the sender call `finish(..., 'failed', …)` before returning 422, so an
over-ceiling audience and a self-test with no usable address both **terminate** the
row rather than stranding it amber. A row that is *still* `sending` means the
isolate died mid-loop, not that a guard fired.

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
