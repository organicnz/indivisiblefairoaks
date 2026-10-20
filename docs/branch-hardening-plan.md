# Branch hardening plan — `fix/crm-broadcast-send-type`

> **Status**: step 1 of 4 is **implemented and verified**. Steps 2-4 are plan
> only. Written from a read of the whole uncommitted changeset (46 modified +
> 12 new files, ~7.9k diff lines + ~1.8k new).
>
> **Step 1 — `fix(security): validate the value safe-redirect returns`** — done.
> Three files: `src/lib/safe-redirect.ts`, its test, and the challenge page's
> test. The dot-segment input check plus validation of the *returned* string
> close Tier 0.1. Verified by reverting the fix and watching the five new
> assertions fail (2 in `safe-redirect.test.ts`, 3 in
> `MfaChallengePage.test.tsx`), then restoring it. See the verification table at
> the end. Not committed — the whole changeset is still uncommitted, so a
> "commit 1" would carry 46 unrelated files with it.
>
> **Gate status at time of writing** — all green, which is the point:
>
> | Gate | Result |
> |---|---|
> | `bun tsc --noEmit` | clean |
> | `bun run lint:check` | 1 warning (pre-existing `useEffect` dep in the composer) |
> | `bun run test` | 73 files, 1217 tests, all pass |
> | `bun run test:coverage` | 90.83 / 83.32 / 97.54 / 93.95 — floors hold |
> | `check-doc-claims.mjs` | 11 verified across 218 files |
> | `check-ci-env.mjs` | 6 vars, 14 secrets across 5 workflows |
> | `secrets-audit --offline` | clean |
> | `migration-guard`, `rls-table-guard`, `sql-security-definer-guard` | exit 0 |
> | `playwright test --list` | 135 tests in 19 files |
>
> Every finding below survives a fully green pipeline. That is the documented
> failure mode of this repo, not a surprise about it.

---

## The shape of the problem

The changeset is four features wearing one branch: a CRM consent tri-state, a
contact-merge RPC, an MFA reason taxonomy, and a first-ever authenticated e2e
suite. They share files (`src/lib/actions/crm.ts`, `src/app/admin/actions.ts`)
and none of them can be split without a merge conflict, so they land together.

That means the review question is not "is any one of these good". Each of them
mostly is. The question is: **what is reachable right now that was not reachable
before, and what happens when it is exercised?**

Six of the findings are reachable by a member of the public, not by an attacker
with credentials. That is the tier this plan treats as non-negotiable.

---

## Tier 0 — reachable, and the failure is silent

### 0.1 `getSafeNextPath` returns a protocol-relative URL for `/..//evil.example` — **FIXED**

`src/lib/safe-redirect.ts:36-38` validates two *inputs* and returns a third value
it never validates. `new URL()` applies WHATWG dot-segment normalisation and
treats `%2e%2e` as `..`, so:

| `?next=` | returns | resolves to |
|---|---|---|
| `/..//evil.example` | `//evil.example` | `https://evil.example/` |
| `/%2e%2e//evil.example` | `//evil.example` | `https://evil.example/` |
| `/account/%2e%2e//evil.example` | `//evil.example` | `https://evil.example/` |

Verified by executing the real function against the real origin. The
`parsed.origin !== INTERNAL_ORIGIN` check at `:37` passes because the `//` has
already been demoted to a path by the time the parser reports the origin. The
check inspects the parse **input**, not the parse **output**.

Every other consumer is accidentally safe by double-hopping: `middleware.ts:47`
→ `login/page.tsx:11` validates a second time, and `auth/callback/route.ts:15`
*concatenates* the origin so the `//` lands after it. `/auth/mfa` is the only
consumer in the app that validates once and then navigates
(`src/app/auth/mfa/page.tsx:74` → `:157`, `:206`).

Two zero-interaction triggers, both introduced by this branch:

- an **AAL2** session opening `/auth/mfa?next=%2F%2e%2e%2F%2Fevil.example` is
  `already-verified` and redirected off-site on arrival;
- an AAL1-with-factor user is redirected off-site the instant they submit a
  **valid** code — the code they just typed correctly is what logs them out of
  the site and into someone else's domain.

**Fix**: validate the value you return. After building `out`, reject it if it
does not start with `/`, starts with `//`, contains a backslash, or carries a
control character. Also refuse dot-segments on `value` and `decoded` so
normalisation can never manufacture an authority. Restore the two assertions
this branch deleted (`/%2F%2Fevil.example`, `/%5C%5Cevil.example` — both visible
in `git show HEAD:src/lib/__tests__/safe-redirect.test.ts:16-17`), add the three
dot-segment cases, and add one to `MfaChallengePage.test.tsx:199`.

**Done.** `hasDotSegment()` refuses a `..` *segment* on both the raw and decoded
input (segment-wise, not a substring match, so `/.well-known` and `/..foo` still
pass — pinned), and the return value is validated directly rather than by proxy.
The two deleted assertions are restored, plus `/%5C%5Cevil.example`, three
dot-segment cases, a traversal-stays-on-origin case, and three `it.each` cases
through `router.replace` in the challenge page's test.

### 0.2 Password rotation has no server-side MFA gate

`src/app/account/update-password/page.tsx:54-77` is the gate; `:97` is the write.
The page's own comment at `:43-47` states the intent — *"any session could rotate
the account's password … the whole point of enrolling a second factor is that a
stolen password is not enough"* — and the gate does not deliver it. The decision
is React state in a `'use client'` component, reading AAL from the cookie
snapshot. The mutation is a direct `PUT /auth/v1/user` to GoTrue, authorised by
nothing but the access token.

