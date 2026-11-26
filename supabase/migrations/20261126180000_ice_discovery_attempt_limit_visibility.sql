-- Discovery rows that keep failing a transient fetch used to be marked
-- `rejected` when the attempt ceiling was reached. That conflated an automatic
-- retry limit with a human rejection, and the admin queue only reads `pending`,
-- so the rows disappeared from the review surface. Keep the row pending and use
-- `attempt_count` as the automatic retry budget: intake stops selecting it at
-- the ceiling, while an admin can still approve or reject it.
alter table public.ice_crawl_discoveries
  add column if not exists attempt_count integer not null default 0;

comment on column public.ice_crawl_discoveries.attempt_count is
  'Transient intake attempts. At 6 the row remains pending but is excluded from automatic retries.';

-- Restore rows that were auto-retired by the old RPC. Only rows whose note
-- names an automatic retry are converted; an admin rejection is left alone.
update public.ice_crawl_discoveries
set
  status = 'pending',
  reviewed_at = null,
  review_note = left(
    'retry limit reached: ' ||
      regexp_replace(coalesce(review_note, ''), '^auto retry:[[:space:]]*', ''),
    500
  )
where status = 'rejected'
  and attempt_count >= 6
  and review_note like 'auto retry:%';

-- Spend one attempt without changing the human-review state. The ceiling is
-- enforced here so the edge scan and the Next fallback cannot disagree.
create or replace function public.record_ice_discovery_attempt(
  p_id uuid,
  p_note text,
  p_max_attempts integer default 6
)
returns table (status text, attempt_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  next_count integer;
  max_attempts integer := greatest(1, least(coalesce(p_max_attempts, 6), 20));
begin
  update public.ice_crawl_discoveries as d
     set attempt_count = d.attempt_count + 1,
         last_attempt_at = now(),
         reviewed_at = null,
         review_note = left(
           case
             when d.attempt_count + 1 >= max_attempts then
               'retry limit reached: ' ||
                 regexp_replace(coalesce(nullif(p_note, ''), 'auto retry'),
                                '^auto retry:[[:space:]]*', '')
             else coalesce(nullif(p_note, ''), 'auto retry')
           end,
           500
         )
   where d.id = p_id
     and d.status = 'pending'
   returning d.attempt_count into next_count;

  if next_count is null then
    return;
  end if;

  return query
    select d.status, d.attempt_count
      from public.ice_crawl_discoveries d
     where d.id = p_id;
end;
$$;

revoke all on function public.record_ice_discovery_attempt(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_ice_discovery_attempt(uuid, text, integer)
  to service_role;

-- The retry queue filters on the attempt budget and orders by the oldest
-- attempt. Keep that path independent of the review-page index.
create index if not exists ice_crawl_discoveries_retry_budget_idx
  on public.ice_crawl_discoveries (
    status,
    attempt_count,
    last_attempt_at asc nulls first,
    discovered_at asc
  )
  where status = 'pending';

notify pgrst, 'reload schema';
