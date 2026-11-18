-- Enforce story-level deduplication for the nationwide discovery queue.
--
-- URL uniqueness alone misses the same story discovered through a different
-- publisher URL, a tracking variant that is not in the normalizer, or a
-- concurrent scan. `story_key` is the normalized headline plus its UTC
-- publication day. The nullable backfill leaves pre-existing duplicate review
-- rows intact while assigning one key per story, so the unique index can be
-- added without deleting an admin's review history. Duplicate rows that are
-- still pending are marked rejected instead of being deleted; this clears the
-- review queue without losing the audit trail.

alter table public.ice_crawl_discoveries
  add column if not exists story_key text;

comment on column public.ice_crawl_discoveries.story_key is
  'Normalized headline and UTC publication day used for atomic story deduplication.';

with base as (
  select
    id,
    status,
    story_key,
    discovered_at,
    trim(
      regexp_replace(
        regexp_replace(lower(title), '[^a-z0-9]+', ' ', 'g'),
        ' +',
        ' ',
        'g'
      )
    ) as normalized_title,
    trim(
      regexp_replace(
        regexp_replace(lower(coalesce(publisher, '')), '[^a-z0-9]+', ' ', 'g'),
        ' +',
        ' ',
        'g'
      )
    ) as normalized_publisher,
    coalesce(to_char(published_at at time zone 'UTC', 'YYYY-MM-DD'), '') as published_day
  from public.ice_crawl_discoveries
),
keyed as (
  select
    id,
    status,
    story_key,
    discovered_at,
    case
      when
        normalized_publisher <> ''
        and length(normalized_title) > length(normalized_publisher)
        and substr(
          normalized_title,
          length(normalized_title) - length(normalized_publisher),
          1
        ) = ' '
        and right(normalized_title, length(normalized_publisher)) = normalized_publisher
      then rtrim(
        left(normalized_title, length(normalized_title) - length(normalized_publisher))
      )
      else normalized_title
    end || '|' || published_day as next_story_key
  from base
),
ranked as (
  select
    id,
    status,
    next_story_key,
    row_number() over (
      partition by next_story_key
      order by
        (story_key is not null) desc,
        (status = 'approved') desc,
        discovered_at asc,
        id
    ) as position
  from keyed
)
update public.ice_crawl_discoveries as discovery
set
  story_key = case
    when ranked.position = 1 then ranked.next_story_key
    else discovery.story_key
  end,
  status = case
    when ranked.position > 1 and discovery.status = 'pending' then 'rejected'
    else discovery.status
  end,
  reviewed_at = case
    when ranked.position > 1 and discovery.status = 'pending' then now()
    else discovery.reviewed_at
  end,
  review_note = case
    when ranked.position > 1 and discovery.status = 'pending'
      then 'Automatically rejected as a duplicate discovery story.'
    else discovery.review_note
  end
from ranked
where
  discovery.id = ranked.id
  and (
    ranked.position = 1
    or (ranked.position > 1 and discovery.status = 'pending')
  );

create unique index if not exists ice_crawl_discoveries_story_key_unique
  on public.ice_crawl_discoveries (story_key)
  where story_key is not null;

-- `on conflict do nothing` without a target handles both the existing URL
-- uniqueness constraint and the new story-key index atomically. This avoids a
-- race where two discovery runs insert the same story through different URLs.
create or replace function public.insert_ice_crawl_discoveries(p_rows jsonb)
returns integer
language sql
security definer
set search_path = ''
as $$
  with incoming as (
    select
      input_row.url,
      input_row.title,
      input_row.publisher,
      input_row.published_at,
      input_row.discovery_query,
      input_row.story_key
    from jsonb_to_recordset(p_rows) as input_row(
      url text,
      title text,
      publisher text,
      published_at timestamptz,
      discovery_query text,
      story_key text
    )
  ),
  inserted as (
    insert into public.ice_crawl_discoveries (
      url,
      title,
      publisher,
      published_at,
      discovery_query,
      story_key
    )
    select
      incoming.url,
      incoming.title,
      incoming.publisher,
      incoming.published_at,
      incoming.discovery_query,
      incoming.story_key
    from incoming
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

revoke all on function public.insert_ice_crawl_discoveries(jsonb)
  from public, anon, authenticated;
grant execute on function public.insert_ice_crawl_discoveries(jsonb)
  to service_role;

comment on function public.insert_ice_crawl_discoveries(jsonb) is
  'Atomically queues discovery rows, ignoring URL and story-key duplicates.';