An AAL1 session holder who never renders the component calls the endpoint
directly. Secondary defect in the same gate: `:61` short-circuits on
`aal?.nextLevel !== 'aal2'` **before** `listFactors()` at `:65`, so a stale
cookie decides in both directions.

This is the only account-mutating operation in the repo with no server-side
enforcement, and `AGENTS.md` coding rule 8 requires one.

**Fix**: move the write behind a `'use server'` action that calls
`assertMfaVerified(createServerClient())` and returns `{ error, reason }` — the
shape `src/lib/actions/settings.ts:30-31` already uses and
`src/lib/store/settings.ts:112-122` already consumes. Read live `listFactors()`
before deciding.

### 0.3 MFA enrol / disable has no step-up at all

`src/components/account/MfaSettings.tsx:96` (`enroll`), `:83` and `:137`
(`unenroll`), `:182` (`unenrollFactor`) all call `supabase.auth.mfa.*` from the
browser. No server observes these at all, so there is nothing to add a check to —
GoTrue authorises on the session alone.

A session obtained by stealing only the password can **permanently remove the
account's 2FA**. Unlike 0.2 this is not a soft control: unenrolment is
unrecoverable by the user, and per `docs/mfa.md:121-126` the only exit is an
out-of-band dashboard reset.

**Fix**: require AAL2 before rendering the panel and perform
`unenroll`/`enroll` in a `'use server'` action against a server client that calls
`assertMfaVerified` first. At minimum, gate `/account?tab=settings` on the same
live-factor step-up the write paths use, so an AAL1 session cannot reach the
buttons.

### 0.4 A phone-only factor is a permanent dead-end loop

`src/lib/mfa-guard.ts:65-70` counts a verified factor in **any** modality bucket
(`totp`, `phone`, `all`). Both `src/app/account/page.tsx:69-71` and
`src/app/auth/mfa/page.tsx:135` require a verified **TOTP** factor. For an
account whose only verified factor is `phone`:

1. a mutation runs → `step_up_required` → `requireAdminClient` throws
   `MfaStepUpRequired` (`src/app/admin/actions.ts:59-63`);
2. `OrderStatusSelect.tsx:80-93` renders "Complete the security check";
3. `/auth/mfa` mount gate: AAL says step-up needed, `listFactors()` returns one
   verified `phone` factor, `:135` fails → `no-factor`;
4. `:158` fires `router.replace('/account?tab=settings')`;
5. `/account` gate: no verified TOTP → **no redirect**, page renders;
6. user retries the write → step 1. **Forever.**

This is the four-hop class `docs/mfa.md:69-77` says the redesign eliminated, and
it is pinned by the test suite: `src/lib/__tests__/mfa-guard.test.ts:190-199`
asserts a phone-only factor **is** `step_up_required`, locking in the half of the
disagreement that produces the loop.

**Fix**: decide the factor question in one place. Either filter the guard to
`factor_type === 'totp'` at `:65-70` and invert the phone-only test case, or let
`/auth/mfa` render a real page for the non-answerable case and **delete the
hardcoded redirect at `:158`** — that redirect is what closes the loop.

### 0.5 A "never asked" contact can be emailed directly

`src/lib/actions/crm.ts:1464` — `if (contact.do_not_email)`. `NULL` is falsy, so
a tri-state `NULL` row passes straight through to Resend. Migration
`20261005020000` made `NULL` reachable and `20261005010000` gives every
profile-signup and store-order contact exactly that value, so this is the
*common* case for new contacts, not an edge case.

Every other path agrees on the tri-state: `resolveBroadcastRecipients`
(`crm.ts:288`), the Edge Function (`crm-broadcast-send/index.ts:241`), the count
(`crm.ts:2370`), and `isInAudience` (`crm-filters.ts:52`). Direct email is the
sole exception — and it makes `docs/crm-operations.md:572-573` false, which claims
the invariant is "enforced in four places … via `.eq('do_not_email', false)`".

The UI compounds it: `CRMDetailClient.tsx:761,781,800,815` all use truthiness, so
a never-asked contact sees an enabled send form on the same panel whose select
reads "Never asked — not in the audience" (`:335`).

**Fix**: `if (contact.do_not_email !== false)` at `crm.ts:1464` and in the four
component sites. Extend the refusal test at `crm-mutations.test.ts:303` with a
`do_not_email: null` row — it only seeds `true` today, which is why this passed.

### 0.6 "Apply Saved Segment" ignores `seg.consent` and announces success

`src/components/admin/crm/CRMBroadcastComposer.tsx:676-689` reads
`seg.statuses/districts/tags` and toasts `Segment "X" applied`. A segment saved
from the directory's "Opted Out of Email" view carries `consent: 'opted_out'`;
applying it produces chips that resolve to the **opted-in** people — the exact
opposite of the segment — with a success toast.

`seg.query` got an explicit warning and a `(search only — not applicable here)`
label at `:684,696`. `consent` got neither, and a consent-only segment is
labelled fully applicable.

**Fix**: extend the option label and the toast to `seg.consent`.

### 0.7 The app can deploy before the schema it calls

`src/app/contact/actions.ts:160` ships `p_consent_to_email` to
`submit_contact_submission`. The fifth parameter only exists at
`20261005020000:149-155`. PostgREST resolves an RPC by exact named-argument set,
so against a database that still has the four-argument version this is
`PGRST202`, and `actions.ts:164-166` turns it into **"Failed to send message.
Please try again later."** for every visitor.

