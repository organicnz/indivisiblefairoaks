-- ═══════════════════════════════════════════════════════════════════════════
-- CRM + content authoring foundation
--
-- Three concerns, one migration because they are one change set:
--
--   1. crm_stats()            — aggregate the KPI cards in the database instead
--                               of streaming every donor row into the server.
--   2. check_crm_email_flood() — bound outbound email volume at the row level.
--   3. public.content write   — the table has been editor-ready since the
--                               canonical schema (draft status, published_at
--                               embargo, type, featured_image, metadata,
--                               weighted FTS) but had no INSERT/UPDATE/DELETE
--                               policy and no updated_at trigger, so nothing
--                               could ever be written to it.
--
-- Every elevated-privilege function below pins `SET search_path = ''` and
-- qualifies every relation it touches. Note that the pin is *not* sufficient on
-- its own for the existing crm_sync_historical_records(): that function's bare
-- references live inside ON CONFLICT DO UPDATE clauses, where the target
-- relation is bound by the parser rather than resolved through search_path, so
-- they are safe. That was verified against a live instance rather than assumed.
--
-- (This header deliberately avoids naming the elevated-privilege keyword it
-- describes: lefthook's sql-security-definer-guard greps for that token ±10
-- lines and would read the comment as a function missing its search_path pin.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CRM KPI aggregation ─────────────────────────────────────────────────

-- getCRMStats() previously did `.select('total_donated_cents').gt(..., 0)` and
-- reduced in JavaScript. That is O(donors) rows over the wire on every dashboard
-- load, and it grows without bound. One indexed aggregate instead.
CREATE OR REPLACE FUNCTION public.crm_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'total_contacts',
        (SELECT count(*) FROM public.crm_contacts),
        'active_volunteers',
        (SELECT count(*) FROM public.crm_contacts
          WHERE status IN ('active_volunteer', 'choir', 'organizer')),
        'local_district',
        (SELECT count(*) FROM public.crm_contacts
          WHERE district IN ('CA-03', 'CA-06')),
        'total_donors',
        (SELECT count(*) FROM public.crm_contacts WHERE total_donated_cents > 0),
        'total_donations_cents',
        (SELECT coalesce(sum(total_donated_cents), 0) FROM public.crm_contacts),
        'open_tasks',
        (SELECT count(*) FROM public.crm_tasks WHERE status = 'open')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.crm_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_stats() TO service_role;


-- ── 2. Outbound email flood guard ──────────────────────────────────────────

-- The contact form (3/10min/IP) and error reports (5/10min) are both limited,
-- but sendCRMDirectEmail and sendCRMBroadcast had no limiter at all. A
-- double-click on the broadcast confirm dialog, or a compromised admin
-- account, could drain the Resend quota. The in-memory limiter in
-- src/lib/rate-limit.ts is per-isolate and therefore advisory; this is the
-- authoritative bound, and it is keyed on volume rather than on an identity,
-- because a global budget is what actually protects the quota.
--
-- 2,000 outbound messages per hour is roughly an order of magnitude above any
-- plausible chapter broadcast, so a genuine send never trips it.
CREATE OR REPLACE FUNCTION public.check_crm_email_flood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.type = 'email_sent' AND (
        SELECT count(*) FROM public.crm_activities
        WHERE type = 'email_sent'
          AND created_at > now() - interval '1 hour'
    ) >= 2000 THEN
        RAISE EXCEPTION 'crm email flood guard';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_activities_flood_guard ON public.crm_activities;
CREATE TRIGGER crm_activities_flood_guard
    BEFORE INSERT ON public.crm_activities
    FOR EACH ROW EXECUTE FUNCTION public.check_crm_email_flood();


-- ── 3. Content authoring: updated_at, revisions, RLS ───────────────────────

-- `content.updated_at` was declared DEFAULT now() but never maintained, so it
-- froze at insert time and could not be used to order or diff revisions.
CREATE OR REPLACE FUNCTION public.touch_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_touch_updated_at ON public.content;
CREATE TRIGGER content_touch_updated_at
    BEFORE UPDATE ON public.content
    FOR EACH ROW EXECUTE FUNCTION public.touch_content_updated_at();


-- Version history. A visual editor makes it much easier to destroy a page than
-- a raw text box does — a stray drag can drop a section with no undo across
-- sessions. This keeps the last N states of every row so a bad publish is
-- recoverable, which is the difference between a CMS and a content textarea.
CREATE TABLE IF NOT EXISTS public.content_revisions (
    id          BIGSERIAL PRIMARY KEY,
    content_id  INTEGER NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
    title       TEXT,
    slug        TEXT,
    body        TEXT,
    excerpt     TEXT,
    type        TEXT,
    status      TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS content_revisions_content_idx
    ON public.content_revisions (content_id, created_at DESC);

-- BEFORE UPDATE so the revision holds the pre-image (the state being replaced).
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
       OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
        INSERT INTO public.content_revisions (
            content_id, title, slug, body, excerpt, type, status, metadata, created_by
        ) VALUES (
            OLD.id, OLD.title, OLD.slug, OLD.body, OLD.excerpt, OLD.type,
            OLD.status, OLD.metadata, auth.uid()
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

DROP TRIGGER IF EXISTS content_record_revision ON public.content;
CREATE TRIGGER content_record_revision
    BEFORE UPDATE ON public.content
    FOR EACH ROW EXECUTE FUNCTION public.record_content_revision();

ALTER TABLE public.content_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read content revisions" ON public.content_revisions;
CREATE POLICY "Admins can read content revisions"
    ON public.content_revisions FOR SELECT
    TO authenticated
    USING (public.is_admin());

REVOKE ALL ON public.content_revisions FROM anon;
GRANT ALL ON public.content_revisions TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.content_revisions_id_seq TO authenticated, service_role;

-- The public SELECT policy stays exactly as it is: status = 'publish' AND
-- (published_at IS NULL OR published_at <= now()). It is what makes a draft
-- unreachable by the anon key, and it is load-bearing — do not loosen it.
DROP POLICY IF EXISTS "Admins can read unpublished content" ON public.content;
CREATE POLICY "Admins can read unpublished content"
    ON public.content FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can create content" ON public.content;
CREATE POLICY "Admins can create content"
    ON public.content FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- A content row may be moved back to draft but its slug must not be rewritten
-- onto the territory of the legacy Google Sites redirects, or the permanent
-- redirect in next.config.ts would take precedence over a live page.
DROP POLICY IF EXISTS "Admins can update content" ON public.content;
CREATE POLICY "Admins can update content"
    ON public.content FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete content" ON public.content;
CREATE POLICY "Admins can delete content"
    ON public.content FOR DELETE
    TO authenticated
    USING (public.is_admin());
