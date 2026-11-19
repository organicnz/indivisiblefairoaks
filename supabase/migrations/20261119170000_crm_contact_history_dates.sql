-- Civic CRM: separate last outbound, inbound, and engaged dates.
--
-- `crm_contacts.last_contacted_at` recorded only direct email. Broadcasts wrote
-- one `email_sent` activity per recipient but never moved the contact's date, so
-- the directory's "Last Active" value could not see a campaign. Contact-form
-- submissions, RSVPs, and orders were likewise timeline-only. The table then
-- fell back to `created_at`, which showed the join date as though it were
-- activity.
--
-- The three columns below make the distinction explicit:
--
--   last_outbound_at  the chapter sent the contact an email
--   last_inbound_at   the contact submitted a form, RSVP'd, or ordered
--   last_engaged_at   the later of those two, generated so it cannot drift
--
-- Notes, status changes, imports, and merges are organizer records, not contact
-- engagement, and do not move any of these dates.
ALTER TABLE public.crm_contacts
    ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;

ALTER TABLE public.crm_contacts
    ADD COLUMN IF NOT EXISTS last_engaged_at timestamptz GENERATED ALWAYS AS (
        greatest(last_outbound_at, last_inbound_at)
    ) STORED;

COMMENT ON COLUMN public.crm_contacts.last_outbound_at IS
    'When the chapter last sent this contact an email: direct email or a broadcast.';
COMMENT ON COLUMN public.crm_contacts.last_inbound_at IS
    'When this contact last submitted a form, RSVP''d, or placed an order.';
COMMENT ON COLUMN public.crm_contacts.last_engaged_at IS
    'The later of last_outbound_at and last_inbound_at. Generated; never write it directly.';

-- Backfill the existing history. `last_contacted_at` is included as an outbound
-- source because it predates the activity log and may be the only surviving
-- record of an old direct email. `greatest()` ignores nulls, so a contact with
-- only one side still gets the right answer.
WITH activity_dates AS (
    SELECT
        contact_id,
        max(created_at) FILTER (WHERE type = 'email_sent') AS outbound,
        max(created_at) FILTER (
            WHERE type IN ('contact_form', 'event_rsvp', 'order')
        ) AS inbound
    FROM public.crm_activities
    GROUP BY contact_id
),
backfilled AS (
    SELECT
        c.id,
        greatest(c.last_contacted_at, a.outbound) AS outbound,
        a.inbound AS inbound
    FROM public.crm_contacts AS c
    LEFT JOIN activity_dates AS a ON a.contact_id = c.id
)
UPDATE public.crm_contacts AS c
SET
    last_outbound_at = greatest(c.last_outbound_at, b.outbound),
    last_inbound_at = greatest(c.last_inbound_at, b.inbound)
FROM backfilled AS b
WHERE c.id = b.id;

-- Keep the legacy column truthful for any reader that still reaches it. The new
-- UI reads the split columns; this is compatibility, not the source of truth.
-- `last_outbound_at` already includes the old `last_contacted_at` in its
-- greatest(), so this can only move the legacy column forward.
UPDATE public.crm_contacts
SET last_contacted_at = last_outbound_at
WHERE last_outbound_at IS NOT NULL
  AND last_contacted_at IS DISTINCT FROM last_outbound_at;

-- Every activity insert now stamps the corresponding contact date. This covers
-- direct email, the broadcast sender, contact-form inserts, RSVPs, orders, and
-- historical syncs without each path remembering to update the contact. The
-- broadcast sender also stamps explicitly after a successful batch, so a failed
-- activity write cannot silently erase the delivery fact.
CREATE OR REPLACE FUNCTION public.fn_crm_stamp_contact_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.type = 'email_sent' THEN
        UPDATE public.crm_contacts
        SET
            last_outbound_at = greatest(
                coalesce(last_outbound_at, NEW.created_at),
                NEW.created_at
            ),
            -- Compatibility: old readers still use this column for "last
            -- emailed", so a broadcast has to move it too.
            last_contacted_at = greatest(
                coalesce(last_contacted_at, NEW.created_at),
                NEW.created_at
            )
        WHERE id = NEW.contact_id;
    ELSIF NEW.type IN ('contact_form', 'event_rsvp', 'order') THEN
        UPDATE public.crm_contacts
        SET last_inbound_at = greatest(
            coalesce(last_inbound_at, NEW.created_at),
            NEW.created_at
        )
        WHERE id = NEW.contact_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_crm_stamp_contact_history() IS
    'Stamps crm_contacts.last_outbound_at or last_inbound_at from an inserted '
    'crm_activities row. Notes and organizer records are ignored.';

