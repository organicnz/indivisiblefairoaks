# Mobilize event sync

Issue #153: the chapter's organizer posts events on [Mobilize](https://www.mobilize.us),
and the site's `/events` calendar should pick them up without anyone retyping
them.

This document covers what runs, what it is allowed to change, and how to answer
"which events should we take?".

---

## The shape

```
pg_cron (every 30 min)
  └─► pg_net.http_post  ──►  Edge Function `sync-mobilize-events`
                              ├─ reads mobilize_settings + mobilize_event_rules
                              ├─ GET api.mobilize.us/v1/organizations/93/events?…
                              ├─ filters, maps, upserts into public.events
                              ├─ refreshes every imported row by id
                              └─ writes a mobilize_sync_runs row
```

The admin tab at **`/admin/events → Mobilize`** runs the *same* preview code
against the live API, so what it lists is what the sync imports.

### Why the public API, and not an embed

Mobilize publishes an open, keyless JSON API (`https://api.mobilize.us/v1`).
There is no oEmbed endpoint (`/oembed/` returns 404), their ToS §7 prohibits
framing, and §3(d) prohibits HTML extraction. An iframe would also be useless
here: its contents cannot feed the homepage gathering card, cannot be filtered by
the calendar's category chips, and cannot produce the Google Calendar / `.ics`
links.

The sync therefore reads only `/v1` JSON, stores a short plain-text summary, and
links every card back to `browser_url`.

---

## The scope, and where it lives

**The chapter has no Mobilize organization of its own.** Every event the site
links (`1011420`, `1072857`, `903494`, `967302`) is sponsored by the *national*
Indivisible org, id **93**, and `mobilize.us/indivisiblefairoaks/` does not
exist. So "watch our org feed" is not a filter — org 93 has thousands of events
nationwide. The scope lives in `mobilize_settings`:

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | master switch; off means the function returns immediately |
| `org_id` | `93` | the national Indivisible org |
| `zipcode` / `max_dist` | `95608` / `25` | distance filter, measured from the chapter's ZIP |
| `locality_allowlist` | Sacramento, Carmichael, Fair Oaks, Citrus Heights, Orangevale, Rancho Cordova, North Highlands, Antelope, Folsom, Gold River | the only geographic truth — 25 miles from Carmichael reaches Roseville and Elk Grove |
| `include_virtual` | `false` | virtual events have no location for a radius to bite on; when enabled they are queried with `state=CA` |
| `high_priority_only` | `false` | Mobilize's "pinned" flag. It returned **0** events in this area at launch, which is why it is not the default |
| `auto_publish` | `true` | reserved for a review-queue mode; the sync currently imports in-scope events directly |

Two query details are load-bearing:

- **`organization_id` as a query param**, not just the path segment. The path
  alone includes events the org merely *promoted*, which is how the national No
  Kings calls (sponsored by org 42198) would arrive.
- **`timeslot_start=gte_now`**, so a finished series drops out of discovery.

### Per-event rules

`mobilize_event_rules` holds a human's answer for one event:

| `action` | Effect |
|---|---|
| `pin` | include it even if every filter rejects it — this is how a single national virtual call is added without opening up the other 51 |
| `exclude` | keep it out permanently, even if it matches |

Rules outrank all filters, in both directions too.

---

## What the sync owns

| Column | Written on insert | Written on refresh |
|---|---|---|
| `title`, `date_label`, `time_label`, `starts_at`, `ends_at` | yes | yes |
| `location_name`, `address`, `rsvp_url`, `external_url` | yes | yes |
| `description` | yes | **no** — an editor may have shortened it |
| `category`, `highlight`, `sort_order` | yes | **no** — curation is a human's |
| `is_hidden` | `false` | set to `true` on a 404 or when no upcoming timeslot remains, and **never** back to `false` |

`sync_locked = true` means "leave this row alone entirely". Editing a
Mobilize-sourced row from the admin sets it automatically — otherwise a corrected
title would be overwritten within the half hour.

### Duplicate guard

The `events` table already holds hand-made rows whose `rsvp_url` points at the
same events (the choir protest, the monthly gathering). An import first looks for
a row whose RSVP link matches the Mobilize event id and **converts** it — setting
`source`, `external_id`, `external_url` — rather than inserting a second card.
A converted row keeps its slug and `sort_order`.

### Multiple timeslots

A Mobilize event can carry a whole series (the monthly gathering has six). The
calendar models one row per event, so the mapper takes the **next upcoming
timeslot** and rolls forward after each occurrence. Six cards for one meeting is
the failure this avoids.

### Private addresses

Mobilize returns the literal string
`This event's address is private. Sign up for more details` for a hidden venue.
The mapper turns that into `Locality, CA` with an empty street address; the
sentence is never rendered as a venue and never stored as an address.

---

## Setup

1. Apply the migration — the `supabase.yml` workflow runs `supabase db push`
   (with `scripts/apply-migrations.mjs` as its IPv4 fallback), so a merge does
   this for you.
2. Deploy the function — `.github/workflows/supabase.yml` does this, with JWT
   verification **on**.
3. Store the cron credential in Vault:

   ```bash
   bun scripts/seed-mobilize-cron.mjs --dry-run              # preview; key masked
   bun scripts/seed-mobilize-cron.mjs --db-url "$DB_URL"    # database password
   bun scripts/seed-mobilize-cron.mjs                       # or SUPABASE_ACCESS_TOKEN
   ```

   Until this runs, the scheduled command is a no-op: it resolves its URL and key
   from Vault at run time and posts nothing when they are absent. The key is never
   written into `cron.job.command`.

   **The scheduled path is the only thing that waits on this.** The admin
   **Sync now** button runs server-side in Next with `SUPABASE_SECRET_KEY`, so it
   imports events immediately, with Vault still empty.

   The `--db-url` transport exists because the Management API token is not always
   available and the database password usually is. Both paths run the same single
   `do` block — `supabase db query` rejects a multi-statement file with *"cannot
   insert multiple commands into a prepared statement"*, which is why the SQL is
   one statement rather than four.

