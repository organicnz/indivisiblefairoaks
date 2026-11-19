-- The first national-source crawl treated whole DHS/CBP/ICE pages as report
-- text. Some were generic agency pages (CX guidance, EEO, veterans, privacy);
-- others were listing/archive pages. The refined crawler now asks the
-- `ice-source-refine` endpoint for the source lines that belong to the report
-- and will not publish a whole-page fallback that fails the report gate.
--
-- Existing records whose text cannot be trusted are removed here so the next
-- crawl does not create a duplicate next to the cleaned version. DHS and CBP
-- records outside their news-release paths are always non-reports. All
-- fallback records are re-extracted because `fallback` by definition stored
-- the entire page, including its navigation and feedback survey.
delete from public.ice_source_reports
where source_url ~ '^https://(www\.)?(dhs|cbp|ice)\.gov/'
  and (
    extraction_method = 'fallback'
    or (
      source_url like 'https://www.dhs.gov/%'
      and source_url not like 'https://www.dhs.gov/news/%'
    )
    or (
      source_url like 'https://www.cbp.gov/%'
      and source_url not like 'https://www.cbp.gov/newsroom/%media-release/%'
    )
    or (
      source_url like 'https://www.ice.gov/%'
      and source_url not like 'https://www.ice.gov/news/releases/%'
    )
  );

comment on column public.ice_source_reports.text_content is
  'Readable source text after the source-refinement step. Navigation, menus, consent copy, footers, and feedback chrome may be removed; report wording is not rewritten.';
