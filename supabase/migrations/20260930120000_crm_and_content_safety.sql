-- ═══════════════════════════════════════════════════════════════════════════
-- Schema-level defences for four bugs that code alone could not hold
--
-- Every item here is a case where an invariant was asserted in a comment or a
-- doc and enforced nowhere, so the first time reality disagreed with the
-- comment the failure was silent. The code fixes ship alongside; these are the
-- constraints that make the code fix unnecessary to trust.
--
-- 1. `test_only` is a one-way door with no floor under it.
-- 2. The email flood guard counts broadcast rows and kills their timeline.
-- 3. `crm_contacts` / `crm_tasks` `updated_at` freeze at insert time.
-- 4. `content_revisions` cannot restore a publish date, so restoring re-dates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. A self-test must name exactly one recipient ──────────────────────────
--
-- `crm-broadcast-send` read the flag as
-- `test_only === true && typeof test_recipient === 'string'`. Both columns are
-- nullable and no constraint tied them together, so a `test_only` row with a
-- NULL `test_recipient` evaluated to false, fell out of the self-test branch,
-- and then ran the *audience* loop against every opted-in contact in the
-- database. The function now refuses instead, and this constraint removes the
-- shape that made it reachable.
--
-- `test_recipient` already has a format CHECK (20260929180000). This adds the
-- pairing, so the two halves cannot disagree.
--
-- NOT VALID: a table that already holds rows cannot be validated inside a
-- migration without a scan, and there may be pre-existing offenders. The
-- constraint still applies to every new INSERT and UPDATE immediately, which is
-- the direction that matters — the hole was reachable by writing a row.
ALTER TABLE public.crm_broadcasts
    DROP CONSTRAINT IF EXISTS crm_broadcasts_test_only_needs_recipient;

ALTER TABLE public.crm_broadcasts
    ADD CONSTRAINT crm_broadcasts_test_only_needs_recipient
    CHECK (NOT test_only OR (test_recipient IS NOT NULL AND btrim(test_recipient) <> ''));

COMMENT ON CONSTRAINT crm_broadcasts_test_only_needs_recipient ON public.crm_broadcasts IS
    'A self-test is one address, taken from the session. test_recipient is nullable in its own right, so without this the crm-broadcast-send narrowing could be stepped over by a row whose address was never written — which resolved to the full opted-in audience.';

-- Backfill-then-validate, so the constraint is fully trusted for existing rows
-- too rather than living in permanent NOT VALID limbo. Any pre-existing
-- offender is repaired in place (a self-test with no address becomes a draft,
-- which is what it actually is: unsent) and then validated.
UPDATE public.crm_broadcasts
   SET test_only = FALSE,
       test_recipient = NULL
 WHERE test_only IS TRUE
   AND (test_recipient IS NULL OR btrim(test_recipient) = '');

ALTER TABLE public.crm_broadcasts
    VALIDATE CONSTRAINT crm_broadcasts_test_only_needs_recipient;

-- A draft has no audience, so it has no recipient count. The ceiling is enforced
-- in the sender, but an over-ceiling row that somehow existed should not be
-- dispatchable, and the negative value is meaningless.
ALTER TABLE public.crm_broadcasts
    DROP CONSTRAINT IF EXISTS crm_broadcasts_recipient_count_nonneg;
ALTER TABLE public.crm_broadcasts
    ADD CONSTRAINT crm_broadcasts_recipient_count_nonneg
    CHECK (recipient_count >= 0);

-- ── 2. The flood guard must not count the broadcasts it exists to allow ─────
--
-- `check_crm_email_flood()` RAISEs once 2,000 `email_sent` activities exist in
-- the last hour, whatever created them. That number was sized for the direct
-- email path, where a runaway loop is the thing to stop. A broadcast writes one
-- `email_sent` row per recipient, so a legitimate 2,500-recipient campaign
-- crossed the line mid-run: the trigger fires per row, so every activity insert
-- from that point raised, the sender discarded the error, and the campaign
-- finished `sent` with a full `sent_count` and no timeline on any recipient
-- after the 2,000th. The mail was delivered and the chapter's record of it was
-- not.
--
-- Broadcast rows are identified by `metadata->>'broadcast_id'`, which only the
-- sender writes. They are exempt from the window count and bounded by a much
-- higher cap instead, so a genuine runaway is still stopped: 50,000/hour is ten
-- broadcasts at the 5,000 recipient ceiling.
CREATE OR REPLACE FUNCTION public.check_crm_email_flood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_broadcast boolean := NEW.metadata ? 'broadcast_id';
    v_window integer;
