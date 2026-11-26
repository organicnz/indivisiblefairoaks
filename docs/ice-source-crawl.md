# ICE source crawl and evidence images

> Operational reference for the approved-source crawler, the DOJ resumable
> cursor, and the private `ice-evidence` bucket. Read this before changing
> `src/lib/ice-crawl*.ts`, the `ice_crawl_*` tables, `/api/ice-crawl/run`, or
> anything that deletes an object from that bucket. The operating skill is
> [`.agents/skills/ice-crawl-and-evidence/SKILL.md`](../.agents/skills/ice-crawl-and-evidence/SKILL.md).

This is not the surge-alert pipeline. Surges are computed from the community
feed in [`docs/ice-alert-notifications.md`](./ice-alert-notifications.md);
official releases are context and never create a surge. The reunification
bucket is separate and has its own policy in
[`docs/ice-reunification.md`](./ice-reunification.md).

## What runs

The crawler reads the admin-approved rows in `ice_crawl_sources`, fetches each
source, extracts reports, and stores them in `ice_source_reports`. It also
records page-level provenance in `ice_crawl_pages` and captures a publisher's
social-preview image into the private `ice-evidence` bucket with a row in
`ice_crawl_page_images`.

The persisted queue is `ice_crawl_frontier`; the run history is
`ice_crawl_ticks`. Nationwide discovery is separate: it queues candidates for
admin confirmation and does not publish an unapproved source.

The scheduled entry point is `POST /api/ice-crawl/run?mode=sources&limit=2`,
seeded by [`scripts/seed-ice-alert-cron.mjs`](../scripts/seed-ice-alert-cron.mjs)
to run every ten minutes. It selects enabled sources least-recently-crawled
first, so the limit rotates instead of re-crawling the same first row.

## The tick budget is the contract

`/api/ice-crawl/run` has `maxDuration = 60`. The sources-only mode passes a
**35-second** budget; the remaining time covers the page in flight, extraction,
images, and the summary write. Do not raise the per-tick page window to reach
older material — that is what the cursor is for.

Inside `crawlAllIceSources`:

- the 35 seconds are divided across the selected sources;
- a source gets `max(10s, floor(35s / number_of_sources))`, capped by the
  total deadline;
- the rotation stops starting a new source when fewer than 6 seconds remain;
- `MAX_TICK_PAGES = 400` is a runaway guard, not a target;
- discovery intake is capped at 40 URLs per source per budgeted tick;
- article-image lookups are capped at four for the whole tick, shared by every
  source, and stop when less than 12 seconds remain.

A budgeted tick always resumes the persisted frontier. A manual admin run has
no deadline: it starts from the source seed, uses the source's `max_pages`, and
does **not** save a cursor. That difference is deliberate. If a scheduled tick
runs out of time, the rest of its queue is saved for the next tick; if a manual
run hits its page limit, it reports the unfetched URLs and leaves the decision
to the operator.

## DOJ press releases and the resumable cursor

### Why the API, not the site

`justice.gov/news/press-releases`, its article pages, and
`sitemap.xml?page=N` sit behind an Akamai interstitial that returns a
`bm-verify` challenge (or 403). The public JSON endpoint is not challenged:

```text
https://www.justice.gov/api/v1/press_releases.json?sort_by=created&sort_order=DESC
```

It returns 20 releases per page and takes a **zero-based** `page` parameter.
The API is the whole department, including local U.S. Attorney offices, so the
source's `relevance_terms` are not optional. Without terms the adapter returns
nothing rather than turning an unfiltered feed into an unfiltered intake.

The filter runs on **title and teaser only** in
`extractJusticeReleaseItems`. Body text is stored for the report, but a body
mention is not evidence that the release is about ICE: a drug-conspiracy
release that says "immigration" once must not be filed as ICE activity.

### The 12-page window

`JUSTICE_RELEASE_PAGE_WINDOW = 12`. A fresh seed expands into pages 0–11, not
one page, so a single tick can find more than the newest release. The window is
fixed at 12 on purpose; widening it multiplies fetches, image work, and the risk
of missing the 60-second ceiling. `source.max_pages` remains the manual-run
bound, not the cursor mechanism.

### How the cursor works

