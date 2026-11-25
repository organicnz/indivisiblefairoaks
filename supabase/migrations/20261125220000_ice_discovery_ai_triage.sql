-- AI triage for the discovery review queue.
--
-- `ice_crawl_discoveries` is a headline queue: 170+ pending rows accumulate, and
-- the admin list used to show only the newest 30. Triage stores a relevance
-- score, a confidence band, a short rationale and a duplicate pointer on the
-- candidate itself, so the queue can be ordered by age (to drain) or by score
-- (to surface the strongest lead first) without re-running the model on every
-- page load.
--
-- Nothing here publishes a report. Triage is review metadata only; a discovery
-- still needs an admin to confirm republication rights before it becomes a
-- source and is crawled into `ice_source_reports`.
--
-- The rights gate is tightened in the same migration. Discovery intake writes
-- `provenance = 'discovery'` with `rights_status = 'unconfirmed'`, but the anon
-- RLS policy only checked `published_at <= now()`. Because the public readers
-- use the service-role key, they bypassed RLS and an unconfirmed attributed
-- summary was visible in the archive before any human reviewed its rights.

alter table public.ice_crawl_discoveries
  add column if not exists triage_score smallint,
  add column if not exists triage_confidence text,
  add column if not exists triage_relevance text,
  add column if not exists triage_reason text,
  add column if not exists triage_model text,
  add column if not exists triaged_at timestamptz,
  add column if not exists duplicate_of uuid references public.ice_crawl_discoveries(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_crawl_discoveries_triage_score_check'
       and conrelid = 'public.ice_crawl_discoveries'::regclass
  ) then
    alter table public.ice_crawl_discoveries
      add constraint ice_crawl_discoveries_triage_score_check
      check (triage_score is null or triage_score between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_crawl_discoveries_triage_confidence_check'
       and conrelid = 'public.ice_crawl_discoveries'::regclass
  ) then
    alter table public.ice_crawl_discoveries
      add constraint ice_crawl_discoveries_triage_confidence_check
      check (triage_confidence is null or triage_confidence in ('high', 'medium', 'low'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_crawl_discoveries_triage_relevance_check'
       and conrelid = 'public.ice_crawl_discoveries'::regclass
  ) then
    alter table public.ice_crawl_discoveries
      add constraint ice_crawl_discoveries_triage_relevance_check
      check (
        triage_relevance is null
        or triage_relevance in ('enforcement', 'detention', 'checkpoint', 'related', 'off_topic')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_crawl_discoveries_triage_self_duplicate_check'
       and conrelid = 'public.ice_crawl_discoveries'::regclass
  ) then
    alter table public.ice_crawl_discoveries
      add constraint ice_crawl_discoveries_triage_self_duplicate_check
      check (duplicate_of is null or duplicate_of <> id);
  end if;
end
$$;

-- The review queue reads `status = 'pending' and duplicate_of is null` ordered
-- by `discovered_at`. Partial, so it stays small even as approved/rejected rows
-- accumulate.
create index if not exists ice_crawl_discoveries_review_queue_idx
  on public.ice_crawl_discoveries (status, discovered_at, id)
  where duplicate_of is null;

-- The "highest confidence" view orders triaged rows by score. Partial for the
-- same reason; `nulls last` keeps untriaged rows out of the ranked head.
create index if not exists ice_crawl_discoveries_triage_rank_idx
  on public.ice_crawl_discoveries (status, triage_score desc nulls last, discovered_at)
  where duplicate_of is null;

-- Non-partial so the self-referencing foreign key has a leading index (the
-- schema-hygiene gate checks `indkey[0]`), and so counting collapsed rows does
-- not scan the queue.
create index if not exists ice_crawl_discoveries_duplicate_of_idx
  on public.ice_crawl_discoveries (duplicate_of);

comment on column public.ice_crawl_discoveries.triage_score is
  'AI relevance score 0-100 for genuine ICE enforcement relevance. Review metadata only; never a publication decision.';
comment on column public.ice_crawl_discoveries.triage_confidence is
  'high = a concrete ICE enforcement action; medium = credible but less specific; low = related or unclear.';
comment on column public.ice_crawl_discoveries.triage_relevance is
  'enforcement | detention | checkpoint | related | off_topic.';
comment on column public.ice_crawl_discoveries.triage_reason is
  'Short human-readable rationale from the triage model, bounded to 400 characters.';
comment on column public.ice_crawl_discoveries.triage_model is
  'Model identifier that produced the triage row; deterministic means the AI provider was unavailable.';
comment on column public.ice_crawl_discoveries.duplicate_of is
  'Canonical pending discovery for a collapsed duplicate story. The duplicate stays pending for audit but is hidden from the review queue.';

-- Atomic batch write for the triage pass. One round trip, one transaction: a
-- partially applied batch would leave the queue half-ranked and the next run
-- would spend model calls re-ranking rows it had already scored.
create or replace function public.apply_ice_discovery_triage(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  applied integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  with incoming as (
    select
      (entry->>'id')::uuid as id,
      case
        when entry->>'score' ~ '^\d{1,3}$'
          then greatest(0, least(100, (entry->>'score')::int))::smallint
        else null
      end as score,
      case
        when entry->>'confidence' in ('high', 'medium', 'low')
          then entry->>'confidence'
        else 'low'
      end as confidence,
      case
        when entry->>'relevance' in ('enforcement', 'detention', 'checkpoint', 'related', 'off_topic')
          then entry->>'relevance'
        else 'related'
      end as relevance,
      nullif(left(coalesce(entry->>'reason', ''), 400), '') as reason,
      nullif(left(coalesce(entry->>'model', ''), 80), '') as model,
      case
        when coalesce(entry->>'duplicate_of', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (entry->>'duplicate_of')::uuid
        else null
      end as duplicate_of
    from jsonb_array_elements(p_rows) as entry
  ), updated as (
    update public.ice_crawl_discoveries as discovery
       set triage_score = incoming.score,
           triage_confidence = incoming.confidence,
           triage_relevance = incoming.relevance,
           triage_reason = incoming.reason,
           triage_model = incoming.model,
           triaged_at = now(),
           duplicate_of = case
             when incoming.duplicate_of is not null and incoming.duplicate_of <> discovery.id
               then incoming.duplicate_of
             else null
           end
      from incoming
     where discovery.id = incoming.id
       and discovery.status = 'pending'
    returning discovery.id
  )
  select count(*)::integer into applied from updated;

  return applied;
end
$$;

revoke all on function public.apply_ice_discovery_triage(jsonb) from public, anon, authenticated;
grant execute on function public.apply_ice_discovery_triage(jsonb) to service_role;

comment on function public.apply_ice_discovery_triage(jsonb) is
  'Applies a validated AI triage batch to pending discovery candidates in one transaction. Service role only.';

-- Rights gate: a discovery summary is an attributed abstract, not a
-- rights-confirmed republication. Keep it out of every public surface until an
-- admin confirms rights; the service-role readers repeat this predicate
-- because they bypass RLS.
drop policy if exists ice_source_reports_read on public.ice_source_reports;
create policy ice_source_reports_read
  on public.ice_source_reports
  for select
  to anon, authenticated
  using (published_at <= now() and rights_status = 'confirmed');
