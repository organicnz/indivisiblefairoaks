## Objective
Improved the Supabase integration for the Indivisible Fair Oaks-Carmichael project, focusing on contact form reliability, RLS policy integrity after project restores, type synchronization, full-text search verification, and making the gallery the single source of truth from Supabase.

## Important Details
- The Supabase integration includes: browser/client (`createClient`, `createPublicClient`), server client (`createServerClient` with cookies), admin client (service role key), RLS policies on all tables, error telemetry (`error_reports` table with anon insert-only RLS), contact form with direct RPC + `notify-contact` Edge Function (pg_net trigger properly torn down), full-text search with `search_vector` GIN indexes and ranked RPCs, content sanitization layer, middleware scoped to `/account`/`/admin`/`/login`, and gallery as single source of truth
- Key improvement: Made `gallery_photos` table the single source of truth for gallery imagery, replacing hardcoded static arrays in 3 components. The `gallery_photos` table (migration `20260904120000_gallery_photos.sql`) already existed with 13 photos seeded from the original hardcoded arrays, but the gallery page was not reading from it. Now fetches dynamic data from Supabase on mount.
- Gallery photos use `storage_path` (relative path like `gallery/foo.jpg`) converted to full Supabase Storage URLs via `getStorageUrl()` in the component. Admins can add/update photos through the admin dashboard without code redeploy.
- Contact form: Uses `submit_contact_submission` RPC for inserting submissions (with built-in rate limiting of 30 submissions/10min via SQL throttle), then directly invokes the `notify-contact` Edge Function for email delivery. Volume cap: 20 emails/10min globally in Edge Function. Vault URL integration supported via `CONTACT_FUNCTION_URL` env var.
- Full-text search: Weighted `tsvector` columns GIN-indexed on `products` and `content` tables (migration `20260825130000_fts_search.sql`). Ranked RPCs: `search_products` and `search_content` with `ts_rank` relevance scoring. ILIKE fallback for preview environments. Publish status + embargo visibility filtering.
- Type generation: `scripts/gen-types.mjs` already works correctly — derives project ref from env, falls back to current project, generates `src/types/supabase.ts` from Supabase SQL API.
- Media/Storage: `getStorageUrl()` in `src/lib/supabase.ts` transforms relative paths to Supabase Storage URLs. Used by 30+ components (products, gallery, admin, home, cart, wishlist). `sanitizeWPContent` step 9 rewrites `<img>` src through `getStorageUrl()`. Full test coverage in `sanitize-extra.test.ts`.
- Error telemetry: `/api/report-error` rate-limited (10/min/IP for checkout, 3/10min/IP for contact); error fingerprinting via `errorFingerprint()` for crash grouping.
- Rate limiting: DB throttle at 30 submissions/10min via `submit_contact_submission` RPC; Edge Function global cap at 20 notifications/10min; these serve different purposes (row creation vs. email volume).

## Work State

### Completed
- Rewrote `scripts/rls-role-repair.mjs` — outputs SQL to recreate contact_submissions policies matching the playbook; safe, idempotent
- Verified search/FTS functionality: GIN indexes, ranked RPCs, ILIKE fallback all operational
- Verified contact form flow: direct RPC invocation + `notify-contact` Edge Function (pg_net trigger properly torn down)
- Verified type generation script `scripts/gen-types.mjs` works correctly
- Verified error telemetry and rate limiting configurations
- Verified content sanitization: `sanitizeWPContent` wraps all HTML from `content` table before render
- Made gallery the single source of truth: Updated `src/lib/queries/content-client.ts` to fetch from `gallery_photos` table; Updated `src/app/gallery/page.tsx` to use dynamic data from Supabase instead of hardcoded `STATIC_GALLERY` array
- TypeScript compilation passes for all modified files
- TypeScript compilation passes for gallery-related files

### Active
- Run RLS repair script after any project restore/re-provisioning: `node scripts/rls-role-repair.mjs` and apply the output SQL via Supabase SQL editor
- Regenerate types after schema changes via `bun run gen-types`
- Verify vault integration for `CONTACT_FUNCTION_URL` env var in new deployments/forks
- Monitor rate limiting alignment between DB throttle (30/10min) and Edge Function cap (20/10min global)

### Blocked
- None currently

## Next Move
1. Run RLS role repair after project restore: `node scripts/rls-role-repair.mjs` — this will output the SQL statements needed to recreate the policies
2. Apply the output SQL in the Supabase SQL editor (or via `supabase db exec`)
3. Regenerate types after schema changes: `bun run gen-types` (or `bun x supabase@latest gen types typescript --project-id ${SUPABASE_PROJECT_REF}`)
4. Test contact form submission end-to-end after deployment to verify email delivery
5. Add new gallery photos via Supabase SQL editor or admin dashboard (insert row into `public.gallery_photos` table)

## Relevant Files
- `scripts/rls-role-repair.mjs` — New script to check RLS policies and output SQL for contact_submissions policy repair (matches playbook `20260825160000_contact_rls_role_repair.sql`)
- `scripts/gen-types.mjs` — Generates/types Supabase Typescript types from project schema
- `src/lib/queries/content-client.ts` — Fetches gallery photos from `gallery_photos` table; includes `getGalleryPhotos()` function
- `src/app/gallery/page.tsx` — Gallery page now fetches dynamic data from Supabase's `gallery_photos` table; removed hardcoded `STATIC_GALLERY` array
- `supabase/migrations/20260825160000_contact_rls_role_repair.sql` — RLS role repair playbook (DROP/CREATE policies)
- `supabase/migrations/20260825130000_fts_search.sql` — FTS search_vector columns and GIN indexes
- `supabase/migrations/20260904120000_gallery_photos.sql` — Gallery photos table schema and seeded 13 photos
- `src/lib/supabase.ts` — Browser client (`createBrowserClient`) initialization; `getStorageUrl()` function
- `src/lib/supabase-server.ts` — Server client (`createServerClient`) with cookie handling
- `src/lib/sanitize.ts` — Content sanitization with `getStorageUrl` from supabase; SPAM_KEYWORDS list
- `src/types/supabase.ts` — Database types (generated from `schema_indivisible.sql` via `gen-types.mjs`)
- `supabase/schema_indivisible.sql` — Complete database schema with all RLS policies, triggers, and generated columns
- `supabase/functions/notify-contact/index.ts` — Edge Function for contact form fire-and-forget email delivery