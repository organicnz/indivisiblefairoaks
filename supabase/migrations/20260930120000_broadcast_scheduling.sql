-- ═══════════════════════════════════════════════════════════════════════════
-- Broadcast scheduling
--
-- `sendCRMBroadcast` can now save a broadcast with status 'scheduled' and a
-- `scheduled_at` timestamp instead of dispatching immediately. A scheduler
-- (Vercel cron → crm-broadcast-scheduler edge function) finds scheduled
-- broadcasts whose time has passed and dispatches them.
--
-- The 'scheduled' status joins the CHECK constraint. Like 'queued', it is a
-- state the app writes and the sender must understand — a CHECK that disagrees
-- with the code is a trap.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.crm_broadcasts.scheduled_at IS
    'When a scheduled broadcast should go out. NULL for immediate sends.';

ALTER TABLE public.crm_broadcasts
    DROP CONSTRAINT IF EXISTS crm_broadcasts_status_check;

ALTER TABLE public.crm_broadcasts
    ADD CONSTRAINT crm_broadcasts_status_check
    CHECK (status IN ('draft', 'queued', 'scheduled', 'sending', 'sent', 'failed'));

COMMENT ON COLUMN public.crm_broadcasts.status IS
    'draft → queued (accepted, awaiting the sender) → scheduled (accepted, awaiting its time) → sending → sent | failed.';
