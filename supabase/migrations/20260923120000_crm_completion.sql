-- ── CRM Completion: follow-up tasks, saved segments, consent, search ─────────
-- Builds the "system" layer on top of 20260922000000_civic_crm.sql:
--   • Email consent / one-click unsubscribe state on crm_contacts
--   • Full-text search vector + GIN index for fast directory lookup
--   • crm_tasks — follow-up / due-date tracking for organizers
--   • crm_segments — persisted directory filters reusable in list + broadcasts
--   • Broadcast delivery failure accounting
--   • New activity types: import, merge
-- Access mirrors the existing CRM: authenticated admins only via public.is_admin().

-- ── 1. Consent & unsubscribe on crm_contacts ─────────────────────────────────
ALTER TABLE public.crm_contacts
    ADD COLUMN IF NOT EXISTS do_not_email boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
    ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_unsubscribe_token
    ON public.crm_contacts (unsubscribe_token);

-- Defensive backfill: any row already flagged must carry a timestamp.
UPDATE public.crm_contacts
SET unsubscribed_at = now()
WHERE do_not_email AND unsubscribed_at IS NULL;

-- ── 2. Full-text search vector ───────────────────────────────────────────────
-- 'simple' config: proper nouns, emails and phone numbers — no language stemming.
-- Tags stay on their existing GIN index (filter via contains), not this vector.
ALTER TABLE public.crm_contacts
    ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple',
            coalesce(email, '') || ' ' ||
            coalesce(first_name, '') || ' ' ||
            coalesce(last_name, '') || ' ' ||
            coalesce(phone, '') || ' ' ||
            coalesce(city, '') || ' ' ||
            coalesce(district, '') || ' ' ||
            coalesce(zip_code, '') || ' ' ||
            coalesce(notes, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_search ON public.crm_contacts USING gin (search_vector);

-- ── 3. Follow-up tasks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    details text,
    due_at date,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    completed_at timestamptz,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON public.crm_tasks (contact_id, created_at DESC);
-- Hot path: the follow-up board filters open tasks ordered by due date.
CREATE INDEX IF NOT EXISTS idx_crm_tasks_open_due
    ON public.crm_tasks (due_at ASC NULLS LAST)
    WHERE status = 'open';

-- ── 4. Saved segments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE CHECK (length(btrim(name)) BETWEEN 1 AND 60),
    query text NOT NULL DEFAULT '',
    statuses text[] NOT NULL DEFAULT '{}'::text[],
    districts text[] NOT NULL DEFAULT '{}'::text[],
    tags text[] NOT NULL DEFAULT '{}'::text[],
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 5. Broadcast delivery accounting ─────────────────────────────────────────
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0);

-- ── 6. New activity types (import + merge audit trail) ───────────────────────
ALTER TABLE public.crm_activities DROP CONSTRAINT IF EXISTS crm_activities_type_check;
ALTER TABLE public.crm_activities
    ADD CONSTRAINT crm_activities_type_check
    CHECK (type IN ('note', 'email_sent', 'contact_form', 'event_rsvp', 'order', 'status_change', 'import', 'merge'));

-- ── 7. Indexes for task/segment lookups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks (status, created_at DESC);

-- ── 8. Grants & RLS (mirror civic_crm pattern: admin-only) ───────────────────
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_tasks FROM anon;
REVOKE ALL ON public.crm_segments FROM anon;
GRANT ALL ON public.crm_tasks TO authenticated, service_role;
GRANT ALL ON public.crm_segments TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can view CRM tasks" ON public.crm_tasks;
CREATE POLICY "Admins can view CRM tasks"
    ON public.crm_tasks FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CRM tasks" ON public.crm_tasks;
CREATE POLICY "Admins can insert CRM tasks"
    ON public.crm_tasks FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CRM tasks" ON public.crm_tasks;
CREATE POLICY "Admins can update CRM tasks"
    ON public.crm_tasks FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CRM tasks" ON public.crm_tasks;
CREATE POLICY "Admins can delete CRM tasks"
    ON public.crm_tasks FOR DELETE
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view CRM segments" ON public.crm_segments;
CREATE POLICY "Admins can view CRM segments"
    ON public.crm_segments FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CRM segments" ON public.crm_segments;
CREATE POLICY "Admins can insert CRM segments"
    ON public.crm_segments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CRM segments" ON public.crm_segments;
CREATE POLICY "Admins can update CRM segments"
    ON public.crm_segments FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CRM segments" ON public.crm_segments;
CREATE POLICY "Admins can delete CRM segments"
    ON public.crm_segments FOR DELETE
    TO authenticated
    USING (public.is_admin());
