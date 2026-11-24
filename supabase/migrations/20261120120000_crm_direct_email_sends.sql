-- ── Direct-email send ledger ─────────────────────────────────────────────────
--
-- One row per direct-email submission, keyed by the client's idempotency key.
-- The row is inserted as `pending` before the provider call and settled to
-- `accepted` or `failed` afterwards. That ordering is what makes the crash
-- window recoverable:
--
--   accepted    Resend accepted the message. The row carries the provider id,
--               so the send is recorded even if the process died before the
--               timeline and audit writes ran.
--   failed      This attempt produced no provider acceptance. A retry may claim
--               the row again with the same key; Resend's idempotency cache is
--               the second guard if a timeout made acceptance uncertain.
--   pending     Pre-registered, no settled provider result yet. A fresh row is
--               owned by the in-flight request; once the lease expires, a retry
--               may reclaim it and reuse the same provider key.
--
-- The message body is retained because a retry must resend the exact same
-- message, not whatever the form contains by the time the operator clicks
-- again. This mirrors `crm_activities.description`, which already stores the
-- direct-email body.
--
-- Rows are never deleted by the app. The unique key is the idempotency boundary:
-- a second submission with the same key finds the existing row rather than
-- inserting another.

CREATE TABLE IF NOT EXISTS public.crm_direct_email_sends (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The client generates this once per compose attempt. `uuid` (rather than
    -- text) makes an accidentally reused non-key string fail before a send.
    idempotency_key   uuid        NOT NULL,
    -- Nullable so deleting a contact does not erase the record of having
    -- emailed that address. The ledger's email snapshot remains the identity.
    contact_id        uuid        REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    -- The admin who pressed Send. Kept for the same reason the audit log keeps
    -- it; it is not a foreign key so a departed organizer's record survives.
    actor_user_id     uuid        NOT NULL,
    recipient_email   text        NOT NULL,
    subject           text        NOT NULL,
    message           text        NOT NULL,
    status            text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'accepted', 'failed')),
    -- Resend's message id for an accepted send.
    provider_id       text,
    -- The HTTP status from a rejection, or 0 for a transport failure.
    provider_status   integer,
    -- Bounded provider error text, kept human-readable for the retry surface.
    error             text,
    attempts          integer     NOT NULL DEFAULT 1 CHECK (attempts >= 1),
    -- The start of the current attempt. The action uses this as a lease so a
    -- duplicate submit cannot run concurrently with the first provider call.
    started_at        timestamptz NOT NULL DEFAULT now(),
    accepted_at       timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_direct_email_sends_idempotency_key_key
        UNIQUE (idempotency_key),
    CONSTRAINT crm_direct_email_sends_email_normalized
        CHECK (recipient_email = lower(btrim(recipient_email)) AND btrim(recipient_email) <> ''),
    CONSTRAINT crm_direct_email_sends_subject_present
        CHECK (btrim(subject) <> ''),
    CONSTRAINT crm_direct_email_sends_message_present
        CHECK (btrim(message) <> '')
);

COMMENT ON TABLE public.crm_direct_email_sends IS
    'Durable direct-email ledger. Rows are pre-registered as pending before the Resend call, then settled to accepted/failed. The unique idempotency_key prevents a retry from sending a second copy.';
COMMENT ON COLUMN public.crm_direct_email_sends.status IS
    'pending before a provider result; accepted means Resend accepted the message (not delivery); failed means this attempt produced no acceptance.';

-- RLS: admin-only, matching the other CRM tables. The action uses the admin
-- client; service-role callers bypass RLS.
ALTER TABLE public.crm_direct_email_sends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_direct_email_sends FROM anon;
GRANT ALL ON public.crm_direct_email_sends TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can manage CRM direct email sends"
    ON public.crm_direct_email_sends;
CREATE POLICY "Admins can manage CRM direct email sends"
    ON public.crm_direct_email_sends FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- The contact profile's send history.
CREATE INDEX IF NOT EXISTS idx_crm_direct_email_sends_contact
    ON public.crm_direct_email_sends (contact_id, accepted_at DESC)
    WHERE contact_id IS NOT NULL;

-- Finding attempts whose process died before settling. The action reads by
-- idempotency key; this partial index is for operator recovery queries.
CREATE INDEX IF NOT EXISTS idx_crm_direct_email_sends_pending
    ON public.crm_direct_email_sends (started_at)
    WHERE status = 'pending';

DROP TRIGGER IF EXISTS crm_direct_email_sends_touch_updated_at
    ON public.crm_direct_email_sends;
CREATE TRIGGER crm_direct_email_sends_touch_updated_at
    BEFORE UPDATE ON public.crm_direct_email_sends
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