Nothing orders the two deploys: `supabase.yml:19-23` triggers on `supabase/**`
and its `migrate` job is not a dependency of anything else; the Vercel deploy is
not in this repository. `AGENTS.md` records the precedent — `supabase.yml` pushed
migrations at 20:56 on 2026-10-04 while its sibling job failed on a type error.

The e2e suite cannot catch it: `actions.ts:135` short-circuits the RPC under
`isE2EMode()`. The same race degrades `saveCRMsegment` and `mergeCRMContacts`.

**Fix**: land the schema first, in its own commit, and merge the app behind it.
Document the ordering in the commit message so a partial failure is not followed
by a re-push.

### 0.8 `apply-migrations.mjs` may not be transactional

`20261005020000:147` drops the four-argument `submit_contact_submission`; `:149`
creates the five-argument one. `scripts/apply-migrations.mjs:106` posts the whole
file as one script. If that endpoint is not a single transaction, a failure at
`:149` leaves **both** arities gone — and `anon` has no INSERT policy on
`contact_submissions` (dropped at `20260922050000:98`), so the contact form is
completely dead rather than degraded.

**Fix**: confirm the endpoint's atomicity, or wrap the file in explicit
`BEGIN;` / `COMMIT;`. Cheap insurance against the one finding that can take the
contact form down.

---

## Tier 1 — reachable, and the failure is visible or bounded

| # | Finding | Fix |
|---|---|---|
| 1.1 | `fetchContactPage` (`crm.ts:497`) falls back FTS→ILIKE on **any** empty page, so a search whose page 2 is empty returns page 1 count 50 and page 2 count 500 | gate on `result.error \|\| (page === 1 && !result.data?.length)`; add a test paging a search with an empty second page |
| 1.2 | `markCRMBroadcastFailed` (`crm.ts:1998-2006`) evaluates its guard on a read and writes with `.eq('id', …)` only — a `finish()` in between marks a delivered campaign `failed` with `failed_count = 0` | add `.in('status', ['queued','sending'])` + `.select('id').maybeSingle()`, reporting "that campaign finished while you were deciding"; test by mutating rows between read and write |
| 1.3 | The 360 tasks panel caps at 50 (`crm.ts:873,908-915`) and renders the capped number as the total — a contact with 80 follow-ups reads "Follow-ups (50)" | the activities panel next to it already has `activityCount` + truncation flag; give tasks the same treatment |
| 1.4 | `getCRMSegments` caps at 50 (`crm.ts:764-773`) with no count and no pager — and an unreachable segment is also undeletable, because `CRMContactList.tsx:490-520` only lists what the read returned | page it, or raise the cap with a truncation notice. This is the drafts failure the docs claim was fixed, not carried to segments |
| 1.5 | `merge_crm_contacts` (`20261005030000:127-181`) updates five columns, so the duplicate's `phone`, `address`, `city`, `zip_code`, `district` and `status` are silently lost. `status` is the sharp one: `crm_stats()` counts donors by `total_donated_cents > 0`, so the contact still counts as a donor that no `status`-filtered audience can select | carry the fields, or record them in the `crm_activities` row the merge already writes, and update the combination-rule list at `docs/crm-operations.md:779-787` |
| 1.6 | Two deliberate policies disagree: `crm.ts:1174-1181` keeps `unsubscribed_at` when consent is restored ("restoring consent is not erasing the evidence"), while `20261005030000:173-178` sets it to `NULL` whenever merged consent is `false` or `NULL`. The merge is the one that loses information | decide once, apply to both |
| 1.7 | `state_unknown` ships the message "MFA verification required. Please complete 2FA." (`mfa-guard.ts:91`), which `UserSettings.tsx:156` prints *and then* the "hard reload" advice at `:175-179` — telling the volunteer to do both | give the catch-all its own message; update `mfa-guard.test.ts:157` |
| 1.8 | A rejected promise leaves the MFA challenge permanently disabled — `setLoading(true)` at `page.tsx:164` then three bare awaits, any of which skips `setLoading(false)`. The mount gate's `checkAal()` at `:145` has no `.catch()` either | `try/catch/finally`, the shape `MfaSettings.tsx:167-176` already gets right |
| 1.9 | TOTP input has no expiry awareness and no whitespace tolerance — `"123 456"` truncates to `"123 45"` at `maxLength={6}`, and a mistyped code leaves the consumed code in the box | strip `\D`, `slice(0,6)`, clear on rejection, static "codes change every 30 seconds" hint |
| 1.10 | `requireAdmin()` drops `?next=` (`admin-auth.ts:27`), so an admin step-up lands on `/account` instead of `/admin` — with the order status still unsaved | thread the path through as `?next=`; the challenge re-validates it |

---

## Tier 2 — the invariants exist but nothing enforces or uses them

These are the findings where the branch *built the right abstraction* and then
did not route the code through it. Each is a documented lesson in this repo.

### 2.1 `isInAudience` and `consentLabel` are dead exports

`src/lib/crm-filters.ts:51` is documented as "the rule every send path depends
on, expressed once" — and **no send path calls it**. The resolver inlines
`.eq('do_not_email', false)` (`crm.ts:288`), the Edge Function has its own copy
(`index.ts:241`, and it cannot import across the Deno boundary), the count uses
`.not(…, 'is', false)` (`crm.ts:2370`). `consentLabel` (`:228`) is likewise
unused; the three strings live in `CRMDetailClient.tsx:335-337` and
`CRMContactList.tsx:397-406`.

So the module owns the *mappings* but not the *invariants*. That is what lets
0.5 exist. Route the resolver through `isInAudience`, import `consentLabel` in
both components, and either delete the unused pair or stop implying enforcement
that no code performs.

