# Two-Factor Authentication

How 2FA works in this codebase, what each gate does, and why several of them
exist in the shape they do. Read this before changing anything under
`src/app/auth/mfa/`, `src/lib/mfa-guard.ts`, or `src/components/account/MfaSettings.tsx`.

Supabase GoTrue owns the factors. This site owns three things: which surfaces
require a step-up, what the user is told when they cannot pass it, and what
happens when the answer is "they have no authenticator at all".

---

## The two assurance levels

`getAuthenticatorAssuranceLevel()` returns two values, and confusing them is the
source of most of the bugs this file records:

| | Meaning | Set by |
|---|---|---|
| `currentLevel` | What this session proves | Sign-in |
| `nextLevel` | What this account could prove | The verified factors on the user |

A session with 2FA enrolled is **AAL1** after sign-in and **AAL2** after
`mfa.verify()`. The upgrade is written to the session cookies by GoTrue, so it
persists across a reload — it is not client-side state.

```
signInWithPassword ──▶ AAL1 session ──▶ gate fires ──▶ /auth/mfa
                                                       │
                                            challenge + verify
                                                       │
                                              /account, AAL2 session
```

**The step-up is not part of signing in.** `login/page.tsx` never inspects AAL and
never mentions MFA. The gate fires on the *destination* route, which is why the
same account lands differently depending on where it was headed.

---

## Where the gate lives

Seven places, and they are not interchangeable.

| Surface | Gate | On failure |
|---|---|---|
| `/account` | `account/page.tsx` | `redirect('/auth/mfa?next=…')`, **or redirect to `/auth/mfa`** when the factor list itself cannot be read |
| `/admin/*` (pages) | `requireAdmin()` in `lib/admin-auth.ts` | redirect to `/auth/mfa?next=/admin`, **or throw** for a fault |
| `/admin/*` (actions) | `requireAdminClient()` in `app/admin/actions.ts` | `throw` with `name = 'MfaStepUpRequired'` |
| account settings writes | `assertMfaVerified()` via `actions/settings.ts` | `return { error, reason }` |
| `/account/update-password` | `updatePasswordAction` via `account/update-password/actions.ts` | `return { error, reason }`; the page renders the step-up prompt on `step_up_required` |
| verified-factor removal | `unenrollMfaFactorAction` via `actions/settings.ts` | `return { error, reason }`; the panel renders the step-up link on `step_up_required` |
| `/auth/mfa` itself | `middleware.ts` matcher | `redirect('/login?next=…')` for a visitor with no session at all |

All seven go through `assertMfaVerified()` (`src/lib/mfa-guard.ts`). The
password page and the factor panel are client components, so each has a client
gate too — a step-up prompt rendered *before* the volunteer types — but those
gates are UX, not enforcement: the write goes through the server action either
way. A table that lists a client gate as if it were a server gate is how the
password rotation shipped with no enforcement while reading as guarded.

### `assertMfaVerified` returns a reason, not just an error

```ts
type MfaFailureReason =
  | 'not_authenticated'   // no session
  | 'unavailable'         // this client exposes no MFA API
  | 'state_unknown'       // factors or AAL could not be read — a fault
  | 'step_up_required';   // enrolled, verified factor, AAL1 session
```

Only `step_up_required` is answerable by a code. Everything else is a fault, and
`isStepUpChallenge()` is the single place that decides.

**Why this matters.** `requireAdmin()` used to redirect on *every* non-ok result.
So a `listFactors` failure on an admin page redirected to `/auth/mfa`, which
could not read its own factors either, pushed to `/login`, and middleware bounced
the still-signed-in user off `/login` to a gated route. Four silent hops, no
message, no way out. A fault now throws from `requireAdmin()` and is shown as a
fault — while `/account` still *redirects* on a factor-list error, because a
server component there has no error boundary that can render the fault inline.
Two behaviours, one sentence would be a lie; the table above says which is
which.

