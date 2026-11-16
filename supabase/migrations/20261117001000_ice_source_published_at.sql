-- Source reports were ordered by insertion time, so a backfill of older
-- monthly exports could put September above November. Use the source's
-- publication time when present, falling back to the existing timestamp.
update public.ice_source_reports
set published_at = coalesce(source_published_at, published_at);