### 2.2 `splitList` is duplicated verbatim

`src/lib/actions/crm.ts:206-212` and `src/lib/crm-filters.ts:73-79` are the same
function in two files. `splitList` should import the helper — that is the
module's whole stated purpose.

### 2.3 The composer recomputes `pageRange` inline

`CRMBroadcastComposer.tsx:1566-1567` hand-rolls the arithmetic and omits
`pageRange`'s zero-case handling (`crm-filters.ts:213-218`). Import it.

### 2.4 The quick pills read draft state; everything else reads applied

`CRMContactList.tsx:475` builds from `draftFilters()`; the pager (`:904`), export
(`:192`) and save-segment (`:245`) all use `appliedFilters()`. Type a name, do
not press Apply, click "CA-06 Local" → the typed name goes out with the pill. The
comment at `:466-472` should say which is intended.

### 2.5 `admin-auth.ts` is unmeasured

`vitest.config.mts:63-75` added `mfa.ts`, `mfa-guard.ts`, `crm-filters.ts`,
`crm-limits.ts` and `safe-redirect.ts` — but not `admin-auth.ts`, which holds the
redirect-vs-throw decision `docs/mfa.md:73` calls load-bearing. Same omission
class as `crm.ts` before it. Add it to `include` and a suite asserting
`step_up_required` → redirect, `state_unknown` → throw, `not_authenticated` →
redirect. It imports `next/navigation`, so `vi.mock` it.

### 2.6 The middleware change ships with zero effective coverage

`middleware.ts:66-70,95` adds an `/auth/mfa` bounce. Its only test
(`e2e/mfa-challenge.spec.ts:113-123`) sits inside the credential-gated describe
and needs **no credentials** — so it never runs, which is every repository today.

### 2.7 The new e2e CRM test writes real rows with no environment guard

`e2e/admin-authenticated.spec.ts:66-108` creates, edits and **hard-deletes** a
real `crm_contacts` row against whatever `NEXT_PUBLIC_SUPABASE_URL` points at.
`isE2EMode()` blocks sends and redirects contact notifications, but
`saveCRMContact` / `deleteCRMContact` are unguarded. A failure between create and
delete leaves the row. `AGENTS.md` has two mechanisms for "no test may send email"
and none for "no test may write production data".

### 2.8 The e2e fault-rendering test needs credentials it does not need

Same file, same describe. Rendering a fault is the one MFA behaviour that needs no
seeded user.

### 2.9 Six pre-existing migrations fail the strengthened guard, with no baseline

`scripts/hooks/sql-security-definer-guard.mjs` is **fixed** by this branch — from
"any `SET search_path`" to "must be `=''`" (`:63`) plus a body-qualification check
(`:82-87`). Correct. But run over the whole directory it now exits 1 with six
findings in committed SQL:

```
20260922000000_civic_crm.sql:158                (declares = public)
20260922200000_crm_realtime_triggers.sql:9,88,163
20260923140000_crm_fixes.sql:19,121
```

`lefthook.yml:49` passes `{staged_files}`, so this only bites the day someone
touches one — but `AGENTS.md` treats a green gate as proof of conformance. Apply
the `scripts/secrets-baseline.json` ratchet pattern the repo already uses for the
same problem.

### 2.10 Dead intermediate migration state

`010000:78-148` creates `fn_sync_contact_submission_to_crm()`; `020000:255-336`
replaces it with a version that also writes `do_not_email`. The first declaration
contributes nothing except the `search_path` pin the second also has — exactly the
trap `010000`'s own header (`:66-69`) warns about, applied in reverse. On a
partial apply the opt-in-by-default bug survives while `010000`'s header reads as
though it were fixed. Fold function #1 into `020000`.

### 2.11 Small correctness gaps

- `crm.ts:1820-1823`, `1903-1906` write `status: 'failed'` without
  `failed_count`, so the row reads "N recipients, none accepted, none rejected"
  rather than "nothing was attempted".
- `markCRMBroadcastFailed` has no `test_only` guard; the composer hides the
  control for test rows but the action will still mark one failed.
- `crm.ts:1260` — the CSV import pre-check has no `.limit()`.
- `supabase-mock.ts:304-308` — `.not(col, op, value)` with a non-`is` operator
  pushes a filter that is then evaluated as `IS NOT`, so `.not('x','eq','y')`
  against a declared `filterRows` silently gets inverted semantics. Reject the
  push.
- `supabase-mock.ts:247-252` — an empty `if (options?.count) {}` reads as an
  unfinished branch.
- `20261005030000:75-77` — the `NOT FOUND` test checks the `FOR UPDATE` at `:73`,
  not the intended `SELECT` at `:83`, so the race raises "the contact being kept
  does not exist" instead of "already been merged".
- Directory page size is a literal in three places (`page.tsx:51`, `crm.ts:522`)
  while the broadcast sizes moved to `crm-limits.ts`.
- `countPages` and `totalPages` are aliases used by different components; pick
  one.
- Every admin page runs `assertMfaVerified` **twice** (layout + page) — ~6 extra
  round trips per render against the Fluid CPU budget. Hoist into a `cache()`-wrapped helper.
- `notify-contact/index.ts:216,246` — both Resend fetches have no `AbortSignal`,
  unlike every other outbound call in the repo.

---

## Tier 3 — documentation that is wrong in ways that will be trusted

`docs/mfa.md` is the authoritative spec for this surface and the repo treats such
docs as load-bearing. These are the claims that are false as written:

| Claim | Reality |
|---|---|
| "All five go through `assertMfaVerified()` except the update-password page, which is a client component and asks the question itself" (`:51-53`) | True as prose and **the reason 0.2 looks solved**. It is also why the table lists a client gate as if it were a server gate. |
| "Five places" (`:45`) | Omits `middleware.ts`, which this branch turned into a sixth gate surface |
| "A fault now throws and a fault is shown as a fault" (`:73`) | `/account` **redirects** on a factor-list error (`page.tsx:62-68`) while `requireAdmin` throws — two behaviours, one sentence |
| "The live read happens instead of AAL" | It happens *after* the AAL gate, not instead of it. `/account` and `update-password` both short-circuit on AAL before `listFactors()` |
| "abandoning it left a factor holding the only way into the account" (`:145-146`) | An `unverified` factor is not a way in — the guard itself ignores it (`mfa-guard.ts:70`). The fix is right; the stated stakes are not |
| auth-js claim pinned to `2.115.0` (`:113`) | `package.json` says `^2.115.0`; a lockfile bump silently invalidates the strongest claim in the doc and nothing re-derives it |
| "the panel says so" about recovery (`AGENTS.md:842-843`, `docs/mfa.md:131-133`) | Verified by grep: "dashboard" appears in `src/` only in a code comment. No backup codes exist (correct) but a volunteer with one factor and no device is told neither what happened nor that a chapter organiser can unblock them |

Four statements elsewhere rest on a security premise that is no longer true — that
`contact_submissions` has a `WITH CHECK (true)` INSERT policy for `anon`. **It was
dropped at `20260922050000:98` and never recreated.** The conclusion (pin the
path) is right; the stated mechanism is wrong, and it is repeated in an
authoritative hook header (`sql-security-definer-guard.mjs:18-22`) where the next
reader will treat it as fact:

- `20261005010000:13-18`
- `scripts/hooks/sql-security-definer-guard.mjs:18-22`
- `src/lib/__tests__/crm-sync-trigger-migration.test.ts:8-12`
- `AGENTS.md`, in the `sql-security-definer` follow-up

Two more fictional statements:

- `20261005020000:221-222` says "the constraint above would reject it". There is
  no constraint above — `:67-75` explicitly says it is *not* constrained. A
  dangling reference to a non-existent constraint is the kind of thing a later
  editor "restores".
- `20261005000000:69-71` justifies re-creating `idx_crm_contacts_tags` by saying
  `getCRMExistingTags` "pages the table to collect distinct tags on every CRM page
  load. Without an index that is two sequential scans." A **GIN index cannot
  serve that query** — `crm.ts:2260-2263` is a plain ordered scan with no tag
  predicate. The index already existed (`20260922000000:58`), so the statement is
  a silent no-op, and its one performance claim is false. A future reader will
  believe the tag scan is index-backed.

Smaller: `mfa-guard.test.ts:237-251` is named *"does not match a subclass that
merely inherits the name"* but asserts `toBe(true)`, i.e. that it **does** match —
only the title is wrong. `no-session` (`page.tsx:22,159,216`) has three
references and zero producers. `not_authenticated` (`mfa-guard.ts:54`) is
unreachable from every caller. `useRef(createClient())` at `page.tsx:69` and
`update-password/page.tsx:24` evaluates `createClient()` on every render and
discards the result.

---

## Tier 4 — verified correct, do not re-litigate

Recorded so the next reviewer does not re-derive it.

**CRM**

- **Opt-out invariant, exhaustively.** Broadcast resolver, Edge Function
  resolver and recipient count all use `IS FALSE` (or its exact complement
  `IS NOT FALSE`), and `count + excludedCount` is a true partition. Unsubscribe
  `GET` writes nothing; `POST` opts out. CSV import carries the value through.
  The contact-form trigger writes `NOT COALESCE(consent_to_email,false)`. Merge
  tri-state OR is correct in all three branches including `both NULL → NULL`.
  WALL-E reads no `crm_contacts` at all. **0.5 is the only hole.**
- **Filter completeness.** All five dimensions (`q`, `status`, `district`, `tag`,
  `consent`) plus `page` reach a query only through `crm-filters.ts` — pills,
  segment chips, export, save-as-segment, pager and the page's parse. No inline
  `URLSearchParams` remains. `consent=unasked` survives the URL round trip.
  `filterParams` correctly omits `page`.
- **Ordering.** Every paged query has a total order ending on a unique column.
  Count and page come from the same statement in every paged read (except 1.1).
- **Bounded reads.** Every `.select()` carries `.limit()`, `.range()`,
  `head: true`, or `.single()`. Four capped reads report truncation to the user.
  `pageRange(0, …)` returns `[0,0]`.
- **Timeouts.** All three previously-unbounded waits are now bounded: dispatch
  15 min (`crm.ts:2043`), per-recipient Resend 20 s (`index.ts:349`), client poll
  15 s (`composer:263-266`). The dispatch timeout is shared with
  `markCRMBroadcastFailed`'s refusal window by construction, so they cannot drift.
- **State machine.** `crm_broadcasts_status_check` permits exactly
  `draft, queued, sending, sent, failed` — every value any path writes. The
  sender's claim is a conditional update on `.is('dispatched_at', null)`, so
  re-dispatch is structurally impossible. `saveCRMBroadcastDraft` is scoped
  `.eq('status','draft')`. `test_only` is decided on its own (`index.ts:193`),
  closing the "preview mails the whole list" hole. `activityRowsLost` correctly
  captures length before splice.