The cursor is **one row in `ice_crawl_frontier` whose URL is the next DOJ page**.
There is no new column and no second cursor table. The existing frontier already
persists between ticks and already records the URL that must be fetched next.

Lifecycle:

1. A budgeted tick with an empty DOJ frontier expands the seed into pages 0–11.
2. If the window drains and the API reports a successor, the crawler saves one
   URL for `highest parsed page + 1`. Example: pages 0–11 drain, save page 12.
3. On the next tick, a lone DOJ frontier page at or beyond page 12 is expanded
   into the normal 12-page window starting there: pages 12–23. The older window
   is now reachable without enlarging the per-tick window.
4. When that window drains, save page 24, and so on.
5. At the end of the API, `metadata.resultset` says there is no next page. No
   cursor is saved, so the following tick starts again from the newest window.
   If `metadata.resultset` is absent, a full 20-item page is treated as "there
   may be a next page"; a short page ends the walk.

Pages are sorted numerically before fetching because frontier timestamps can
tie. The read is zero-based, so page 12 means the thirteenth page.

`justiceReleaseHasNextPage` uses the API's own totals:
`(page + 1) * pagesize < count`. It does not guess from a truncated result set.

The frontier is written **before** the run summary, and visited URLs are
cleared after the queue write, so a failed summary write cannot lose the
position. A tick that stops mid-window leaves the unfetched pages in the
frontier and does not advance the cursor.

### Limits worth knowing

- **The cursor is a high-water mark, not a gap-repair queue.** The next cursor
  is based on the highest page the tick parsed. A failure at that highest page
  is retried because it was not parsed; a failure lower in the window is not
  revisited by the cursor after the high-water page advances.
- **Backfill ticks are not freshness ticks.** While the cursor is walking older
  pages, a scheduled tick fetches the older window rather than re-fetching pages
  0–11. The newest window is re-seeded only after the API reports the end of the
  feed and the cursor is cleared. This is the deliberate trade-off that keeps a
  fixed 12-page per-tick window while making older releases reachable.
- **Do not add a second cursor store.** A numeric cursor column, a `last_page`
  field, or a parallel table would be a second source of truth for the same
  position and would drift from `ice_crawl_frontier`.

## Evidence images

The crawler stores a publisher's own preview image, not a copy of every logo or
stock photo it passes. Images are captured only for pages that produced at
least one report, with a small shared lookup budget.

### Current object shape

```text
ice-evidence/<source_id>/<dedupe_key>.webp
```

- `dedupe_key` is `sha256(image_url + "|" + downloaded byte length)`.
- The path is keyed by the **image**, not the page. The same preview on several
  pages is stored once.
- `ice_crawl_page_images.dedupe_key` is unique, so the first row owns the
  provenance and later duplicates do not create a second row.
- `image_url` is also an idempotence check: revisiting a page does not download
  and re-encode an image already indexed.
- The bucket is private. There is no public URL and no anon read policy.
- Upload is WebP, long edge at most 1400 px, quality 72, EXIF rotation applied,
  metadata dropped. The download is SSRF-guarded and capped at 5.5 MB with an
  8-second timeout; an image failure must never fail the text crawl.
- The object and its row are one record. If the row insert fails, the upload is
  removed best-effort rather than leaving bytes the index cannot point at.

### DOJ image availability — 2026-11-26

DOJ's API exposes image metadata but did not expose usable image bytes to the
crawler in this audit. A sample of API pages 0–99 (2,000 releases) found zero
non-empty string `image` fields; pages 0–11 (240 releases) were the same. Some
releases carry `image` as an array of file objects; those values contain no URL
and the adapter currently ignores them. Body HTML carried `<img>` tags for 240
of the 2,000 releases, and two existing DOJ reports had a body image. Those
media URLs, the `/media/<id>/...` and
`/file/<id>/...` forms, and DOJ's OPA `og:image` all returned `403` to the
crawler's guarded downloader on repeated attempts. Article HTML returned the
Akamai `bm-verify` interstitial for 13 of the 14 stored DOJ reports; one OPA
article was fetched once in full and exposed only
`themes/custom/usdoj_uswds/images/metatag-image--press-release.png`, DOJ's
generic press-release card rather than a release-specific image.

