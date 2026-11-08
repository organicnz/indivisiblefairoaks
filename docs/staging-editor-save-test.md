# Staging editor save test

> Status: **blocked on environment**. The test harness exists, but this machine
> has no isolated staging Supabase project, no admin credential, and no Docker
> for a local stack. Do not work around it by granting admin on production.

## Why the current "staging" host is not enough

`e2e/admin-authenticated.spec.ts` records that staging and production share one
Supabase project. The host may be a preview, but the database is the real one.
A save test there writes real content and revisions. That is why the admin
suites are read-only and opt-in.

## What already exists

| Piece | What it does | What it still needs |
|---|---|---|
| `e2e/auth.setup.ts` | Signs in through the real form and writes `e2e/.auth/admin.json`. | `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` for a non-MFA admin. |
| `e2e/admin-authenticated.spec.ts` | Reads `/admin/crm`, `/admin/content`, broadcasts, a11y. | The same session; skips without it. |
| `e2e/admin-content.spec.ts` | Proves logged-out users never see CMS rows. | Nothing — this half runs today. |
| `scripts/seed-e2e-users.mjs` | Find-or-creates the two e2e auth users, rotates passwords, writes `.env.local`. | It **cannot** grant `is_admin`; the trigger blocks it (see below). |
| `e2e/.auth/no-admin-grant` | Marker written when sign-in works but the grant is missing. | Removed by a successful setup run. |

## The admin grant is deliberately not API-settable

`profiles_block_priv_esc` (`supabase/migrations/20260922050000_security_hardening.sql`)
raises unless `public.is_admin()` is true for the caller. That is false for
service-role API calls **and** for the dashboard SQL editor, where `auth.uid()`
is null. The seed script's printed one-line `update` therefore fails there too.

On a fresh staging project, bootstrap the first admin as the project owner by
disabling the trigger for exactly one statement, then re-enable it:

```sql
alter table public.profiles disable trigger profiles_block_priv_esc;
update public.profiles set is_admin = true where email = 'e2e-admin@example.com';
alter table public.profiles enable trigger profiles_block_priv_esc;
```

Run this only in the staging project's SQL editor. Never put it in a migration,
an app action, or a script that can point at production.

## Option A — dedicated staging project (recommended)

1. Create a Supabase project used only for staging; record its ref.
2. Link and apply the checked-in schema:
   ```bash
   supabase login
   supabase link --project-ref <staging-ref>
   supabase db push
   ```
3. Use a **separate checkout** so the production `.env.local` is never touched:
   ```bash
   git clone <repo> indivisiblefairoaks-staging
   cd indivisiblefairoaks-staging
   bun install --frozen-lockfile
   ```
4. Put only staging values in that checkout's `.env.local`:
   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3101
   NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging publishable key>
   SUPABASE_SECRET_KEY=<staging secret key>
   NEXT_PUBLIC_SENTRY_DSN=
   ```
5. Seed the auth users (this writes `E2E_ADMIN_*` into the same `.env.local`):
   ```bash
   bun scripts/seed-e2e-users.mjs
   ```
6. Apply the trigger-bypass SQL above, then confirm:
   ```sql
   select email, is_admin from public.profiles where email like 'e2e-%';
   ```
7. Build with the staging values baked in, then let Playwright start the server
   on its own port:
   ```bash
   NEXT_PUBLIC_SITE_URL=http://localhost:3101 bun run build
   E2E_PORT=3101 bun run test:e2e e2e/admin-authenticated.spec.ts
   ```
   `playwright.config.ts` loads `.env.local`, and the shell environment wins, so
   the suite and the server see the staging project.
8. Reset the staging project (or delete the two e2e users and their profiles)
   when finished. It is disposable by design.

## Option B — local Supabase

`supabase start` gives the cleanest isolation, but it needs Docker. Docker is
not installed on this machine, so this option is documentation only until it is:

```bash
supabase start
supabase db reset          # applies supabase/migrations/*
# use the local API URL and keys printed by `supabase status`
```

Then follow Option A from step 3, substituting the local URL and keys. The
trigger bypass is still required; local `supabase db reset` runs migrations as
the owner, but it does not seed an admin.

## The save assertion

The admin suite proves the surfaces render; it does not write content. The
smallest real save test, on staging only:

1. Sign in as the seeded admin and open `/events`.
2. Turn on visual editing, click the **Trainings & Action Labs** copy region
   (not the page background), edit one sentence, and Save.
3. Reload and confirm the sentence persists and the row's `updated_at` moved.
   That region has no row yet, so the first save inserts it; save once more and
   confirm a revision appears for `copy-events-trainings`.
4. On a coded page with no copy region (for example `/voter-info`), click the
   page text: it must refuse and name the region, with **Whole page**, **Save**
   and **Connect** disabled. This is the regression the click-time guards fixed.
5. Delete the test row in staging if a new page was created; never delete
   `copy-*` rows that predate the test.

Done means: the edit survives a reload, the revision is recorded, the coded-page
refusal is visible, and no request failed in the browser console.

## Current blockers on this machine

- `docker` is absent, so `supabase start` cannot run.
- `.env.local` contains only the production project; there is no staging ref.
- No `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` exists, and `e2e/.auth/no-admin-grant`
  records the missing grant.
- Granting admin to the existing production e2e user is a production data
  change and has not been done.

To unblock: create the staging project and put its keys in a staging checkout
(not in this one), then run the steps above. No credential needs to be pasted
into chat.