- **Mock fidelity.** `.eq(col,null)`, `.neq`, `.in`, `.is`, `.order` + `.range`
  with multi-key stability, insert/update/delete with `RETURNING`, and
  `PromiseLike` are all modelled correctly. `.or`/`.contains`/`.textSearch` return
  **no rows** without a declared `filterRows`, so forgetting to declare fails
  loudly. The four remaining argument assertions are all justified — `rpc`
  arguments and the HTTP body (no rows exist), `orderCalls` (a count is identical
  under any ordering, which is the documented double-mail regression), and
  `filterCalls` (filter-string contents are invisible in rows).

**Migrations**

- Every referenced column, table, constraint and function exists. Ordering is
  correct in all four dependency directions. All four files are re-runnable
  (`IF NOT EXISTS` / `IF EXISTS` / `OR REPLACE` throughout) and **zero `CREATE
  POLICY` statements**, so neither the re-apply failure nor the role-OID orphaning
  bug applies. `search_path = ''` is correct in all six new definer functions and
  every relation in every body is `public.`-qualified.
- `010000`'s central claim — that the three re-declared bodies are otherwise
  byte-identical to the versions in force — is **true**, verified by diffing
  against `20260922200000` (two of them) and `20260923140000` (the third, not the
  `20260922200000` original). The `0`-insert + separate-UPDATE donation fix and
  the `LIMIT 1` profiles fallback are preserved.
- `crm_segments.consent`'s CHECK matches `CONSENT_STATES`. `crm_activities` already
  permits `'merge'`. `crm_contacts` has no `deleted_at`, so the merge RPC's lack
  of soft-delete handling is correct. Every name the TypeScript depends on exists:
  no orphans.

**MFA**

- Only `step_up_required` earns a redirect — pinned as a property at
  `mfa-guard.test.ts:266-271`. A `listFactors` failure does not redirect anywhere.
  TOTP-only is filtered on `factor_type` at **both** the mount gate and the submit
  handler. `MfaFailureReason` is exhaustive with all four values produced and
  consumed. `state_unknown` fails closed everywhere.
- The discriminant is an `error.name`, not a message string, and
  `mfa-guard.test.ts:222-235` proves a message-identical ordinary `Error` is
  rejected. `MfaFailureReason` and `MFA_STEP_UP_ERROR` correctly live in
  `mfa-guard.ts`, not in a `'use server'` module, per coding rule 9.
- **No backup codes exist** anywhere — no generation, no storage, no UI offering
  them. The single repo-wide hit is `docs/mfa.md:123` stating their absence.
- All 12 admin actions, all 10 content actions and all ~24 `requireAdmin()` sites
  enforce the step-up server-side. `OrderStatusSelect.tsx:34-53` is the correct
  shape: controlled select, try/catch, reverts to the server-confirmed value, and
  distinguishes a step-up request from a fault. `login/page.tsx` never inspects
  AAL, so the gate correctly fires on the destination.
- `docs/mfa.md:109-113`'s correction to the `adfdcf6` commit message is **correct**
  and verified in the installed `@supabase/auth-js@2.115.0` source: both branches
  of `_getAuthenticatorAssuranceLevel` filter `status === 'verified'` before
  returning `aal2`.
- Both e2e specs skip unconditionally by default at describe scope, with messages
  naming every missing variable. All five secrets are declared in `ci-env.mjs` and
  `secrets-registry.mjs`. **No email can be sent from either spec.**
  `mfa-challenge.spec.ts:152-185` asserts the RFC 6238 SHA-1 vectors in the
  *unskipped* block — the right call, since vitest excludes `e2e/**`.
  `e2e/helpers/totp.ts` is correct: `BigInt` avoids 53-bit precision loss and
  `binary` is masked to 31 bits so the modulo can never go negative.

**Docs and repo hygiene**

- `check-doc-claims.mjs` re-derives all 11 numeric claims from their sources of
  truth, including the 135 spec count and the two coverage floors. The new
  `include` entries in `vitest.config.mts` are a genuine ratchet, not a widening.
- The `sql-security-definer-guard.mjs` diff is a **fix**, not a weakening.

---

## Suggested order of work

Four commits, each independently green, each with the migration-before-app
ordering from 0.7 explicit in its message.

1. **`fix(security): validate the value safe-redirect returns`** — **implemented
   and verified, not yet committed**
   Tier 0.1 + restore the two deleted assertions + the three dot-segment cases.
   Smallest diff in the plan, highest reachability. Ships alone.