The DOJ source currently has 186 page rows, 14 reports, and zero
`ice_crawl_page_images` rows. Running `ingestFeedReportImages` six times for
the OPA report, then `ingestIcePageImageUrls` directly with that `og:image`,
returned `stored: 0` and left both the row count and the source's
`ice-evidence/` prefix empty. No backfill was possible: no stored DOJ HTML page
has a usable `og:image`, and the live media bytes are blocked. This is a source
availability result, not evidence that the image path is broken.

### Pre-fix object shape

Before the image-keyed path landed, objects were stored per page:

```text
ice-evidence/<source_id>/<page_id>/<dedupe_key>.webp
```

The unique `dedupe_key` meant only one row survived, but every page could still
write its own copy of the bytes. Those extra per-page copies are the orphan
class this cleanup targets.

**A three-segment path is not automatically an orphan.** Some rows still point
at the pre-fix shape. Those objects are the working copy for their row and must
be kept. Only a pre-fix-shaped object whose exact path appears in **no**
`ice_crawl_page_images.storage_path` is a candidate.

### What "orphan" means here

An orphan is an object in the bucket whose full path is not equal to any
`ice_crawl_page_images.storage_path`. It is not:

- an object with a pre-fix shape that a row still references;
- an object shared by several pages through the same `dedupe_key`;
- an object missing a row because a row was deleted while the bytes remained —
  that is a separate integrity problem and should be investigated, not bulk
  deleted.

The database row is the provenance record. The bucket is the bytes. Do not
delete one to "clean up" the other without reconciling both.

## Orphan audit runbook

Use the Supabase SQL editor (service role) to compare bucket metadata with the
index. `storage.objects` is metadata only; never delete from it directly.

### 1. Snapshot the bucket and the index

```sql
select count(*) as objects, coalesce(sum((metadata->>'size')::bigint), 0) as bytes
from storage.objects
where bucket_id = 'ice-evidence';

select count(*) as rows
from public.ice_crawl_page_images;
```

Record both before touching anything. The byte total is the number you will
reconcile after deletion.

### 2. List every pre-fix object and whether a row points at it

The UUID pattern is exact; adjust only if the ID format changes.

```sql
with pre_fix as (
  select
    name,
    coalesce((metadata->>'size')::bigint, 0) as bytes
  from storage.objects
  where bucket_id = 'ice-evidence'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\.webp$'
),
refs as (
  select distinct storage_path
  from public.ice_crawl_page_images
),
audited as (
  select
    p.name,
    p.bytes,
    exists (select 1 from refs r where r.storage_path = p.name) as referenced
  from pre_fix p
)
select name, bytes, referenced
from audited
order by referenced, name;
```

### 3. Summarize candidates and retained pre-fix objects

```sql
with pre_fix as (
  select
    name,
    coalesce((metadata->>'size')::bigint, 0) as bytes
  from storage.objects
  where bucket_id = 'ice-evidence'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\.webp$'
),
refs as (
  select distinct storage_path
  from public.ice_crawl_page_images
),
audited as (
  select
    p.name,
    p.bytes,
    exists (select 1 from refs r where r.storage_path = p.name) as referenced
  from pre_fix p
)
select
  count(*) filter (where referenced) as referenced_objects,
  coalesce(sum(bytes) filter (where referenced), 0) as referenced_bytes,
  count(*) filter (where not referenced) as orphan_objects,
  coalesce(sum(bytes) filter (where not referenced), 0) as orphan_bytes
from audited;
```

### 4. Re-check the exact candidate paths immediately before deletion

Do not rely on the summary query alone. Materialize the candidate list, then
run a second exact membership query against the live table:

```sql
select storage_path
from public.ice_crawl_page_images
where storage_path in (
  -- paste the exact candidate paths from step 2 here
);
```

It must return **zero rows**. Abort if it returns anything. A page or image row
can be written between the audit and the delete; the second check is the barrier
against deleting a newly referenced object.

### 5. Delete only exact paths