`state_unknown` still **fails closed** — an outage must not become a write path.
The cost is that a Supabase blip locks a user out of `/admin` until it clears,
which is the correct trade for a surface holding other people's data.

---

## Which factors can be answered

The challenge page answers **TOTP only**, and filters on `factor_type`.

`listFactors().all` mixes `totp`, `phone` and `webauthn`. Picking the first
verified factor of *any* type and rendering a 6-digit box means:

- a phone factor gets an SMS from `challenge()`, and
- the digits the user then types fail `verify()` permanently, with no explanation.

Both the mount gate and the submit handler filter to
`factor_type === 'totp'`. A verified non-TOTP factor produces a page that names
what the account actually has rather than an unanswerable form.

The guard asks the same question. It used to count a verified factor in *any*
modality bucket while both pages required TOTP, so an account whose only
verified factor was a phone was caught in a permanent loop: the guard said
`step_up_required`, the challenge said `no-factor`, `/auth/mfa` redirected to
`/account`, whose gate declines to redirect precisely because there is no TOTP
factor to answer with — and retrying the write returned to the guard. The
`mfa-guard.test.ts` suite pinned the guard's half of the disagreement, which is
how the loop survived review. Now `assertMfaVerified` requires a verified TOTP
factor (in `totp` or in `all` with an explicit `factor_type`), and a phone-only
account passes the gate rather than being sent somewhere it cannot arrive. That
is weaker than demanding a second factor, and it is honest: the alternative is a
requirement no interface the site offers can satisfy.

---

## Why the gates read live factors and not just AAL

`getAuthenticatorAssuranceLevel()` reads `session.user.factors` from the **cookie
snapshot**. `listFactors()` calls `getUser()` and reads **live** `/user` factors.

When they disagree — 2FA unenrolled from another browser after this session was
issued — an AAL-only gate redirects to a challenge the user cannot pass, producing
an endless "Invalid TOTP code". Both `/account` and `/auth/mfa` therefore read
`listFactors()` before rendering a code box — *after* the AAL gate, not instead
of it. AAL is checked first and the live factor read second: a stale cookie
saying AAL1 sends the volunteer to the challenge unnecessarily (annoying,
safe), while a stale AAL2 shows the form and the server action refuses the write.
Either order fails safe; the live read is what makes the common case kind.

### A correction to a commit message

`adfdcf6` ("only challenge with a verified TOTP factor, not AAL alone") states
that Supabase "can still report `nextLevel='aal2'` if the user started (but never
finished) enrollment". That is **not reachable** on the installed
`@supabase/auth-js` (`^2.115.0` in `package.json`):
`_getAuthenticatorAssuranceLevel` filters `status === 'verified'` before returning
`aal2` (`GoTrueClient.js`, both the JWT and cookie paths). The version is a
range, not a pin, so a major SDK bump can invalidate this claim — nothing
re-derives it, which is why it is stated with the range attached rather than as
a bare number.

The fix in that commit is correct and worth keeping. The cause it names is the
snapshot-vs-live divergence described above. The comment above the gate now says
so, because a wrong rationale in an authoritative file is worse than no rationale.

---

## Recovery is a second factor

There are **no backup codes and no recovery codes**. A volunteer who loses their
only authenticator is locked out, and the only exit is an out-of-band `unenroll`
in the Supabase dashboard.

The mitigation is that a second factor is now supported: `MfaSettings` lists every
verified TOTP factor with its own removal, and "Add another authenticator" is
offered alongside. Losing one device is then survivable.

The panel states this conditionally — with one factor enrolled it says so
explicitly, because the failure it prevents is silent and total.

### Enrollment details worth knowing

- **Issuer** comes from `SITE_NAME` in `src/config/site.ts`, not a literal. It is
  the label every user sees in their authenticator app.
- **`friendlyName`** is chosen from the labels already in use, so two factors are
  distinguishable when deciding which to remove.
- **Manual entry** is exposed. `data.totp.secret` was available from the
  enrollment response and being discarded; a camera that will not focus, a laptop
  with no working camera, and a password manager that cannot read a QR all land
  on that path — and the alternative was being locked out with no way to enroll.