DROP TRIGGER IF EXISTS trg_crm_activity_stamps_contact_history ON public.crm_activities;
CREATE TRIGGER trg_crm_activity_stamps_contact_history
    AFTER INSERT ON public.crm_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_crm_stamp_contact_history();

-- The broadcast sender batches its activity rows. If that insert fails (the
-- flood guard can reject a large campaign), the sent email still happened and
-- must still be stamped. This function is the delivery-side stamp: it takes the
-- successful contact ids and never moves a date backwards, so it is safe to run
-- alongside the activity trigger.
CREATE OR REPLACE FUNCTION public.crm_stamp_outbound_contacts(
    p_contact_ids uuid[],
    p_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    UPDATE public.crm_contacts
    SET
        last_outbound_at = greatest(coalesce(last_outbound_at, p_at), p_at),
        last_contacted_at = greatest(coalesce(last_contacted_at, p_at), p_at)
    WHERE id = ANY(p_contact_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.crm_stamp_outbound_contacts(uuid[], timestamptz)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_stamp_outbound_contacts(uuid[], timestamptz)
    TO service_role;

-- `merge_crm_contacts` must carry the split dates across a merge. The current
-- body is large and already handles the consent and donor rules, so keep it as
-- the implementation and wrap it: the wrapper reads both contacts' dates before
-- the duplicate is removed, delegates to the existing function, then writes the
-- greatest values onto the survivor. `last_engaged_at` follows automatically.
ALTER FUNCTION public.merge_crm_contacts(uuid, uuid, uuid)
    RENAME TO merge_crm_contacts_legacy;

REVOKE EXECUTE ON FUNCTION public.merge_crm_contacts_legacy(uuid, uuid, uuid)
    FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.merge_crm_contacts(
    p_keep_id uuid,
    p_remove_id uuid,
    p_actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_keep_outbound timestamptz;
    v_keep_inbound timestamptz;
    v_remove_outbound timestamptz;
    v_remove_inbound timestamptz;
    v_contact uuid;
BEGIN
    -- Lock both rows before reading the dates. The legacy function locks them
    -- again; locks are reentrant inside one transaction, and taking them here
    -- stops a concurrent send from moving a date between the read and the merge.
    PERFORM 1
    FROM public.crm_contacts
    WHERE id IN (p_keep_id, p_remove_id)
    ORDER BY id
    FOR UPDATE;

    SELECT last_outbound_at, last_inbound_at
    INTO v_keep_outbound, v_keep_inbound
    FROM public.crm_contacts
    WHERE id = p_keep_id;

    SELECT last_outbound_at, last_inbound_at
    INTO v_remove_outbound, v_remove_inbound
    FROM public.crm_contacts
    WHERE id = p_remove_id;

    v_contact := public.merge_crm_contacts_legacy(p_keep_id, p_remove_id, p_actor_id);

    UPDATE public.crm_contacts
    SET
        last_outbound_at = greatest(v_keep_outbound, v_remove_outbound),
        last_inbound_at = greatest(v_keep_inbound, v_remove_inbound)
    WHERE id = p_keep_id;

    RETURN v_contact;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_crm_contacts(uuid, uuid, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_crm_contacts(uuid, uuid, uuid)
    TO service_role;

COMMENT ON FUNCTION public.merge_crm_contacts(uuid, uuid, uuid) IS
    'Folds one contact into another through merge_crm_contacts_legacy, preserving '
    'the later outbound and inbound dates from both rows. service_role only; the '
    'authorization boundary is requireAdmin() in the calling action.';
