# Legacy Google Sites archive

The chapter’s public site ran on Google Sites at
`https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks/`.
Its nine public pages are preserved in two layers:

| Layer | Bucket / tables | Visibility |
|---|---|---|
| Raw captures, screenshots, downloaded originals | `legacy-archive` + `legacy_assets.storage_path` | Private |
| Public page text, cleared files, metadata, links | `legacy_pages`, `legacy_assets`, `legacy_documents`, `legacy_page_links` through `legacy_public_*` views | Public |

Third-party files are never copied to the public bucket. They remain private and
the public archive links to the original source. Unknown-rights files follow the
same rule. An image served from the chapter’s Google Sites image proxy is treated
as chapter media; it is copied privately and, when its MIME type is allowed, to
the public bucket.

Google rotates the signed image-proxy URLs after the capture session. The audit
therefore saves each page image into `<audit-dir>/assets/` while it holds the
page session, and the manifest records `localFile`. The importer reads that local
copy first, so a later import cannot silently fail on an expired URL. Old
audit manifests without `localFile` still fall back to the source URL.

## Commands

```bash
# Read-only inventory; writes tmp/legacy-audit-<date>/ including local image bytes.
bun scripts/legacy-audit.mjs --out tmp/legacy-audit-2026-11-13-local

# Plan only. No network, no writes.
bun scripts/legacy-import.mjs \
  --manifest tmp/legacy-audit-2026-11-13-local/legacy-audit.json

# Stage downloads locally. Still no database or bucket writes.
bun scripts/legacy-import.mjs \
  --manifest tmp/legacy-audit-2026-11-13-local/legacy-audit.json \
  --download --out tmp/legacy-import-local

# Authorized import only. Requires NEXT_PUBLIC_SUPABASE_URL and
# SUPABASE_SECRET_KEY in .env.local. The script prints the host but never the key.
bun scripts/legacy-import.mjs \
  --manifest tmp/legacy-audit-2026-11-13-local/legacy-audit.json \
  --commit
```

`--only /voter-information` limits a run to one legacy path. `--no-download`
records metadata and source links only, without fetching binaries or copying to
the public bucket.

## Placement review

`scripts/legacy-placement-map.json` is the reviewed image map. It is keyed by a
64-bit difference hash, not by the rotating source URL. It records, for each of
the 44 reviewed images, the source page, a human label, and one of three
destinations:

- `mediaObject`: reuse the existing public object under `media/gallery` (31
  image captures in the current audit). One map entry can match more than one
  rotated proxy URL, so this is intentionally larger than the 30 previously
  deduplicated URLs. This avoids uploading a second copy of a photo already on
  the site.
- no `mediaObject`, not `hidden`: upload a new public copy to `legacy-documents`
  (10 images: chapter logo, meeting room, volunteer, six No Kings photos and one
  choir photo).
- `hidden`: preserve only in `legacy-archive` (four QR/blank captures). The
  `/archive` page never renders them.

A Google Docs link preview is also private by URL rule. The staging report lists
every image with its destination and every document with its category, rights
decision, hosted/external status and destination path, so a review can check the
map against the actual downloaded content before any commit.
`legacy_assets.public_url` stores the full media URL when an existing object is
reused; otherwise the query builds the URL from `public_path` in
`legacy-documents`. `legacy_assets.is_public` is true only for a public file or
YouTube embed; an external document is public through `legacy_documents` while
its raw asset row stays private.

## Review and publication rules

1. **Audit first.** The audit captures each page’s text, headings, links, images,
   iframes, screenshots and raw HTML. It compares the current Supabase rows by
   filename, URL and Drive/YouTube ID. Review `legacy-audit-report.md`.
2. **Do not promote third-party material.** `CalMatters`, League of Women Voters,
   ACLU and similar documents are `third_party`; their public row points at the
   original URL. The private copy is for preservation only.
3. **Blocked sources need a human export.** The two sign-in-gated Drive files and
   the restricted MP4 are listed with a reason. They are not silently treated as
   imported.
4. **Page text is the canonical public copy.** Raw HTML is never rendered; the
   archive renders `legacy_pages.body_text`. The audit walks block elements so
   headings, paragraphs and link rows keep their boundaries, which lets the
   chrome filter remove the contact footer instead of leaving it fused to the
   last document name. The import also drops repeated page headings and
   document-filename rows that the archive renders separately. This avoids
   executing old Sites markup and keeps `javascript:`/tracking links out of the
   page.
