-- Token lifecycle and retention support for ICE surge subscribers.
--
-- `confirm_token_expires_at` makes confirmation links short-lived. Existing
-- rows keep NULL, which the application treats as expired: the old links were
-- previously valid forever and must not survive this migration.
--
-- The partial indexes match the two retention queries:
--   * pending rows that were never confirmed and never unsubscribed,
--   * rows whose unsubscribe happened longer ago than the retention window.
-- The daily purge route is scheduled by scripts/seed-ice-alert-cron.mjs.

alter table public.ice_alert_subscribers
  add column if not exists confirm_token_expires_at timestamptz;

comment on column public.ice_alert_subscribers.confirm_token_expires_at is
  'Expiry for the single-use confirmation token. NULL means expired/consumed.';

create index if not exists ice_alert_subscribers_pending_retention_idx
  on public.ice_alert_subscribers (updated_at)
  where confirmed_at is null and unsubscribed_at is null;

create index if not exists ice_alert_subscribers_unsubscribed_retention_idx
  on public.ice_alert_subscribers (unsubscribed_at)
  where unsubscribed_at is not null;
