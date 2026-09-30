# CRM operations

> Broadcasting, the follow-up board, and the rules that keep test traffic out of
> real inboxes. Full context in [`../AGENTS.md`](../AGENTS.md).

## Broadcast lifecycle

```
draft ──▶ queued ──▶ sending ──▶ sent
             │                      └─▶ failed
             └────────────────────▶ failed

scheduled ──▶ (scheduler) ──▶ queued ──▶ sending ──▶ sent
```

A broadcast can be **scheduled** instead of sent immediately. `sendCRMBroadcast`
with `scheduledAt` saves the row with status `scheduled` and a `scheduled_at`
timestamp, without resolving the audience or dispatching. A Vercel cron job
(`vercel.json`, every minute) calls `/api/cron/broadcast-scheduler`, which
dispatches to the `crm-broadcast-scheduler` Edge Function. That function finds
scheduled broadcasts whose time has passed, claims the `scheduled → queued`
transition (a conditional update, so overlapping runs cannot double-send), and
hands each to `crm-broadcast-send`.

The audience is resolved at send time, not at schedule time — so the recipient
count reflects who is actually there when the broadcast goes out.

| State | Meaning | Written by |
|---|---|---|
| `draft` | Unsent compose. Not history. | `saveCRMBroadcastDraft` |
| `queued` | Accepted, awaiting the sender. | `sendCRMBroadcast`, `sendCRMBroadcastSelfTest` |
| `sending` | The sender has claimed the run. | `crm-broadcast-send` |
| `sent` / `failed` | Terminal. | `crm-broadcast-send` |

Delivery is off the request path. The Next action writes a `queued` row and hands
the id to the `crm-broadcast-send` Edge Function, which owns delivery, progress
and the final status. The claim is the conditional
`.is('dispatched_at', null)` update — a second dispatch is refused, so a retry
cannot double-send.

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

**The narrowing lives in the Edge Function, not the caller.** When
`crm_broadcasts.test_only` is set, `crm-broadcast-send` treats `test_recipient`
as the entire audience and skips the `target_*` query entirely. That is the only
place the recipient list is decided, so a preview cannot be widened by anything
written on the client — not a stray `target_*`, not a stale audience. A preview
that quietly resolved to a real list would be worse than no preview, because the
author would ship on the strength of it.

A preview also:

- is prefixed `[TEST — not sent to the list]`, so a stray one is obvious in a real inbox
- carries no unsubscribe link and no `List-Unsubscribe` header — there is no subscription behind it
- writes no `crm_activities` row, because `contact_id` references `crm_contacts(id)` and a preview has no contact

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
matches nobody (`target_status: ['__no_such_status__']`) with a
`test_recipient`. A working guard returns `recipientCount: 1`; a broken one
returns `0`. Both are safe; only the first sends.

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

A broadcast is **refused**, not truncated, above `BROADCAST_RECIPIENT_CEILING`.
A silently shortened blast is worse than a refused one: the author would
believe four thousand people heard from them.

## Configuration

| Variable | Where | Why |
|---|---|---|
| `CRM_BROADCAST_FUNCTION_URL` | Vercel env (secret) | Without it, a queued broadcast never goes out and the UI says so. |
| `SUPABASE_SECRET_KEY` | Vercel env (secret) | Service-role auth for the sender. Bypasses RLS. |
| `APP_URL` | Edge Function secret | Used for the unsubscribe URL. Must not be the pre-cutover apex. |

`CRM_BROADCAST_FUNCTION_URL` was set in production on 2026-09-30 as a
non-sensitive Production config var. It takes effect on the next production
deployment; until then, a queued broadcast still fails safely with "the
broadcast sender is not configured on this deployment" and nothing is queued.
No test sends through it: CRM sends refuse to run in e2e builds.

## Recovery

A broadcast stuck in `sending` means the sender died mid-run. `sent_count` and
`failed_count` show how far it got, and `dispatched_at` is already set — so
clearing `dispatched_at` to re-dispatch will **re-send to everyone already
delivered to**. To finish a partial send, narrow the audience and send a new
broadcast instead, then mark the old one failed.
