-- ── Broadcast recipient ledger ───────────────────────────────────────────────
--
-- One row per intended recipient per campaign. `crm_broadcasts.sent_count` and
-- `failed_count` are progress counters: they can be lost to an interrupted
-- sender, they cannot answer "who was this campaign sent to", and they cannot
-- carry a follow-up list. This table is the durable, per-recipient record.
--
-- ## Statuses
--
--   pending     The sender resolved this person into the audience but has not
--               yet recorded a provider result. The row exists before the first
--               provider call, so an interrupted campaign still names everyone
--               it intended to contact.
--   accepted    Resend accepted the message. Acceptance is not delivery; a
--               later bounce or complaint can still arrive.
--   failed      This send attempt produced no provider acceptance.
--   suppressed  Resend reported the address suppressed, permanently bounced, or
--               complained. The row remains for follow-up, but it is no longer
--               counted as accepted.
--
-- `pending` is deliberately part of the CHECK: without it a pre-registered row
-- would need to lie about its outcome before the outcome is known. It is not a
-- public campaign metric; the functions below expose `pending_count` separately
-- so a reader can tell "not recorded yet" from "failed".
--
-- ## Audience semantics are unchanged
--
-- This migration does not touch `crm_contacts`, either broadcast resolver, or
-- the `.eq('do_not_email', false)` audience rule. A ledger row exists only for
-- someone the existing sender actually resolved into the audience. Provider
-- suppression is reported by Resend *after* that resolution; it never widens
-- the audience, and opted-out or never-asked contacts still never get a row
-- here by being mailed.
--
-- ## Historical campaigns
--
-- Existing campaigns have no per-recipient identities to backfill. They keep
-- their `sent_count`/`failed_count` as the fallback until a recipient-level
-- ledger exists for them. No rows are fabricated for the past: a made-up
-- recipient list is worse than an explicitly absent one.

-- ── 1. The ledger ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_broadcast_recipients (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id    uuid        NOT NULL REFERENCES public.crm_broadcasts(id) ON DELETE CASCADE,
    -- Nullable for the self-test row (one address, no constituent) and because a
    -- deleted contact must not delete the campaign's record of having contacted
    -- that address. Email is the durable identity in the ledger.
    contact_id      uuid        REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    email           text        NOT NULL,
    recipient_name  text,
    status          text        NOT NULL
                                CHECK (status IN ('pending', 'accepted', 'failed', 'suppressed')),
    -- Resend's email id for an accepted send, when the provider returned one.
    provider_id     text,
    -- Provider rejection text or the reason an address was suppressed. Bounded
    -- by the settle function; kept human-readable for the follow-up list.
    reason          text,
    accepted_at     timestamptz,
    failed_at       timestamptz,
    suppressed_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    -- Addresses are normalized before they reach this table. The unique key
    -- below is only a reliable per-recipient key if case and surrounding space
    -- cannot create a second row for the same inbox.
    CONSTRAINT crm_broadcast_recipients_email_normalized
        CHECK (email = lower(btrim(email)) AND btrim(email) <> ''),
    CONSTRAINT crm_broadcast_recipients_broadcast_email_key
        UNIQUE (broadcast_id, email)
);

COMMENT ON TABLE public.crm_broadcast_recipients IS
    'Durable per-recipient broadcast ledger. Rows are pre-registered as pending, settled to accepted/failed by the Edge sender, and promoted to suppressed by Resend delivery events.';
COMMENT ON COLUMN public.crm_broadcast_recipients.status IS
    'pending before a provider result; accepted means provider acceptance (not delivery); failed means no acceptance; suppressed means Resend reported a suppression, permanent bounce, or complaint.';

-- RLS: admin-only, matching every other CRM table. The Edge sender and the
-- webhook use the service role, which bypasses RLS.
ALTER TABLE public.crm_broadcast_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_broadcast_recipients FROM anon;
GRANT ALL ON public.crm_broadcast_recipients TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can manage CRM broadcast recipients"
    ON public.crm_broadcast_recipients;
CREATE POLICY "Admins can manage CRM broadcast recipients"
    ON public.crm_broadcast_recipients FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- The follow-up read filters one campaign by status and orders by recency.
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_recipients_followups
    ON public.crm_broadcast_recipients (broadcast_id, status, updated_at DESC);

