-- The city-watch panel asks for a state-scoped archive count and the most
-- recent city rows on every selected report. Without a state-first index the
-- public summary has to scan the growing source archive; this keeps that
-- lookup bounded as the crawl accumulates history.
create index if not exists ice_source_reports_state_published_idx
  on public.ice_source_reports (state_code, published_at desc);

comment on index public.ice_source_reports_state_published_idx is
  'State-scoped archive counts and recent city rows for the public city-watch summary.';