No new dashboard secret is required for the function itself: it reads only
platform-injected values and a public API.

---

## Answering "which events should we take?"

Send `/admin/events → Mobilize` to whoever owns the Mobilize account. It shows:

- every event the current filters admit, and every one they reject **with the
  reason** (`Outside the city list`, `Virtual — off`, …);
- the same list for a pasted Mobilize feed link — the feed URL generator's
  `zipcode`, `max_dist`, `is_virtual` and `high_priority_only` params are the
  API's own names;
- a per-event **Pin** / **Exclude** control.

Changing the scope is a settings edit. Changing it in code should never be
necessary for "which cities" or "virtual or not".

---

## Deploying the function by hand

CI deploys from source (`supabase functions deploy`), which bundles
`_shared/mobilize.ts` and strips type-only imports. A single-file upload through
the Management API does neither, and it fails in a way that looks like a code bug
rather than a packaging one:

> `{"code":"BOOT_ERROR","message":"Function failed to start"}` with HTTP 503

### If you have a PAT, use the CLI — it is the same deploy CI runs

```bash
SUPABASE_ACCESS_TOKEN=sbp_… bunx --bun supabase functions deploy sync-mobilize-events \
  --project-ref mojsubkqjdruhpxbzgme --use-api
```

`--use-api` is not cosmetic on a machine without Docker: the default path bundles
in the `edge-runtime` container, and this flag moves the bundling server-side. It
uploads both `index.ts` and `_shared/mobilize.ts`, which is what makes the CLI
route correct rather than merely convenient.

`supabase projects list` is the cheapest way to test a token, and its two failure
modes mean different things: **401** (`Invalid access token`) is a token the API
does not recognise — revoked or expired; **403** is a real token that is not
allowed to make that call. A PAT that returns 401 cannot be fixed by scope.

### The fallback, for when no token is available

The function's first line is `import 'jsr:@supabase/functions-js/edge-runtime.d.ts'`
— a **type-only** import. The CLI drops it; a single-file upload ships the
specifier and the runtime tries to execute a `.d.ts`. Because the function also
imports `../_shared/mobilize.ts`, a single-file upload needs a bundle first:

```bash
./node_modules/.bin/esbuild supabase/functions/sync-mobilize-events/index.ts \
  --bundle --minify --format=esm --platform=neutral --target=esnext \
  --external:npm:@supabase/supabase-js@2 \
  --external:jsr:@supabase/functions-js/edge-runtime.d.ts \
  --outfile=/tmp/sync-mobilize-events.js
```

…then delete the `import "jsr:…edge-runtime.d.ts";` statement from the output
before uploading. Verify before you upload by booting the bundle locally — it
should answer `{"error":"Unauthorized."}` and nothing else:

```bash
deno run -A /tmp/sync-mobilize-events.js   # then POST to :8000
```

A deployed bundle is minified, so `get_function_body` returns minified code.
That is cosmetic: the repo is the source of truth, and the next CI deploy
replaces it with a fresh build from source.

---

### What a run row means

A row is opened when work starts and closed either way: on success with the
counters, and on failure with `finished_at` **and** `error`. A row whose
`finished_at` is null therefore means a run is in flight — not that the schedule
is wedged.

The 20-minute throttle counts only runs that **finished without error**. That is
deliberate: a transient Mobilize failure should not also cost the next half-hour
tick, and a `force: true` invoke from the admin tab bypasses the throttle
entirely. Without both halves, one thrown error left a row that never closed and
then suppressed the next scheduled attempt until its own timestamp aged out — the
schedule recovering on a timer rather than on having actually recovered.

---

## Troubleshooting

| Symptom | Look at |
|---|---|
| Nothing new appears | `mobilize_sync_runs` — is `enabled` true, did runs happen, what does `error` say? |
| A run did not happen | `select * from cron.job_run_details where jobname = 'sync-mobilize-events' order by start_time desc limit 5;` |
| The HTTP call failed | `select * from net._http_response order by created desc limit 5;` (kept 6 hours) |
| An event vanished | `select slug, is_hidden, sync_locked, last_synced_at from events where external_id is not null;` — hidden rows are restorable from the admin tab |
| An edit was overwritten | check `sync_locked`; editing from the admin should have set it |
| A virtual event was not picked up | `include_virtual` is off by default — pin the individual event instead |
| `BOOT_ERROR` / HTTP 503 | a hand upload kept the type-only `jsr:` import, or shipped `index.ts` without `_shared` — see *Deploying by hand* |
| Sync now works, the schedule does not | Vault is empty: `select name from vault.decrypted_secrets where name like 'mobilize%';` and run the seed script |
| `db push` refuses: *"Remote migration versions not found in local migrations directory"* | the history holds versions with no matching file, usually from an MCP `apply_migration` that stamped wall-clock names instead of the file's. `supabase migration list --db-url …` shows them; `supabase migration repair --status reverted <version> …` clears them |

Supabase Free retains Edge Function logs for **one day**, which is why every run
is recorded in `mobilize_sync_runs` rather than relied on from logs.

---

## Testing the pieces without the network

- `src/lib/__tests__/mobilize.test.ts` — mapping, filtering, URL parsing, and the
  private-address and multi-timeslot cases, against fixtures captured from the
  live API.
- `deno check --config supabase/functions/deno.json supabase/functions/*/index.ts`
  type-checks the function, including the shared module.