-- The delivery-event trigger matches one campaign + contact. Contact deletion
-- sets the FK null, so the partial index only covers rows that can match.
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_recipients_contact
    ON public.crm_broadcast_recipients (contact_id)
    WHERE contact_id IS NOT NULL;

DROP TRIGGER IF EXISTS crm_broadcast_recipients_touch_updated_at
    ON public.crm_broadcast_recipients;
CREATE TRIGGER crm_broadcast_recipients_touch_updated_at
    BEFORE UPDATE ON public.crm_broadcast_recipients
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 2. Campaign metrics, one SQL aggregate ───────────────────────────────────
--
-- The history page reads one page of campaigns and asks for all of their
-- metrics in one call. Counting in JavaScript over the returned rows would N+1
-- the ledger and could disagree with the database under a concurrent sender.
CREATE OR REPLACE FUNCTION public.crm_broadcast_metrics(p_broadcast_ids uuid[])
RETURNS TABLE (
    broadcast_id      uuid,
    recipient_count   integer,
    accepted_count    integer,
    failed_count      integer,
    suppressed_count  integer,
    pending_count     integer,
    recorded_count    integer,
    unresolved_count  integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        b.id,
        coalesce(b.recipient_count, 0)::integer AS recipient_count,
        count(r.id) FILTER (WHERE r.status = 'accepted')::integer AS accepted_count,
        count(r.id) FILTER (WHERE r.status = 'failed')::integer AS failed_count,
        count(r.id) FILTER (WHERE r.status = 'suppressed')::integer AS suppressed_count,
        count(r.id) FILTER (WHERE r.status = 'pending')::integer AS pending_count,
        count(r.id)::integer AS recorded_count,
        greatest(
            coalesce(b.recipient_count, 0) - count(r.id)::integer,
            0
        )::integer AS unresolved_count
    FROM public.crm_broadcasts b
    LEFT JOIN public.crm_broadcast_recipients r ON r.broadcast_id = b.id
    WHERE b.id = ANY(p_broadcast_ids)
    GROUP BY b.id, b.recipient_count
$$;

COMMENT ON FUNCTION public.crm_broadcast_metrics(uuid[]) IS
    'Per-campaign recipient counts derived in SQL from crm_broadcast_recipients. unresolved_count is intended recipients with no ledger row yet.';

REVOKE EXECUTE ON FUNCTION public.crm_broadcast_metrics(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_broadcast_metrics(uuid[]) TO service_role;

-- ── 3. Follow-up list: failed and suppressed recipients ──────────────────────
--
-- A bounded, ordered list with the full count computed over the filtered set.
-- The total is what lets the surface say "showing 100 of 1,240" instead of
-- treating the cap as the truth.
CREATE OR REPLACE FUNCTION public.crm_broadcast_followups(
    p_broadcast_id uuid,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    contact_id      uuid,
    email           text,
    recipient_name  text,
    status          text,
    reason          text,
    provider_id     text,
    failed_at       timestamptz,
    suppressed_at   timestamptz,
    updated_at      timestamptz,
    total_count     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        r.contact_id,
        r.email,
        r.recipient_name,
        r.status,
        r.reason,
        r.provider_id,
        r.failed_at,
        r.suppressed_at,
        r.updated_at,
        count(*) OVER () AS total_count
    FROM public.crm_broadcast_recipients r
    WHERE r.broadcast_id = p_broadcast_id
      AND r.status IN ('failed', 'suppressed')
    ORDER BY
        CASE WHEN r.status = 'failed' THEN 0 ELSE 1 END,
        r.updated_at DESC,
        r.email ASC
    LIMIT least(greatest(coalesce(p_limit, 100), 1), 500)
    OFFSET greatest(coalesce(p_offset, 0), 0)
$$;

COMMENT ON FUNCTION public.crm_broadcast_followups(uuid, integer, integer) IS
    'Bounded failed/suppressed recipient follow-up list for one campaign, with total_count over the full filtered set.';

REVOKE EXECUTE ON FUNCTION public.crm_broadcast_followups(uuid, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_broadcast_followups(uuid, integer, integer)
    TO service_role;

-- ── 4. Settle a batch of provider results ────────────────────────────────────
--
-- The sender calls this once per delivery batch. Only `pending` rows move: if a
-- Resend event already promoted a row to `suppressed`, a later `accepted`
-- settlement cannot erase that fact. That ordering is the reason this is a
-- function rather than an upsert from the Edge runtime.
CREATE OR REPLACE FUNCTION public.crm_broadcast_settle_recipients(
    p_broadcast_id uuid,
    p_results jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count integer;
BEGIN
    IF p_broadcast_id IS NULL
       OR p_results IS NULL
       OR jsonb_typeof(p_results) <> 'array' THEN
        RAISE EXCEPTION 'invalid broadcast ledger settlement';
    END IF;

    UPDATE public.crm_broadcast_recipients r
       SET status = e.status,
           provider_id = coalesce(e.provider_id, r.provider_id),
           reason = CASE
               WHEN e.status = 'failed'
                   THEN nullif(left(e.reason, 500), '')
               ELSE r.reason
           END,
           accepted_at = CASE
               WHEN e.status = 'accepted' THEN coalesce(r.accepted_at, now())
               ELSE r.accepted_at
           END,
           failed_at = CASE
               WHEN e.status = 'failed' THEN coalesce(r.failed_at, now())
               ELSE r.failed_at
           END,
           updated_at = now()
      FROM jsonb_to_recordset(p_results)
           AS e(email text, status text, provider_id text, reason text)
     WHERE r.broadcast_id = p_broadcast_id
       AND r.email = lower(btrim(e.email))
       AND r.status = 'pending'
       AND e.status IN ('accepted', 'failed');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.crm_broadcast_settle_recipients(uuid, jsonb) IS
    'Settles pending ledger rows from one provider batch. A row already promoted to suppressed by a delivery event is never overwritten.';

REVOKE EXECUTE ON FUNCTION public.crm_broadcast_settle_recipients(uuid, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_broadcast_settle_recipients(uuid, jsonb)
    TO service_role;

-- ── 5. Delivery events promote a ledger row to suppressed ────────────────────
--
-- `crm_email_events` is the webhook's durable delivery record. This trigger
-- makes the ledger follow it without adding a second write path in the route:
-- a permanent bounce, complaint, or Resend suppression promotes the recipient,
-- while opens/clicks/temporary bounces leave the send outcome untouched.
--
-- `crm_email_events` is written after provider acceptance, so the ledger row
-- has normally been settled already. The update is status-agnostic on purpose:
-- an event that races ahead of settlement (or arrives for a row still pending)
-- still wins, and settlement will not overwrite it.
CREATE OR REPLACE FUNCTION public.crm_broadcast_apply_delivery_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_reason text;
BEGIN
    IF NEW.broadcast_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.event_type = 'suppressed' THEN
        v_reason := 'Resend suppressed this address';
    ELSIF NEW.event_type = 'complained' THEN
        v_reason := 'Spam complaint';
    ELSIF NEW.event_type = 'bounced'
          AND NEW.metadata -> 'bounce' ->> 'type' = 'Permanent' THEN
        v_reason := 'Permanent bounce';
    ELSE
        RETURN NEW;
    END IF;

    -- Match on the contact id, with the ledger's email snapshot as a fallback.
    -- A merge can null the old contact id (ON DELETE SET NULL) while the email
    -- survives on the ledger row; the delivery event would otherwise arrive for
    -- the survivor and never reach the original campaign row.
    UPDATE public.crm_broadcast_recipients r
       SET status = 'suppressed',
           -- Earliest evidence wins, matching `unsubscribed_at` on the contact.
           suppressed_at = coalesce(r.suppressed_at, NEW.occurred_at),
           reason = coalesce(r.reason, v_reason),
           provider_id = coalesce(r.provider_id, NEW.provider_id),
           updated_at = now()
      FROM public.crm_contacts c
     WHERE c.id = NEW.contact_id
       AND r.broadcast_id = NEW.broadcast_id
       AND (r.contact_id = NEW.contact_id OR r.email = lower(c.email));

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_broadcast_apply_delivery_event
    ON public.crm_email_events;
CREATE TRIGGER crm_broadcast_apply_delivery_event
    AFTER INSERT ON public.crm_email_events
    FOR EACH ROW EXECUTE FUNCTION public.crm_broadcast_apply_delivery_event();