2. **`fix(mfa): gate the two writes GoTrue performs from the browser`** — **implemented
   and verified, not yet committed**
   Tier 0.2, 0.3, 0.4, 1.7-1.10, 2.5, plus the `docs/mfa.md` corrections in Tier 3
   that belong to this step. 0.7 (deploy ordering) and 0.8 (migration atomicity)
   are process, not code, and are recorded in step 4's commit message. 2.6/2.8
   (credential-free middleware/fault tests) remain open — see below.

   What changed:
   - `updatePasswordAction` (`account/update-password/actions.ts`, new): the
     write goes through `assertMfaVerified` on the server; the page's client
     gate stays as UX and now handles `reason === 'step_up_required'` from a
     stale-cookie disagreement by showing the prompt instead of an error box.
   - `unenrollMfaFactorAction` (`lib/actions/settings.ts`): verified-factor
     removal requires AAL2; unverified cleanup stays client-side (it was never
     a way in). The panel renders the step-up link on refusal and clears the
     stale reason on every other path.
   - Guard and challenge agree on TOTP (`mfa-guard.ts`, `auth/mfa/page.tsx`):
     the `no-factor` redirect is gone, so the shell renders; the phone-only
     cases assert *no* step-up in both suites.
   - `requireAdmin` redirects to `/auth/mfa?next=/admin` (was bare).
   - Challenge `handleSubmit` is `try/finally` with code-clear on rejection;
     the input strips non-digits; `checkAal()` has a `.catch()`; the
     `state_unknown` catch-all no longer asks for a code.
   - `admin-auth.test.ts` (new, 10 tests) pins redirect-vs-throw; `admin-auth.ts`
     joins the coverage `include` list. `settings-action.test.ts` gains 9 tests
     for the unenroll action plus the password length boundary.
   - `docs/mfa.md`: seven gates (was five), both behaviours named where
     `/account` and `requireAdmin` differ, the guard/challenge agreement
     recorded, the `^2.115.0` range stated as a range, the cancel-dialog stakes
     corrected, and the recovery line the panel now actually carries.
   - `MfaSettings` single-factor panel and the manual-entry hint now name the
     chapter organiser as the recovery path.

   Verification: every new assertion was run against the unfixed code —
   mfa-guard phone cases, the `?next=/admin` redirect (2 failures without it),
   the unenroll gate (2 failures without it). `tsc` clean, 1238+ tests pass,
   coverage exit 0 with `settings.ts` at 97.67/94.11/100/100 (the new action
   briefly dragged it to 67/64/50/74 before its suite landed — recorded so the
   dip is not re-discovered).

   Still open in this step: 2.6/2.8 — the middleware `/auth/mfa` bounce test and
   the fault-rendering test live inside the credential-gated describe while
   needing no credentials. Moving them out is a small, separate change; it has
   not been done yet.

3. **`fix(crm): consent, the merge, and the directories it can lose`** — **implemented
   and verified, not yet committed**

   What changed:
   - `sendCRMDirectEmail` now refuses `do_not_email !== false` (was truthiness):
     a never-asked contact can no longer be mailed. `CRMDetailClient`'s send
     form, its disabled states, and its banner all use `!== false` too.
   - Segment apply in the composer now warns on `seg.consent === 'opted_out'`
     or `'unasked'` (was: silent + success toast resolving to opted-in people).
   - `fetchContactPage` FTS→ILIKE fallback is gated on `page === 1` (was: any
     empty page, so a search whose FTS filled one page silently switched
     predicates mid-pagination).
   - `markCRMBroadcastFailed` scopes its write to `.in('status', ['queued','sending'])`
     + `.select('id').maybeSingle()` (was: read-then-write race could mark a
     delivered campaign failed). Also refuses `test_only` rows.
   - `markCRMBroadcastFailed` and both dispatch-failure paths now write
     `failed_count` (was: `failed` with no count, reading as "N recipients,
     none accepted, none rejected").
   - 360 tasks panel gets `taskCount` + `openTaskCount` + `tasksTruncated`
     (was: capped at 50, rendered as total). Activities panel already had it.
   - `getCRMSegments` now returns `{ segments, truncated }` with `SEGMENT_LIMIT = 500`
     (was: silently capped at 50, unreachable segments also undeletable).
   - `splitList` deduplication into `splitActiveValues`; `pageRange` used in the
     composer instead of inline arithmetic; pills build on `appliedFilters()`
     not `draftFilters()`.
   - `isInAudience` is now called in `resolveBroadcastRecipients` as a
     defense-in-depth row filter alongside the query predicate.
   - `sendCRMDirectEmail` NULL-consent test added; FTS-fallback-page-2 test added;
     `markCRMBroadcastFailed` test_only + race tests added; task-count/open-count
     tests added; `getCRMSegments` truncation test added; `getCRMContacts`
     error-path test added.
   - `fn_sync_contact_submission_to_crm` removed from 010000 (dead intermediate
     declaration — the 020000 version is the one that writes `do_not_email`).
   - `merge_crm_contacts` FOUND-guard reordered: each SELECT now immediately
     follows its own existence check (was: the second SELECT overwrote FOUND
     before the first check ran, so the error message named the wrong case in
     the documented race).
   - `supabase-mock.ts`: `.not(col, op, value)` no longer pushes a `notIs`
     filter for non-`is` operators (was: silently inverted semantics); the
     empty `if (options?.count) {}` block is now a prose note.
   - crm.ts coverage floor holds at 89.8/78.27/100/94.01 (was 89.38/78.51/100/93.53).

   Still open from the plan (both **blocked on the two design questions**):
   1.5 — merge drops `phone`/`address`/`city`/`zip_code`/`district`/`status`.
   Bring them forward (needs a per-field precedence rule) or accept the loss
   and document it — your call.
   1.6 — `unsubscribed_at`: `crm.ts:1174` deliberately keeps it on re-consent;
   `030000:173` deliberately clears it. Both pinned by tests. One loses
   information. Your call.

4. **`docs: correct four stale claims this branch introduced`** — **implemented
   and verified, not yet committed**
   Everything in Tier 3, including the anon-policy premise in four files and the
   GIN-index rationale. Zero code risk, and it is the tier most likely to be
   dropped if it rides along with the others.

   Done: anon-policy premise corrected in `010000`'s header (via the function-fold
   comment), `sql-security-definer-guard.mjs:18-22`, and AGENTS.md follow-up #12;
   the fictional constraint reference at `020000:221-222` replaced with a prose
   explanation; the GIN-index rationale at `000000:69-71` corrected (it claims to
   serve a query it cannot); the `mfa-guard.test.ts:290` title now matches what
   the assertion does; both `useRef(createClient())` sites replaced with
   `useMemo`.

   Still open (process, not code):
   - **0.7 — deploy ordering**: the schema must land before the app deploys.
     `submit_contact_submission`'s fifth parameter only exists at 020000, and the
     app ships it immediately — a deploy before the migration turns the contact
     form into "Failed to send message" for every visitor. Land the migrations in
     their own commit first.
   - **0.8 — `apply-migrations.mjs` atomicity**: **fixed, with the defect
     sharper than first assumed.** The open question was whether the Management
     API's query endpoint wraps a batch in a transaction — unknowable from here,
     and the same either way. The real defect was local and needed no such
     answer: the migration and the row recording it were **two separate
     requests** (`await api(sql)` then `await api(INSERT …)`). If the second
     failed, the schema was applied and unrecorded, so the next run re-applied a
     migration that had already succeeded — fatal for anything not written to be
     re-runnable, and `20261005010000` is exactly that, replacing
     `submit_contact_submission`'s arity via `DROP`/`CREATE`. The schema would be
     correct, the retry would fail identically forever, and every later migration
     would queue behind it. Both now travel in one explicitly `BEGIN;`…`COMMIT;`
     batch, which is correct whether or not the endpoint wraps it itself:
     `BEGIN` inside an open transaction is a warning, not an error, and the
     trailing `COMMIT` still commits. Four tests in
     `src/lib/__tests__/apply-migrations.test.ts` pin it — one asserts the shape
     directly, one asserts no query contains a schema change without its history
     row (a request count would still pass if the batch were split per
     statement), and both were confirmed to fail against the two-request version.
     The script also exports `main(env)` behind a direct-invoke guard now, so its
     delivery path is reachable from a test at all — it was a floating
     `main().catch()` at module scope before.
   - **2.6/2.8 — credential-free e2e tests**: **implemented.** Both tests moved
     into their own top-level describes outside the `test.skip`-gated ones:
     `the challenge is not reachable without a session` is now in
     `MFA step-up challenge without a seeded session`, and
     `an unauthenticated context still redirects` is in `unauthenticated
     redirects`. An unseeded project now actually runs them rather than skipping
     them inside a green block.
   - **2.9 — guard baseline**: **implemented.** `scripts/sql-guard-baseline.json`
     accepts the six findings in committed SQL (`20260922000000:158`,
     `20260922200000:9,88,163`, `20260923140000:19,121`), fingerprinted by
     `file:line`. The guard reports them as KNOWN and exits 0; only a *new*
     finding fails. Regenerate with
     `bun scripts/hooks/sql-security-definer-guard.mjs --update-baseline supabase/migrations/*.sql`.

