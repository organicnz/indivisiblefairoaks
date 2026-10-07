-- ── CRM Email Events: delivery-event tracking + flood-guard index ─────────────
--
-- Ported from the `crm-improvements` branch (20261001000000) and renumbered so
-- it applies after the consent tri-state (20261005020000) and the merge RPC
-- (20261005030000). The original timestamp predates those migrations; applying
-- it out of order would expand the activities CHECK before the tri-state
-- exists and confuse the deploy ordering the hardening plan (0.7) requires:
-- schema first, app second.
--
-- (a) Expand crm_activities.type CHECK to include 'email_bounced' and
--     'email_complained', so the Resend webhook handler can log delivery
--     failures as activities on the contact record. The eight pre-existing
--     values (note, email_sent, contact_form, event_rsvp, order, status_change,
--     import, merge) are preserved verbatim — dropping one would refuse writes
--     the app still performs.
-- (b) crm_email_events — stores Resend webhook delivery events (bounced,
--     complained, opened, clicked, delivery_delayed, suppressed) keyed to contact and
--     optionally to a broadcast. `broadcast_id` is nullable by design: the
--     webhook links what Resend tells it, and Resend does not reliably echo our
--     tags, so a delivery event must be recordable without a campaign.
-- (c) Flood-guard partial index on crm_activities: the flood guard trigger
--     counts `type = 'email_sent'` rows in the last hour. Without an index
--     that is a sequential scan on every broadcast batch.
--
-- Tri-state note: suppression writes `do_not_email = true` (asked and
-- declined), never NULL. A bounced address was asked — the mail was sent —
-- and the answer came back as a hard failure. `unsubscribed_at` is set
-- alongside, per the merge decision (earliest evidence wins, never cleared on
-- re-consent): the timestamp is the evidence, not the state.

-- ── (a) Expand crm_activities.type ───────────────────────────────────────────
ALTER TABLE public.crm_activities DROP CONSTRAINT IF EXISTS crm_activities_type_check;
ALTER TABLE public.crm_activities
    ADD CONSTRAINT crm_activities_type_check
    CHECK (type IN (
        'note', 'email_sent', 'contact_form', 'event_rsvp', 'order',
        'status_change', 'import', 'merge',
        'email_bounced', 'email_complained'
    ));

-- ── (b) crm_email_events table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_email_events (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id    uuid        NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    broadcast_id  uuid        REFERENCES public.crm_broadcasts(id) ON DELETE SET NULL,
    event_type    text        NOT NULL
                              CHECK (event_type IN (
                                  'bounced', 'complained', 'opened',
                                  'clicked', 'delivery_delayed', 'suppressed'
                              )),
    provider_id   text,
    -- Svix message id. Resend retries a delivery with the same `svix-id` and
    -- documents deduplicating on it. Unique per contact, not globally: one event
    -- can name several recipients, and each gets its own row. Nullable, and
    -- NULLs never conflict, so a hand-inserted row is still legal.
    svix_id       text,
    metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_email_events_svix_contact_key UNIQUE (svix_id, contact_id)
);

-- RLS: admin-only, same pattern as every other CRM table.
ALTER TABLE public.crm_email_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_email_events FROM anon;
GRANT ALL ON public.crm_email_events TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can manage CRM email events" ON public.crm_email_events;
CREATE POLICY "Admins can manage CRM email events"
    ON public.crm_email_events FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Indexes: look up all events for a contact (timeline) and for a broadcast (stats)
CREATE INDEX IF NOT EXISTS idx_crm_email_events_contact_id
    ON public.crm_email_events (contact_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_email_events_broadcast_id
    ON public.crm_email_events (broadcast_id)
    WHERE broadcast_id IS NOT NULL;

-- ── (c) Flood-guard partial index on crm_activities ──────────────────────────
-- The flood guard trigger runs:
--   SELECT count(*) FROM crm_activities
--   WHERE type = 'email_sent' AND created_at > now() - interval '1 hour'
-- Without an index this is a full table scan. The partial index covers exactly
-- the rows that query needs.
CREATE INDEX IF NOT EXISTS idx_crm_activities_type_created
    ON public.crm_activities (type, created_at DESC)
    WHERE type = 'email_sent';
