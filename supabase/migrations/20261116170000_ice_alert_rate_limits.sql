-- Durable abuse controls for public ICE surge subscriptions.
--
-- The in-memory limiter in src/lib/rate-limit.ts is per-isolate and therefore
-- only advisory on serverless deployments. This table keeps four fixed-window
-- counters behind one service-role-only RPC:
--
--   * the visitor IP hash,
--   * the normalized email hash,
--   * the push endpoint host hash (when a push subscription is supplied),
--   * one global counter for the whole endpoint.
--
-- Only HMAC hashes of the identifiers are stored. Counter rows are bounded by
-- the number of distinct keys, not by the number of requests; an elapsed
-- window is reset in place by the RPC.

create table if not exists public.ice_alert_rate_limits (
  scope text not null check (scope in ('ip', 'email', 'endpoint', 'global')),
  key_hash text not null check (length(key_hash) between 1 and 128),
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (scope, key_hash)
);

alter table public.ice_alert_rate_limits enable row level security;
revoke all on table public.ice_alert_rate_limits from anon, authenticated;
grant all on table public.ice_alert_rate_limits to service_role;

comment on table public.ice_alert_rate_limits is
  'Service-role-only fixed-window counters for public ICE surge subscription abuse controls.';

create or replace function public.ice_alert_consume_rate_limits(
  p_ip_hash text,
  p_email_hash text,
  p_endpoint_hash text,
  p_window_seconds integer,
  p_ip_limit integer,
  p_email_limit integer,
  p_endpoint_limit integer,
  p_global_limit integer
)
returns table (allowed boolean, retry_after_seconds integer, limited_scope text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_count integer;
  v_start timestamptz;
  v_retry integer;
begin
  if p_ip_hash is null or length(p_ip_hash) = 0
     or p_email_hash is null or length(p_email_hash) = 0
     or p_window_seconds < 1
     or p_ip_limit < 1 or p_email_limit < 1
     or p_endpoint_limit < 1 or p_global_limit < 1 then
    raise exception 'invalid ice alert rate limit configuration';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  -- The global row cannot be updated atomically with the three keyed rows
  -- without one serialization point. At this endpoint's volume the lock is
  -- cheaper than a partially consumed set of counters.
  perform pg_advisory_xact_lock(731942001);

  v_count := 0;
  v_start := null;
  select limits.count, limits.window_start
    into v_count, v_start
    from public.ice_alert_rate_limits as limits
   where limits.scope = 'ip' and limits.key_hash = p_ip_hash;
  if v_start is not null and v_start > v_now - v_window and v_count >= p_ip_limit then
    v_retry := greatest(
      1,
      ceil(extract(epoch from (v_start + v_window - v_now)))::integer
    );
    return query select false, v_retry, 'ip'::text;
    return;
  end if;

  v_count := 0;
  v_start := null;
  select limits.count, limits.window_start
    into v_count, v_start
    from public.ice_alert_rate_limits as limits
   where limits.scope = 'email' and limits.key_hash = p_email_hash;
  if v_start is not null and v_start > v_now - v_window and v_count >= p_email_limit then
    v_retry := greatest(
      1,
      ceil(extract(epoch from (v_start + v_window - v_now)))::integer
    );
    return query select false, v_retry, 'email'::text;
    return;
  end if;

  if p_endpoint_hash is not null then
    v_count := 0;
    v_start := null;
    select limits.count, limits.window_start
      into v_count, v_start
      from public.ice_alert_rate_limits as limits
     where limits.scope = 'endpoint' and limits.key_hash = p_endpoint_hash;
    if v_start is not null and v_start > v_now - v_window and v_count >= p_endpoint_limit then
      v_retry := greatest(
        1,
        ceil(extract(epoch from (v_start + v_window - v_now)))::integer
      );
      return query select false, v_retry, 'endpoint'::text;
      return;
    end if;
  end if;

  v_count := 0;
  v_start := null;
  select limits.count, limits.window_start
    into v_count, v_start
    from public.ice_alert_rate_limits as limits
   where limits.scope = 'global' and limits.key_hash = 'global';
  if v_start is not null and v_start > v_now - v_window and v_count >= p_global_limit then
    v_retry := greatest(
      1,
      ceil(extract(epoch from (v_start + v_window - v_now)))::integer
    );
    return query select false, v_retry, 'global'::text;
    return;
  end if;

  insert into public.ice_alert_rate_limits as limits
    (scope, key_hash, window_start, count)
  values ('ip', p_ip_hash, v_now, 1)
  on conflict (scope, key_hash) do update
  set count = case
        when limits.window_start > v_now - v_window then limits.count + 1
        else 1
      end,
      window_start = case
        when limits.window_start > v_now - v_window then limits.window_start
        else v_now
      end;

  insert into public.ice_alert_rate_limits as limits
    (scope, key_hash, window_start, count)
  values ('email', p_email_hash, v_now, 1)
  on conflict (scope, key_hash) do update
  set count = case
        when limits.window_start > v_now - v_window then limits.count + 1
        else 1
      end,
      window_start = case
        when limits.window_start > v_now - v_window then limits.window_start
        else v_now
      end;

  if p_endpoint_hash is not null then
    insert into public.ice_alert_rate_limits as limits
      (scope, key_hash, window_start, count)
    values ('endpoint', p_endpoint_hash, v_now, 1)
    on conflict (scope, key_hash) do update
    set count = case
          when limits.window_start > v_now - v_window then limits.count + 1
          else 1
        end,
        window_start = case
          when limits.window_start > v_now - v_window then limits.window_start
          else v_now
        end;
  end if;

  insert into public.ice_alert_rate_limits as limits
    (scope, key_hash, window_start, count)
  values ('global', 'global', v_now, 1)
  on conflict (scope, key_hash) do update
  set count = case
        when limits.window_start > v_now - v_window then limits.count + 1
        else 1
      end,
      window_start = case
        when limits.window_start > v_now - v_window then limits.window_start
        else v_now
      end;

  return query select true, 0, null::text;
end;
$$;

revoke execute on function public.ice_alert_consume_rate_limits(
  text, text, text, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.ice_alert_consume_rate_limits(
  text, text, text, integer, integer, integer, integer, integer
) to service_role;
