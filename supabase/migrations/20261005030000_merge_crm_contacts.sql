-- Civic CRM: `merge_crm_contacts` as one atomic, locked statement.
--
-- ── What it replaces ─────────────────────────────────────────────────────────
--
-- `mergeCRMContacts` in `src/lib/actions/crm.ts` ran four independent statements:
--
--   1. UPDATE crm_activities SET contact_id = keep  WHERE contact_id = remove
--   2. UPDATE crm_tasks     SET contact_id = keep  WHERE contact_id = remove
--   3. UPDATE crm_contacts  SET …                 WHERE id = keep
--   4. DELETE FROM crm_contacts                  WHERE id = remove
--   5. INSERT INTO crm_activities (the audit row)
--
-- PostgREST gives each statement its own transaction. A failure at step 3 or 4
-- therefore left the duplicate row alive with its activities *and* its tasks
-- already re-pointed at the survivor — so the constituent had a double-counted
-- timeline, the same follow-up appeared twice on the board, and the error text
-- named only the step that happened to fail. Nothing rolled back, and nothing
-- said so.
--
-- ── Why a lock, not just a transaction ────────────────────────────────────────
--
-- A transaction alone does not fix the second failure. Two organizers merging
-- the same pair concurrently both read `keep` and `remove`, both add their
-- `total_donated_cents` to the *same pre-merge value*, and the survivor's giving
-- total ends up inflated by one copy. `SELECT … FOR UPDATE` on the survivor
-- serialises the second one behind the first, so it reads the already-merged row
-- and its arithmetic is correct. Both rows are locked; the survivor is locked
-- first because that is the one whose scalar columns are summed.
--
-- ── Authorization ────────────────────────────────────────────────────────────
--
-- `SECURITY DEFINER`, because the caller is the service-role client (which
-- bypasses RLS) and `created_by` must be written as the acting organizer rather
-- than as the function owner. Granted to `service_role` only, and revoked from
-- `PUBLIC` and `anon` — the same shape as `crm_stats()` in 20260929120000. The
-- real authorization boundary is `requireAdmin()` in the action, which has
-- already checked the session, the MFA step-up and `profiles.is_admin`; the RLS
-- policies on these tables remain as defence in depth for any future direct
-- client path.
--
-- `search_path = ''` with every relation qualified, for the reason
-- 20261005010000 spells out at length.
CREATE OR REPLACE FUNCTION public.merge_crm_contacts(
    p_keep_id   uuid,
    p_remove_id uuid,
    p_actor_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_keep    public.crm_contacts%ROWTYPE;
    v_remove  public.crm_contacts%ROWTYPE;
    v_tags    text[];
    v_notes   text;
    v_contact uuid;
BEGIN
    IF p_keep_id IS NULL OR p_remove_id IS NULL THEN
        RAISE EXCEPTION 'both contacts are required';
    END IF;

    IF p_keep_id = p_remove_id THEN
        RAISE EXCEPTION 'cannot merge a contact into itself';
    END IF;

    -- Lock both rows, survivor first, so the lock order is the same on every
    -- call. Two merges that grabbed the rows in opposite orders would
    -- deadlock; Postgres would detect it and abort one, but an aborted merge
    -- reported as "could not merge" is a worse answer than one that waits.
    --
    -- Each guard immediately follows its own SELECT. `FOUND` is set by the
    -- *immediately preceding* statement, so a single `IF NOT FOUND` after both
    -- SELECTs tests the second one while naming the first: a missing duplicate
    -- then raises "the contact being kept does not exist", and the
    -- duplicate's own guard below it is dead for exactly the case it was
    -- written for. The error names the wrong cause in the documented race.
    SELECT * INTO v_keep FROM public.crm_contacts WHERE id = p_keep_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'the contact being kept does not exist';
    END IF;

    -- The lock is also the race guard: a concurrent merge of the same pair may
    -- have folded this row away between the action's read and this call, in
    -- which case there is nothing to lock and `FOUND` is false. Merging into a
    -- survivor that no longer exists would resurrect a deleted constituent's
    -- data under a dangling id.
    SELECT * INTO v_remove FROM public.crm_contacts WHERE id = p_remove_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'the duplicate contact no longer exists — it may already have been merged';
    END IF;

    -- Same normalization the action used, so the result does not depend on which
    -- caller got here. `array_append` in a SELECT list would not aggregate, and
    -- the union has to be deduped case-insensitively or a merge introduces the
    -- mixed-case rows that follow-up #6 is still waiting to clean up.
    SELECT array_agg(DISTINCT lower(btrim(t)) ORDER BY lower(btrim(t)))
    INTO v_tags
    FROM (
        SELECT unnest(coalesce(v_keep.tags, ARRAY[]::text[])) AS t
        UNION
        SELECT unnest(coalesce(v_remove.tags, ARRAY[]::text[])) AS t
    ) AS all_tags
    WHERE t IS NOT NULL AND btrim(t) <> '';

    v_tags := coalesce(v_tags, ARRAY[]::text[]);

    v_notes := nullif(
        trim(
            concat_ws(
                E'\n\n---\n\n',
                nullif(btrim(coalesce(v_keep.notes, '')), ''),
                nullif(btrim(coalesce(v_remove.notes, '')), '')
            )
        ),
        ''
    );

    -- Move the children first. `crm_activities` and `crm_tasks` both reference
    -- `crm_contacts(id)` with ON DELETE CASCADE, so deleting the duplicate
    -- *before* moving them destroys the timeline and the follow-ups outright.
    -- That ordering is the whole reason this is a function and not a shorter
    -- action.
    UPDATE public.crm_activities
    SET contact_id = p_keep_id
    WHERE contact_id = p_remove_id;

    UPDATE public.crm_tasks
    SET contact_id = p_keep_id
    WHERE contact_id = p_remove_id;

    UPDATE public.crm_contacts
    SET
        tags = v_tags,
        notes = v_notes,
        total_donated_cents = coalesce(v_keep.total_donated_cents, 0)
                              + coalesce(v_remove.total_donated_cents, 0),
        last_contacted_at = CASE
            WHEN v_keep.last_contacted_at IS NULL THEN v_remove.last_contacted_at
            WHEN v_remove.last_contacted_at IS NULL THEN v_keep.last_contacted_at
            ELSE greatest(v_keep.last_contacted_at, v_remove.last_contacted_at)
        END,
        -- Scalar fields the survivor captured, carried forward from the
        -- duplicate when the survivor is blank. The old UPDATE set five
        -- columns and dropped the rest: a second phone number, a second
        -- address, or the duplicate's `status = 'donor'` all disappeared
        -- silently. `status` is the sharp one — `crm_stats()` counts donors
        -- by `total_donated_cents > 0`, so the merged contact still counted
        -- as a donor while no `status`-filtered audience could ever select
        -- them again. Survivor wins when set; otherwise the duplicate's
        -- value is brought forward rather than lost.
        phone = coalesce(nullif(btrim(v_keep.phone), ''), nullif(btrim(v_remove.phone), '')),
        address = coalesce(nullif(btrim(v_keep.address), ''), nullif(btrim(v_remove.address), '')),
        city = coalesce(nullif(btrim(v_keep.city), ''), nullif(btrim(v_remove.city), '')),
        zip_code = coalesce(nullif(btrim(v_keep.zip_code), ''), nullif(btrim(v_remove.zip_code), '')),
        district = coalesce(nullif(btrim(v_keep.district), ''), nullif(btrim(v_remove.district), '')),
        status = coalesce(v_keep.status, v_remove.status),
        -- Tri-state OR, written out rather than as `coalesce(… , false) OR …`.
        --
        -- The plain `OR` version was written when the column was `NOT NULL`, and
        -- `coalesce(NULL, false)` is what made that safe. It stops being safe
        -- once NULL exists: two contacts who were *both never asked* coalesce to
        -- `false OR false` = `false` — "agreed" — and the merged record is
        -- silently opted into broadcast mail that neither of them asked for. So
        -- the three cases are enumerated:
        --
        --   either is TRUE              → TRUE   (a decline survives the merge)
        --   neither is TRUE, one is not  → FALSE  (an explicit yes exists)
        --   both NULL                    → NULL   (still never asked)
        --
        -- The first branch is the one that matters legally. Taking the survivor's
        -- `false` over a duplicate's `true` would put somebody who unsubscribed
        -- back into a broadcast audience.
        do_not_email = CASE
            WHEN coalesce(v_keep.do_not_email, false)
              OR coalesce(v_remove.do_not_email, false) THEN true
            WHEN v_keep.do_not_email IS NOT NULL
              OR v_remove.do_not_email IS NOT NULL THEN false
            ELSE NULL
        END,
        -- One-click unsubscribe tokens are per-contact and the URL is already in
        -- inboxes, so the survivor keeps its own and the duplicate's is dropped
        -- with its row. A merged address is not re-subscribable by the old token:
        -- the link stops working rather than silently retargeting, which is the
        -- correct direction for an unsubscribe URL to fail in.
        --
        -- The timestamp is preserved, not cleared. `crm.ts`'s
        -- `setCRMEmailConsent` deliberately leaves `unsubscribed_at` in place
        -- when consent is restored — restoring consent is not erasing the
        -- evidence that somebody once unsubscribed. The merge used to do the
        -- opposite: `ELSE NULL` wiped the survivor's timestamp whenever merged
        -- consent was `false` or `NULL`. Two deliberate policies, and the one
        -- that lost information was the merge. A past unsubscribe is a
        -- historical fact: the old timestamp records it regardless of current
        -- consent, and if they re-consent then unsubscribe again the new
        -- timestamp overwrites the old. Coalescing survivor-first preserves
        -- whichever evidence exists.
        unsubscribed_at = CASE
            -- keep the earliest real timestamp; a later timestamp from a
            -- re-subscribe would already have been overwritten by
            -- `setCRMEmailConsent` on whichever row it hit.
            WHEN v_keep.unsubscribed_at IS NOT NULL AND v_remove.unsubscribed_at IS NOT NULL
                THEN least(v_keep.unsubscribed_at, v_remove.unsubscribed_at)
            WHEN v_keep.unsubscribed_at IS NOT NULL THEN v_keep.unsubscribed_at
            WHEN v_remove.unsubscribed_at IS NOT NULL THEN v_remove.unsubscribed_at
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_keep_id
    RETURNING id INTO v_contact;

    -- The audit row goes before the DELETE for the same CASCADE reason: once the
    -- duplicate is gone, `contact_id = keep` is fine, but writing it after means a
    -- failure between the two loses the record that a merge happened at all.
    INSERT INTO public.crm_activities (
        contact_id,
        type,
        title,
        description,
        metadata,
        created_by,
        created_at
    ) VALUES (
        p_keep_id,
        'merge',
        'Merged Duplicate Contact',
        format('Consolidated %s into %s', v_remove.email, v_keep.email),
        jsonb_build_object(
            'removed_id', p_remove_id,
            'removed_email', v_remove.email,
            'merged_tags', to_jsonb(v_tags),
            'merged_donations_cents',
                coalesce(v_keep.total_donated_cents, 0) + coalesce(v_remove.total_donated_cents, 0)
        ),
        p_actor_id,
        now()
    );

    DELETE FROM public.crm_contacts WHERE id = p_remove_id;

    RETURN v_contact;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_crm_contacts(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_crm_contacts(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.merge_crm_contacts(uuid, uuid, uuid) IS
    'Atomically folds one crm_contacts row into another: moves activities and tasks, '
    'unions tags and notes, sums donations, ORs the opt-out flag, records an audit '
    'row, and deletes the duplicate. Locks both rows (survivor first) so concurrent '
    'merges of the same pair serialise instead of double-counting. service_role only; '
    'the authorization boundary is requireAdmin() in the calling action.';
