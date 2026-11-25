-- Two findings from the scheduled `check-schema-hygiene.mjs` run, both created
-- by earlier migrations rather than by drift:
--
--   1. `20261125130000_ice_discovery_intake.sql` and
--      `20261125160000_ice_scan_edge_pipeline.sql` each created an index on
--      `ice_source_reports (provenance, rights_status, published_at desc)`
--      under different names. The pair doubles the write cost of every report
--      insert for no read benefit.
--   2. `ice_crawl_page_images.source_id` has a cascading foreign key but no
--      leading index, so deleting a crawl source scans the image table once
--      per deleted source.
--
-- Keep `ice_source_reports_provenance_idx`, the older of the two identical
-- indexes; dropping either is equivalent, and keeping the name that existed
-- first avoids churn in any plan or runbook that mentions it.
drop index if exists public.ice_source_reports_discovery_rights_idx;

create index if not exists ice_crawl_page_images_source_id_idx
  on public.ice_crawl_page_images (source_id);
