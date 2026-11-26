---
name: ice-crawl-and-evidence
description: >-
  Project-specific rules for the approved-source ICE crawler, the DOJ resumable
  cursor, the ice-evidence bucket, and any change to crawl budgets, relevance
  filtering, image storage paths, or orphan cleanup. Use when editing
  src/lib/ice-crawl*.ts, src/app/api/ice-crawl/run/route.ts, the ice_crawl_*
  tables or migrations, scripts/seed-ice-alert-cron.mjs, or docs about ICE
  source ingestion.
---

# ICE source crawl and evidence images

This is a **project-specific skill**, not a vendored one. It is not in
`skills-lock.json`; edit it when an invariant changes. The full runbook is
[`docs/ice-source-crawl.md`](../../../docs/ice-source-crawl.md). Read it before
touching the bucket or the cursor.

## Load this when

- Changing `src/lib/ice-crawl.ts`, `ice-crawl-justice.ts`,
  `ice-crawl-images.ts`, `ice-crawl-store.ts`, or `ice-crawl-extract.ts`.
- Changing `/api/ice-crawl/run`, its cron seed, or the `ice_crawl_*` schema.
- Changing the 35-second tick budget, the 12-page DOJ window, relevance terms,
  or the frontier cursor.
- Auditing, migrating, or deleting objects in the private `ice-evidence`
  bucket, or changing how image paths are built.
- Writing docs or tests about approved-source ingestion.

## Non-negotiables

1. **The deadline is the budget.** A scheduled tick has 35 seconds inside a
   60-second function. `MAX_TICK_PAGES = 400` is only a runaway guard. Do not
   raise the page window to reach older material; persist the frontier.
2. **The frontier is the cursor.** The DOJ walk stores one URL in
   `ice_crawl_frontier` for the next page. On the next tick a lone cursor page
   at or beyond page 12 expands into the normal 12-page window. Do not add a
   numeric `last_page` column or a second queue.
3. **Filter DOJ releases at extraction.** `relevance_terms` match title and
   teaser only. Body mentions are context, not admission. An empty term list
   returns nothing, not the unfiltered department feed.
4. **Advance the cursor only from a drained window.** A budget stop leaves the
   remaining pages queued; a failed high-water page leaves the cursor retryable.
   The cursor is a high-water mark, not a complete gap-repair ledger.
5. **Current image paths are image-keyed.**
   `ice-evidence/<source_id>/<dedupe_key>.webp`. The pre-fix shape has a
   `<page_id>/` segment. Pre-fix paths are valid where a row references them.
6. **An orphan is an object with no exact `storage_path` row.** A pre-fix shape
   alone is not evidence of an orphan. Never delete a referenced object to
   normalize its path.
7. **Delete exact paths through the Storage API.** Never delete a folder or
   `storage.objects` directly. Re-query the exact candidate paths immediately
   before deletion; abort on any row. Verify missing-object rows after.
8. **The bucket is private and service-role only.** No public URLs, no anon
   policy, no object path in client code.

## What the loop does

```text
POST /api/ice-crawl/run?mode=sources&limit=2   (*/10 cron, 35s budget)
  -> select enabled sources, least-recently-crawled first
  -> resume frontier (budgeted only)
  -> expand a lone DOJ cursor into 12 pages
  -> fetch / extract / filter / publish reports
  -> capture up to two preview images per report page
  -> save remaining frontier, then clear visited URLs
  -> save next DOJ cursor if the window drained and a successor exists
  -> record the tick
```

A manual run is not budgeted: it starts from the seed, uses the source's
`max_pages`, and saves no cursor. Preserve that distinction.

## Evidence image shape

- Download is public-URL guarded, 8-second timeout, 5.5 MB ceiling, at most
  three redirects.
- Re-encode is WebP, long edge 1400 px, quality 72, EXIF rotation applied,
  metadata dropped.
- `dedupe_key = sha256(image_url + "|" + downloaded bytes length)`.
- Upload is `upsert: true`, but the unique `dedupe_key` means one row owns the
  provenance. If the row insert fails, remove the uploaded object best-effort.
- `hasIceCrawlPageImage` checks `image_url`; a revisited page does not download
  the image again.

## Audit / cleanup shortcut

The full SQL is in the runbook. The sequence is:

1. Count bucket objects and bytes; count `ice_crawl_page_images` rows.
2. List pre-fix-shaped objects and mark each referenced or unreferenced.
3. Sum referenced vs orphan objects and bytes.
4. Re-query the exact orphan paths in `ice_crawl_page_images`; must return 0.
5. Remove exact paths through `storage.from('ice-evidence').remove(paths)`.
6. Re-list, re-sum, and assert no row points at a missing object.

The completed 2026-11-26 audit removed 27 objects / 973,674 bytes and kept 10
referenced pre-fix objects / 123,542 bytes. The bucket went from 290 objects /
11,577,488 bytes to 263 / 10,603,814; the 262 rows were unchanged. Those are a
historical record, not current counts.

## Tests and checks

```bash
bun --bun vitest run \
  src/lib/__tests__/ice-crawl-cursor.test.ts \
  src/lib/__tests__/ice-crawl-justice.test.ts \
  src/lib/__tests__/ice-crawl-extract.test.ts

bun --bun tsrs --noEmit
bun scripts/check-doc-claims.mjs
git diff --check
```

The cursor tests are the regression gate for the budget/cursor contract. There
is no test for bucket deletion; the exact-path re-check is the control.

## Common mistakes

- Treating `max_pages` as the way to reach older DOJ pages. It is a manual-run
  bound; the frontier is the resumable path.
- Re-fetching pages 0–11 on every tick while backfilling. The cursor deliberately
  walks older windows until the API ends, then re-seeds the newest window.
- Matching `ICE` against the release body. That is how unrelated drug or
  immigration releases become "ICE activity".
- Writing the image path as `<source_id>/<page_id>/<hash>.webp` in new code.
- Deleting a pre-fix object because the current code would not create that path.
  The row still points at it.
- Deleting the whole `<source_id>/` prefix. It contains current image-keyed
  objects too.
- Treating a `storage.objects` row as the bytes. Deleting it does not remove the
  object.
