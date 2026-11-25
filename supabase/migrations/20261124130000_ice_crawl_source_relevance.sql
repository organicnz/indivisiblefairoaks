-- DOJ's newsroom and sitemap are behind an Akamai interstitial challenge, so
-- the only public entry point that serves content is its press-release JSON
-- API. That API is the whole department's feed, not the ICE beat, so a source
-- needs a way to say which releases belong to it.
--
-- `relevance_terms` is that statement: plain phrases matched case-insensitively
-- on word boundaries against title, teaser and body. Null means "admit
-- everything the source exposes", which is correct for sources whose whole
-- inventory is already in scope (ICE, CBP, DHS, Stop ICE).
alter table public.ice_crawl_sources
  add column if not exists relevance_terms text[];

comment on column public.ice_crawl_sources.relevance_terms is
  'Optional beat filter for feed items: plain phrases, word-boundary matched. Null admits all items.';

-- Point the DOJ source at the reachable API, newest first, and restrict it to
-- immigration-enforcement releases. Article pages remain challenged, so the
-- API body is the report text; the source stays enabled and attributed.
update public.ice_crawl_sources
set
  url = 'https://www.justice.gov/api/v1/press_releases.json?sort_by=created&sort_order=DESC',
  relevance_terms = array[
    'ICE',
    'immigration',
    'immigrant',
    'deportation',
    'deported',
    'asylum',
    'undocumented',
    'noncitizen',
    'non-citizen',
    'border patrol',
    'human smuggling',
    'alien smuggling',
    'removal proceedings',
    'immigration judge',
    'sanctuary city',
    'visa fraud'
  ]
where url = 'https://www.justice.gov/news/press-releases';

-- A source that is served by a JSON API is still a page source for the budget,
-- but it has no useful page listing beyond the feed itself.
update public.ice_crawl_sources
set max_pages = 12
where url like 'https://www.justice.gov/api/v1/press_releases.json%';
