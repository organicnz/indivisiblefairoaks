-- Migration: 20261123130000_schema_hygiene_indexes_and_grants.sql
--
-- Closes the six findings `scripts/check-schema-hygiene.mjs` reports against
-- the hosted project. Each is handled on its own terms; the reasoning below is
-- the record of why this object is the one that changes, so a later reader can
-- disagree with a decision instead of re-deriving it.
--
-- ## 1. Two indexes covered by a wider unique index
--
-- `ice_heatmap_cities` is keyed by (release_id, state_code, city). The separate
-- (release_id, state_code) index is a strict prefix of that primary key, so the
-- PK btree already answers both `where release_id = ... and state_code = ...`
-- and `where release_id = ...`. The map itself reads one release ordered by
-- (state_code, city), which is the PK order — the narrow index was never the
-- one serving that query. Keeping it cost a second index write on every one of
-- the 8,599 city rows and bought no read.
--
-- `legacy_page_links` carries UNIQUE (page_id, href).
-- `legacy_page_links_page_idx` is (page_id), a strict prefix of that constraint
-- index, so it is the same duplication. The unique index still enforces the
-- constraint and still serves lookups by page.
--
-- In both cases the narrower, non-unique index is the one dropped. Dropping the
-- wider one would remove a guarantee; dropping the narrower loses no plan.
--
-- ## 2. Three foreign keys with no leading index
--
-- Each is a nullable `on delete set null` reference. Postgres has to find the
-- referencing rows whenever the parent row is deleted, and without an index
-- that is a sequential scan of the child table while the parent's lock is
-- held. These are append-heavy crawl tables, so the index is deliberately
-- partial on `IS NOT NULL`: a NULL foreign key can never reference a parent,
-- and this is the same shape `idx_crm_broadcast_recipients_contact` already
-- uses for the same reason. Nothing in the application filters on these
-- columns today, so no wider composite is invented; the index exists for the
-- referential action, not for a guessed query.
--
-- ## 3. Ungoverned privileges on the broadcast ledger
--
-- `crm_broadcast_recipients` was created after 20261101080000 revoked the four
-- privileges row-level security cannot govern, and its
-- `GRANT ALL ... TO authenticated` reintroduced them: MAINTAIN, REFERENCES,
-- TRIGGER and TRUNCATE. Nothing in this application truncates or attaches
-- triggers through PostgREST, which exposes none of those verbs. The four are
-- revoked; SELECT/INSERT/UPDATE/DELETE stay granted and remain governed by the
-- admin-only policy.

-- ── 1. Redundant prefix indexes ──────────────────────────────────────────────

DROP INDEX IF EXISTS public.ice_heatmap_cities_state_idx;
DROP INDEX IF EXISTS public.legacy_page_links_page_idx;

-- ── 2. Leading indexes for the uncovered foreign keys ────────────────────────

CREATE INDEX IF NOT EXISTS ice_crawl_discoveries_source_idx
  ON public.ice_crawl_discoveries (source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON INDEX public.ice_crawl_discoveries_source_idx IS
  'Covers the source_id foreign key when a crawl source is deleted; the queue reads by status, not by source.';

CREATE INDEX IF NOT EXISTS ice_report_intake_public_report_idx
  ON public.ice_report_intake (public_report_id)
  WHERE public_report_id IS NOT NULL;

COMMENT ON INDEX public.ice_report_intake_public_report_idx IS
  'Covers the public_report_id foreign key when a public report is deleted.';

CREATE INDEX IF NOT EXISTS ice_source_reports_page_idx
  ON public.ice_source_reports (page_id)
  WHERE page_id IS NOT NULL;

COMMENT ON INDEX public.ice_source_reports_page_idx IS
  'Covers the page_id foreign key when a crawled page is deleted.';

-- ── 3. Privileges RLS cannot govern ──────────────────────────────────────────

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE
  ON public.crm_broadcast_recipients
  FROM anon, authenticated;

COMMENT ON TABLE public.crm_broadcast_recipients IS
  'Durable per-recipient broadcast ledger. Rows are pre-registered as pending, settled to accepted/failed by the Edge sender, and promoted to suppressed by Resend delivery events. Authenticated admins hold only the RLS-governed DML privileges.';