5. **Image and document URLs are resolved server-side.** The browser receives
   either an existing `media/gallery` URL, a `legacy-documents` public URL or the
   original source URL, never a `legacy-archive` object key.
6. **Old-site navigation is not content.** The audit unwraps Google redirect
   links, removes self-links and the repeated contact footer, deduplicates the
   wrapped/unwrapped form of the same destination, and prefers the clean event
   title over the scraped description.

## Schema

- `legacy_import_runs` records each run and its counts.
- `legacy_pages` is keyed by `source_path`; reruns update the row.
- `legacy_assets` is keyed by `asset_key` (`drive:<id>:<kind>`,
  `youtube:<id>`, or `url:<normalized-url>`).
- `legacy_documents` is the public document index. `asset_id` is the stable
  identity for reruns; the readable slug stays derived from the source filename
  while reviewed display-title overrides can correct an abbreviation or capture
  label without moving an already-published object.
- `legacy_page_links` is replaced per page on each run and keeps each external
  destination once, with the cleanest available label. Document links are left
  to `legacy_documents` so the archive does not show a duplicate download row.
- `legacy_public_pages`, `legacy_public_assets`, `legacy_public_documents` and
  `legacy_public_page_links` are the only anon-readable surfaces. The base
  tables are admin/service-role only, so private storage paths cannot be selected
  through PostgREST. `public_url` is exposed only for already-public media or a
  cleared public copy.

## Apply order

Apply `supabase/migrations/20261113120000_legacy_content_archive.sql`,
`supabase/migrations/20261113121000_legacy_archive_view_hardening.sql`, and
`supabase/migrations/20261113122000_seed_legacy_archive_footer_data_points.sql`,
then run the import with `--commit`, then build or redeploy the app. The public archive
query is cached for hours, so a deploy after the import is what guarantees the
first public render contains the rows. The migration itself does not modify or
remove any existing CMS, media or newsletter data.

Run `docs/legacy-production-verification.sql` once after the migration and again
after the import. It contains read-only checks for the history row, tables,
buckets, RLS, grants, policies, the public/private split, exact row counts, and
missing storage objects. Phase 2 expects the reviewed manifest's 9 pages, 71
assets, 20 documents, 27 links, 49 public assets, and 17 public documents.

## Current integration points

- `/archive` is the public index.
- `/voter-info` resolves its four old Drive cards through the archive when a
  document row exists, otherwise it keeps the existing link.
- `/news` adds legacy newsletter PDFs.
- `/choir` adds the old feature article, Instagram, Mobilize and film/document
  records.
- `/events` links to the archive and event documents.
- `/links` links to the archive; the footer links to it from Explore and the
  bottom bar.
- Nested old event URLs redirect to `/events`; `/current-events` redirects to
  `/archive#current-events`.

## Rollback

The import writes only `legacy_*` rows and the two legacy buckets. The migration
can be rolled back with:

```sql
DROP VIEW IF EXISTS public.legacy_public_page_links;
DROP VIEW IF EXISTS public.legacy_public_documents;
DROP VIEW IF EXISTS public.legacy_public_assets;
DROP VIEW IF EXISTS public.legacy_public_pages;
DROP TABLE IF EXISTS public.legacy_page_links;
DROP TABLE IF EXISTS public.legacy_documents;
DROP TABLE IF EXISTS public.legacy_assets;
DROP TABLE IF EXISTS public.legacy_pages;
DROP TABLE IF EXISTS public.legacy_import_runs;
```

Then remove the `legacy-archive` and `legacy-documents` buckets if their contents
are no longer wanted. Existing site content, the `media` bucket and the CMS are
untouched.

## Known limits

- Google Sites does not expose revisions, comments or permissions publicly; the
  capture is the public page surface only.
- The Drive MP4 and two sign-in-gated files require a manual export. They remain
  private, blocked review rows and are not linked from the public archive.
- The production migrations and the reviewed 2026-11-13 manifest import were
  applied on 2026-11-13. `/archive` now renders the 9 public pages, 71 asset rows,
  20 document rows, and 27 preserved links; the 49 public assets and 17 public
  documents are the only legacy rows exposed to anon.