- **Cancelling the dialog unenrolls the in-progress factor.** Supabase allows one
  in-progress enrollment per user, so abandoning it left a stale unverified
  factor blocking every later enrollment attempt until someone cleared it. (An
  unverified factor is not a way into the account — the guard ignores it — so
  the stakes were a wedged setup flow, not a lockout.)
- **The verify button disables while in flight.** It used to stay enabled, so a
  second click issued a second `challenge()` against a factor already mid-challenge.

---

## Local development cannot reach any of this

`supabase/config.toml`:

```toml
[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false
```

That is the **local CLI stack only** — the hosted project has its own settings in
the dashboard. It means the entire MFA flow is unreachable against a local
database, which is why `e2e/mfa-challenge.spec.ts` drives the hosted test project
through a seeded admin rather than a local one.

---

## Tests

| Suite | What it can and cannot see |
|---|---|
| `src/lib/__tests__/mfa-guard.test.ts` | The decision, with a mocked client. Every `reason`, every fail-closed path, TOTP in either bucket — and the phone-only cases asserting *no* step-up, which is what keeps the dead-end loop from returning. |
| `src/lib/__tests__/admin-auth.test.ts` | The redirect-vs-throw decision: `step_up_required` redirects with `?next=/admin`, a fault throws, a signed-out visitor goes to sign-in. Two of its assertions fail against a bare `/auth/mfa` redirect. |
| `src/lib/__tests__/mfa.test.ts` | The `otpauth://totp/` prefix validator. |
| `src/app/auth/mfa/__tests__/MfaChallengePage.test.tsx` | The rendered gate: which factors render a box, the explained (not bounced) `no-factor` state, `?next=` handling including the dot-segment cases, and the submit path's own re-filter. |
| `e2e/mfa-challenge.spec.ts` | The thing no unit test can: that GoTrue actually upgrades the session to AAL2 and the destination gate then lets the page through. |

`mfa.ts`, `mfa-guard.ts` and `admin-auth.ts` are in `vitest.config.mts`'s
`include` list and carry the global 90% threshold. Each was previously in
neither, despite having a dedicated suite — a suite that exists is not a gate
that runs.

### The e2e spec needs five seeded secrets

`E2E_MFA_ADMIN_EMAIL`, `E2E_MFA_ADMIN_PASSWORD`, `E2E_MFA_TOTP_SECRET` (plus the
plain `E2E_ADMIN_*` pair for the non-MFA admin). All optional; the spec
`test.skip`s when they are absent rather than weakening an assertion.

`E2E_MFA_TOTP_SECRET` is a base32 seed and is the most sensitive of the five: it is
a *current* credential for an admin account at every 30-second step, with no
expiry. A real enrollment reveals it exactly once, at QR-scan time, which is why
it must be seeded and not captured.

The codes are derived locally — HMAC-SHA1 over the 30-second counter, ~20 lines in
`e2e/helpers/totp.ts`, no dependency and no network call. The RFC 6238 SHA-1
vectors are asserted **in the e2e suite**, because vitest excludes `e2e/**` and
the helper has to be verified somewhere.

A skipped auth suite is not a passing suite. Treat it as an uncovered path.

---

## Things not to "fix"

- **Do not redirect `/auth/mfa` on an auth error.** That is the loop. Render the
  fault with a retry and say what happened.
- **Do not widen the guard's lock** to `getAuthenticatorAssuranceLevel()` alone.
  That reintroduces the stale-snapshot challenge.
- **Do not use `window.confirm()` on this surface.** It asks a blind question and
  cannot be automated, so everything behind it goes untested — which is why every
  destructive action here goes through `ConfirmAction`.
- **Do not treat a `state_unknown` as a prompt for a code.** It is a fault, and a
  volunteer sent to `/auth/mfa` on a Supabase blip is a volunteer who cannot sign
  in and has no idea why.