Use the Storage API (or the dashboard's object selection) with the exact path
list. Do **not** delete a prefix or folder: `sourceId/` also contains current
image-keyed objects. Do **not** run `delete from storage.objects`; that removes
metadata without removing bytes and can corrupt the bucket.

The client-side shape used for the cleanup is:

```ts
const { error } = await admin.storage
  .from('ice-evidence')
  .remove(candidatePaths); // exact, fully qualified object names
```

If `error` is set, stop and inspect it. A partial delete is possible; re-list
the bucket before retrying and remove only paths that still exist and still have
no row.

### 6. Verify after deletion

Run the bucket count/bytes query and the pre-fix summary again. Then:

```sql
-- Every path a row points at must still exist in the bucket.
select i.storage_path
from public.ice_crawl_page_images i
left join storage.objects o
  on o.bucket_id = 'ice-evidence' and o.name = i.storage_path
where o.name is null;
```

This must return zero rows. Also confirm the row count is unchanged by the
cleanup; deleting orphan bytes must not delete provenance rows.

Reconcile the byte total arithmetically:

```text
before_bytes - orphan_bytes = after_bytes
```

If it does not, stop. A mismatch means the object list, the size metadata, or the
path set changed during the operation.

## Cleanup run record — 2026-11-26

This is the completed audit that motivated the pre-fix path note. It is a
record, not a promise about current counts.

| Measure | Value |
|---|---:|
| Bucket before | 290 objects / 11,577,488 bytes |
| Pre-fix-shaped objects | 37 objects / 1,097,216 bytes |
| Pre-fix objects still referenced (kept) | 10 objects / 123,542 bytes |
| Pre-fix orphans deleted | 27 objects / 973,674 bytes |
| Bucket after | 263 objects / 10,603,814 bytes |
| `ice_crawl_page_images` rows | 262 before and after |

The pre-delete exact membership query returned zero rows. The post-delete audit
returned zero remaining pre-fix orphans and zero rows pointing at a missing
object. Arithmetic checks:
`11,577,488 - 973,674 = 10,603,814`; the 10 referenced pre-fix objects remain.

## Invariants

1. **The deadline is the budget; the page ceiling is a guard.** A scheduled
   tick must not be widened to reach older pages. Persist the frontier instead.
2. **DOJ relevance is a title/teaser filter at extraction.** Do not move it to
   a later stage where an unfiltered release can reach the report table.
3. **One cursor, one frontier row.** Do not add a numeric `last_page` column or
   a parallel queue. Expand the cursor into the 12-page window.
4. **Do not advance the cursor on budget exhaustion or a failed high-water
   page.** The next tick must be able to resume at the first unparsed page.
5. **Image paths are image-keyed.** Current code writes
   `<source_id>/<dedupe_key>.webp`; pre-fix paths are read-only history unless a
   deliberate migration moves rows and bytes together.
6. **A referenced pre-fix path is not an orphan.** Check
   `ice_crawl_page_images.storage_path` before any delete.
7. **Delete exact paths, never folders, and never `storage.objects`.** The
   Storage API removes bytes; direct table deletes do not.
8. **Rows are provenance.** An orphan scan that deletes a row to make the
   object list clean has destroyed the audit trail.

## Checks

```bash
bun --bun vitest run \
  src/lib/__tests__/ice-crawl-cursor.test.ts \
  src/lib/__tests__/ice-crawl-justice.test.ts \
  src/lib/__tests__/ice-crawl-extract.test.ts

bun --bun tsrs --noEmit
bun scripts/check-doc-claims.mjs
git diff --check
```

The cursor tests cover: a drained newest window leaves page 12; budget
exhaustion does not advance the cursor; a page-12 cursor expands into pages
12–23 and saves page 24. The DOJ adapter tests cover relevance and page
metadata. There is no automated test for bucket deletion — that is why the
runbook's exact-path re-check is mandatory.

## File map

| File | Owns |
|---|---|
| `src/lib/ice-crawl.ts` | Tick budget, frontier expansion, extraction, report publication, cursor save |
| `src/lib/ice-crawl-justice.ts` | DOJ API URL/page metadata, relevance filter, 12-page window |
| `src/lib/ice-crawl-images.ts` | Evidence download, WebP encoding, object path, row/object coupling |
| `src/lib/ice-crawl-store.ts` | `ice_crawl_*` persistence and the frontier queue |
| `src/app/api/ice-crawl/run/route.ts` | Cron auth, 35-second budget, `mode=sources`, `limit` |
| `scripts/seed-ice-alert-cron.mjs` | `*/10` source-crawl schedule and vault-backed URL/secret |
| `supabase/migrations/*ice_crawl*` | Frontier, image index, and watchdog schema |