BEGIN
    IF NEW.type <> 'email_sent' THEN
        RETURN NEW;
    END IF;

    IF v_is_broadcast THEN
        -- Backstop only. One broadcast is already capped at
        -- BROADCAST_RECIPIENT_CEILING by the sender, which refuses rather than
        -- truncates; this bounds how many of those can run inside an hour.
        SELECT count(*) INTO v_window
          FROM public.crm_activities
         WHERE type = 'email_sent'
           AND metadata ? 'broadcast_id'
           AND created_at > now() - interval '1 hour';

        IF v_window >= 50000 THEN
            RAISE EXCEPTION
                'crm email flood guard: % broadcast activities in the last hour', v_window;
        END IF;
        RETURN NEW;
    END IF;

    -- Direct sends and any other single-message path.
    SELECT count(*) INTO v_window
      FROM public.crm_activities
     WHERE type = 'email_sent'
       AND NOT (metadata ? 'broadcast_id')
       AND created_at > now() - interval '1 hour';

    IF v_window >= 2000 THEN
        RAISE EXCEPTION
            'crm email flood guard: % non-broadcast email activities in the last hour', v_window;
    END IF;

    RETURN NEW;
END;
$$;

-- ── 3. updated_at has to be maintained by the database ──────────────────────
--
-- `crm_contacts.updated_at` and `crm_tasks.updated_at` both carry
-- `DEFAULT now()` and no trigger. The two actions that do write them set the
-- value by hand, which made the column look maintained: it advanced when a
-- volunteer edited a contact and froze when the contact sync triggers created
-- or updated the row. Any query that orders by recency — the directory is
-- `updated_at desc` — therefore returned the sync-written rows in an arbitrary
-- position rather than at their real age. `content.updated_at` got this trigger
-- in 20260929120000; the two CRM tables were left behind.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_contacts_touch_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_touch_updated_at
    BEFORE UPDATE ON public.crm_contacts
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS crm_tasks_touch_updated_at ON public.crm_tasks;
CREATE TRIGGER crm_tasks_touch_updated_at
    BEFORE UPDATE ON public.crm_tasks
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 4. A restore must not re-date a post ───────────────────────────────────
--
-- `setContentStatus` was written specifically to preserve `published_at` when a
-- page moves back to draft, so un-publishing does not reorder the news feed.
-- `restoreContentRevision` then routed around it: it re-entered `saveContent`
-- without a `publishedAt`, and `saveContent` re-stamps `published_at = now()`
-- for a published page. Restoring a revision of a post from March re-dated it
-- to today and jumped it to the top of `/news`, with nothing in the UI saying
-- so.
--
-- The root cause is that `content_revisions` never stored the date, so there was
-- nothing to restore. Add it, capture it, and let the action pass it through.
ALTER TABLE public.content_revisions
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

COMMENT ON COLUMN public.content_revisions.published_at IS
    'published_at at the time the revision was captured. Restoring this is what stops a restore from re-dating the post and reordering the feed.';

CREATE OR REPLACE FUNCTION public.record_content_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.excerpt IS DISTINCT FROM OLD.excerpt
       OR NEW.featured_image IS DISTINCT FROM OLD.featured_image
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
        INSERT INTO public.content_revisions (
            content_id, title, slug, body, excerpt, type, status,
            featured_image, metadata, published_at, created_by
        ) VALUES (
            OLD.id, OLD.title, OLD.slug, OLD.body, OLD.excerpt, OLD.type,
            OLD.status, OLD.featured_image, OLD.metadata, OLD.published_at, auth.uid()
        );

        -- Bounded history: keep the 50 most recent per page. Without a cap this
        -- table grows by a full body copy on every keystroke-triggered save.
        DELETE FROM public.content_revisions
        WHERE content_id = OLD.id
          AND id NOT IN (
              SELECT id FROM public.content_revisions
              WHERE content_id = OLD.id
              ORDER BY created_at DESC, id DESC
              LIMIT 50
          );
    END IF;
    RETURN NEW;
END;
$$;

-- Reorder once, for rows that already exist, so the directory is not showing a
-- mixture of true and frozen timestamps while the trigger rolls out.
UPDATE public.crm_contacts SET updated_at = now() WHERE updated_at IS NULL;
UPDATE public.crm_tasks    SET updated_at = now() WHERE updated_at IS NULL;
