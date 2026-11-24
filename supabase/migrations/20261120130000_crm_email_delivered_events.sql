-- ── Resend email.delivered events ────────────────────────────────────────────
--
-- The webhook has always recorded bounces, complaints, opens, clicks, delayed
-- deliveries and suppressions, but it discarded `email.delivered`. That left
-- "accepted" and "delivered" indistinguishable on the contact timeline even
-- though Resend sends a distinct delivery event.
--
-- Add `delivered` to the event-type CHECK while preserving every existing
-- value. The broadcast delivery panel and the direct-email correlation both
-- read this column, so the constraint has to admit the new state before the
-- webhook starts writing it.
--
-- The inline CHECK from 20261006000000 is named by Postgres convention; dropping
-- it by that name keeps this migration re-runnable.

ALTER TABLE public.crm_email_events
    DROP CONSTRAINT IF EXISTS crm_email_events_event_type_check;

ALTER TABLE public.crm_email_events
    ADD CONSTRAINT crm_email_events_event_type_check
    CHECK (event_type IN (
        'bounced', 'complained', 'opened', 'clicked',
        'delivery_delayed', 'suppressed', 'delivered'
    ));

COMMENT ON COLUMN public.crm_email_events.event_type IS
    'Resend delivery event: bounced, complained, delivered, opened, clicked, delivery_delayed, or suppressed.';