---

## Verification — step 1

Every gate re-run after the change, on the working tree as it now stands:

| Gate | Before | After |
|---|---|---|
| `bun tsc --noEmit` | clean | clean |
| `bun run lint:check` | 1 warning (pre-existing) | 1 warning (pre-existing) |
| `bun run test` | 1217 pass | **1223 pass** (+6 new) |
| `bun run test:coverage` | 90.83 / 83.32 / 97.54 / 93.95 | 90.80 / 83.34 / 97.56 / 93.89 |
| `safe-redirect.ts` measured | not in `include` | 87.5 / 92.3 / 100 / 90.5 |
| `check-doc-claims.mjs` | 11 across 218 files | 11 across 219 files |
| `bun run build` | clean | clean |
| `playwright test --workers=2` | not run | **122 passed, 13 skipped** |

Coverage moved by less than 0.05 points in either direction, which is inside the
noise of the four extra assertions' branches — worth stating rather than
presenting as a change.

**The fix was verified by breaking it.** `git checkout src/lib/safe-redirect.ts`
against the new tests:

```
× rejects a dot segment that normalises into an authority
× rejects a traversal that stays on-origin rather than escaping it
```

and against the challenge page's suite:

```
× rejects ?next= carrying a literal traversal rather than navigating off-origin
× rejects ?next= carrying an encoded traversal rather than navigating off-origin
× rejects ?next= carrying a traversal behind a real path rather than navigating off-origin
```

Five failures, then green again on restore. A security fix whose test passes
against the unfixed code proves nothing, which is why this was run in both
directions.

**One incidental fix.** `safe-redirect.test.ts` was `git`-binary: four literal
control bytes (`NUL`, `DEL`, vertical tab, form feed) sat in the `CONTROL_CASES`
array, in a file whose own comment says *"Written as escapes rather than
literals: a raw NUL or DEL in a source file makes it binary to every reader."*
The comment was right and the bytes disagreed with it. Replaced with `\0`,
`\x7f`, `\v`, `\f`, which is what the file has always claimed — and which is why
`git diff --stat` now shows a line count for this file instead of `Bin`. The
assertions themselves are unchanged and still pass.

**Not committed.** Every other file in the changeset is uncommitted too, so
committing this one file alone would still not produce the isolated commit the
plan asks for. That needs either a `git stash`-based extraction or a decision to
commit the whole branch. Say which and I'll do it.

---

**Two questions for you before I start step 2**, because both are decisions
rather than mechanical fixes and both are expensive to reverse:

- **1.5** — should the merge carry the duplicate's `phone` / `address` / `city` /
  `zip_code` / `district` / `status`, or record them in the activity row it already
  writes? Carrying them needs a documented precedence rule per field.
- **1.6** — which `unsubscribed_at` policy is correct? `crm.ts:1174-1181` keeps
  the timestamp (evidence of a past unsubscribe is not erased by re-consenting);
  the migration clears it. They cannot both be right.
