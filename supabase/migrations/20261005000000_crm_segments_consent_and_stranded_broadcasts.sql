-- Civic CRM — segments gain a consent filter, plus the search-path indexes the
-- directory's common filters rely on.
--
-- ── Why consent is on `crm_segments` ──────────────────────────────────────────
--
-- `consent` is enforced and counted in four places and was applied through the
-- URL in two, but a segment could not store it. So "everyone who opted out of
-- email" — the audit a chapter most often needs to repeat — could be applied but
-- not saved: the Save button's enablement check did not read the field either, so
-- it stayed disabled with a working opt-out filter on screen.
--
-- Nullable, with NULL meaning "no consent filter" rather than "opted in". An
-- existing segment row therefore keeps its exact previous meaning, which is what
-- a new column on a filter definition has to do: adding an opinion to a saved
-- audience must not change that audience.
--
-- NULL rather than a sentinel string because `'all'` in a text column is a value
-- every caller has to remember to special-case, and this codebase has already
-- forgotten to special-case a filter once (the export and the quick pills both
-- dropped `consent` from the URL).
ALTER TABLE public.crm_segments
    ADD COLUMN IF NOT EXISTS consent text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'crm_segments_consent_check'
    ) THEN
        ALTER TABLE public.crm_segments
            ADD CONSTRAINT crm_segments_consent_check
            -- 'unasked' is in the list from the start rather than added later:
            -- `crm_contacts.do_not_email` is tri-state (migration
            -- 20261005020000), and a segment that could not express the third
            -- state would filter a directory that can. Listing it now means no
            -- second ALTER for a column that was born in the wrong shape.
            CHECK (consent IS NULL OR consent IN ('opted_out', 'opted_in', 'unasked'));
    END IF;
END;
$$;

COMMENT ON COLUMN public.crm_segments.consent IS
    'Email-consent filter: opted_out | opted_in | unasked, or NULL for no consent '
    'filter. NULL does not mean opted in — it means the segment does not filter on '
    'consent.';

-- ── Indexes for the directory's default and audited queries ───────────────────
--
-- `fetchContactPage` orders by `created_at DESC, id DESC` on every page load and
-- pages with `.range()`. Offset paging needs that order to be index-backed or the
-- database sorts the whole table per page; with a few thousand constituents that
-- is the single most expensive read on the CRM. The trailing `id` breaks
-- `created_at` ties, which a bulk CSV import produces in bulk.
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_id
    ON public.crm_contacts (created_at DESC, id DESC);

-- The consent audit reads the whole opted-out population with no other filter,
-- so `do_not_email` alone has to be index-backed rather than a table scan.
CREATE INDEX IF NOT EXISTS idx_crm_contacts_do_not_email
    ON public.crm_contacts (do_not_email)
    WHERE do_not_email IS NOT FALSE;

-- A broadcast audience is `do_not_email = false` plus optional status/district
-- filters, ordered by id. The partial index matches the resolver's query and is
-- much smaller than the full table for a chapter whose list is mostly opted in.
CREATE INDEX IF NOT EXISTS idx_crm_contacts_opted_in_id
    ON public.crm_contacts (id)
    WHERE do_not_email IS FALSE;

-- `getCRMExistingTags` pages the table to collect distinct tags on every CRM
-- page load. A GIN index on `tags` cannot serve that query — the read orders by
-- `id` with no tag predicate — so this index covers the `.contains('tags', …)`
-- audience filter instead, which is the actual consumer. (That index already
-- existed from 20260922000000; the earlier version of this comment claimed it
-- served the tag scan, which it cannot.)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags
    ON public.crm_contacts USING gin (tags);

-- ── A stuck `sending` broadcast needs a way out from the UI ────────────────────
--
-- `docs/crm-operations.md` documents the recovery as "send a new, narrower
-- broadcast" — which is correct but manual, and the composer offers no way to
-- mark a stranded row failed. Two organizers could not tell a genuinely stuck row
-- from one still progressing, because the only signal is a poll that has stopped.
--
-- This does not add a retry: clearing `dispatched_at` re-sends to everyone
-- already delivered to, which is the one action the documentation is most emphatic
-- about never taking. It adds an *explicit human decision* to fail a row, which is
-- safe because it can only ever stop delivery, never restart it.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS marked_failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS marked_failed_by UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'crm_broadcasts_marked_failed_actor_fk'
    ) THEN
        -- ON DELETE SET NULL, not CASCADE: the audit of *who* decided a campaign
        -- was stuck must survive the deletion of the admin account that decided
        -- it. The timestamp is the durable part; the actor is context.
        ALTER TABLE public.crm_broadcasts
            ADD CONSTRAINT crm_broadcasts_marked_failed_actor_fk
            FOREIGN KEY (marked_failed_by) REFERENCES public.profiles (id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

COMMENT ON COLUMN public.crm_broadcasts.marked_failed_at IS
    'When an organizer explicitly declared a stranded campaign failed. Never set '
    'automatically: the sender owns the lifecycle, and an automatic timeout would '
    'fire on a slow-but-healthy send.';
COMMENT ON COLUMN public.crm_broadcasts.marked_failed_by IS
    'profiles.id of the organizer who marked it failed. SET NULL if that account is '
    'deleted, so the timestamp survives as evidence.';

-- A stuck row is what an organizer looks for, and it is a rare state — a partial
-- index keeps this off the hot history query, which is `WHERE status <> 'draft'`.
CREATE INDEX IF NOT EXISTS idx_crm_broadcasts_stranded
    ON public.crm_broadcasts (created_at DESC)
    WHERE status = 'sending';
