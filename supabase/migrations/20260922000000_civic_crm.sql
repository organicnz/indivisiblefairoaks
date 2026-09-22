-- ── Grassroots Civic CRM & Outreach Schema ────────────────────────────────────
-- Tables for constituent relationship management, activity logging, and
-- targeted email broadcasts powered by Resend.
-- Access is gated strictly to authenticated admins via public.is_admin().

CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    first_name text,
    last_name text,
    phone text,
    address text,
    city text,
    zip_code text,
    district text DEFAULT 'CA-06',
    status text NOT NULL DEFAULT 'supporter'
        CHECK (status IN ('active_volunteer', 'supporter', 'donor', 'choir', 'organizer', 'inactive')),
    tags text[] NOT NULL DEFAULT '{}'::text[],
    notes text,
    source text NOT NULL DEFAULT 'manual'
        CHECK (source IN ('contact_form', 'auth_signup', 'store_order', 'manual', 'event_rsvp')),
    total_donated_cents integer NOT NULL DEFAULT 0 CHECK (total_donated_cents >= 0),
    last_contacted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    type text NOT NULL
        CHECK (type IN ('note', 'email_sent', 'contact_form', 'event_rsvp', 'order', 'status_change')),
    title text NOT NULL,
    description text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.crm_broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject text NOT NULL,
    body text NOT NULL,
    target_tags text[] NOT NULL DEFAULT '{}'::text[],
    target_status text[] NOT NULL DEFAULT '{}'::text[],
    target_districts text[] NOT NULL DEFAULT '{}'::text[],
    recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON public.crm_contacts (email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON public.crm_contacts (status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_district ON public.crm_contacts (district);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON public.crm_contacts USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON public.crm_contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON public.crm_activities (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_broadcasts_created_at ON public.crm_broadcasts (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_broadcasts ENABLE ROW LEVEL SECURITY;

-- Revoke anon access
REVOKE ALL ON public.crm_contacts FROM anon;
REVOKE ALL ON public.crm_activities FROM anon;
REVOKE ALL ON public.crm_broadcasts FROM anon;

-- Grant access to authenticated users and service_role
GRANT ALL ON public.crm_contacts TO authenticated, service_role;
GRANT ALL ON public.crm_activities TO authenticated, service_role;
GRANT ALL ON public.crm_broadcasts TO authenticated, service_role;

-- RLS Policies — strictly require admin privileges
DROP POLICY IF EXISTS "Admins can view CRM contacts" ON public.crm_contacts;
CREATE POLICY "Admins can view CRM contacts"
    ON public.crm_contacts FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CRM contacts" ON public.crm_contacts;
CREATE POLICY "Admins can insert CRM contacts"
    ON public.crm_contacts FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CRM contacts" ON public.crm_contacts;
CREATE POLICY "Admins can update CRM contacts"
    ON public.crm_contacts FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CRM contacts" ON public.crm_contacts;
CREATE POLICY "Admins can delete CRM contacts"
    ON public.crm_contacts FOR DELETE
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view CRM activities" ON public.crm_activities;
CREATE POLICY "Admins can view CRM activities"
    ON public.crm_activities FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CRM activities" ON public.crm_activities;
CREATE POLICY "Admins can insert CRM activities"
    ON public.crm_activities FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CRM activities" ON public.crm_activities;
CREATE POLICY "Admins can update CRM activities"
    ON public.crm_activities FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CRM activities" ON public.crm_activities;
CREATE POLICY "Admins can delete CRM activities"
    ON public.crm_activities FOR DELETE
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view CRM broadcasts" ON public.crm_broadcasts;
CREATE POLICY "Admins can view CRM broadcasts"
    ON public.crm_broadcasts FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CRM broadcasts" ON public.crm_broadcasts;
CREATE POLICY "Admins can insert CRM broadcasts"
    ON public.crm_broadcasts FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CRM broadcasts" ON public.crm_broadcasts;
CREATE POLICY "Admins can update CRM broadcasts"
    ON public.crm_broadcasts FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CRM broadcasts" ON public.crm_broadcasts;
CREATE POLICY "Admins can delete CRM broadcasts"
    ON public.crm_broadcasts FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- Historical sync helper function: populates CRM contacts from contact_submissions & profiles
CREATE OR REPLACE FUNCTION public.crm_sync_historical_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contacts_synced integer := 0;
    v_activities_created integer := 0;
    r record;
    v_contact_id uuid;
BEGIN
    -- 1. Sync from contact_submissions
    FOR r IN (
        SELECT id, name, email, message, created_at
        FROM public.contact_submissions
        ORDER BY created_at ASC
    ) LOOP
        -- Upsert contact
        INSERT INTO public.crm_contacts (
            email,
            first_name,
            last_name,
            source,
            status,
            tags,
            created_at,
            updated_at
        ) VALUES (
            lower(trim(r.email)),
            split_part(trim(r.name), ' ', 1),
            CASE WHEN position(' ' in trim(r.name)) > 0
                 THEN substring(trim(r.name) from position(' ' in trim(r.name)) + 1)
                 ELSE NULL END,
            'contact_form',
            'supporter',
            ARRAY['contact-form'],
            r.created_at,
            r.created_at
        )
        ON CONFLICT (email) DO UPDATE
        SET tags = array_cat(crm_contacts.tags, ARRAY['contact-form'])
        RETURNING id INTO v_contact_id;

        v_contacts_synced := v_contacts_synced + 1;

        -- Record activity if not already present
        IF NOT EXISTS (
            SELECT 1 FROM public.crm_activities
            WHERE contact_id = v_contact_id
              AND type = 'contact_form'
              AND (metadata->>'submission_id')::integer = r.id
        ) THEN
            INSERT INTO public.crm_activities (
                contact_id,
                type,
                title,
                description,
                metadata,
                created_at
            ) VALUES (
                v_contact_id,
                'contact_form',
                'Submitted Website Contact Form',
                r.message,
                jsonb_build_object('submission_id', r.id, 'name', r.name),
                r.created_at
            );
            v_activities_created := v_activities_created + 1;
        END IF;
    END LOOP;

    -- 2. Sync from profiles
    FOR r IN (
        SELECT id, user_id, email, full_name, is_admin
        FROM public.profiles
        WHERE email IS NOT NULL AND trim(email) <> ''
    ) LOOP
        INSERT INTO public.crm_contacts (
            email,
            first_name,
            last_name,
            source,
            status,
            tags,
            created_at,
            updated_at
        ) VALUES (
            lower(trim(r.email)),
            split_part(trim(coalesce(r.full_name, '')), ' ', 1),
            CASE WHEN position(' ' in trim(coalesce(r.full_name, ''))) > 0
                 THEN substring(trim(r.full_name) from position(' ' in trim(r.full_name)) + 1)
                 ELSE NULL END,
            'auth_signup',
            CASE WHEN r.is_admin IS TRUE THEN 'organizer' ELSE 'supporter' END,
            CASE WHEN r.is_admin IS TRUE THEN ARRAY['organizer', 'registered-member'] ELSE ARRAY['registered-member'] END,
            now(),
            now()
        )
        ON CONFLICT (email) DO UPDATE
        SET
            first_name = coalesce(crm_contacts.first_name, EXCLUDED.first_name),
            last_name = coalesce(crm_contacts.last_name, EXCLUDED.last_name),
            tags = array_cat(crm_contacts.tags, EXCLUDED.tags);

        v_contacts_synced := v_contacts_synced + 1;
    END LOOP;

    -- 3. Sync from completed orders (tag with 'donor', sum total)
    FOR r IN (
        SELECT o.id,
               coalesce(p.email, o.billing_address->>'email', o.metadata->>'customer_email') AS email,
               o.total,
               o.created_at,
               o.status
        FROM public.orders o
        LEFT JOIN public.profiles p ON p.id = o.user_id OR p.user_id = o.user_id
        WHERE o.status IN ('completed', 'processing')
          AND coalesce(p.email, o.billing_address->>'email', o.metadata->>'customer_email') IS NOT NULL
    ) LOOP
        SELECT id INTO v_contact_id FROM public.crm_contacts WHERE email = lower(trim(r.email));
        IF v_contact_id IS NOT NULL THEN
            UPDATE public.crm_contacts
            SET
                status = CASE WHEN status = 'supporter' THEN 'donor' ELSE status END,
                tags = array_cat(tags, ARRAY['donor']),
                total_donated_cents = total_donated_cents + coalesce((r.total * 100)::integer, 0)
            WHERE id = v_contact_id;

            IF NOT EXISTS (
                SELECT 1 FROM public.crm_activities
                WHERE contact_id = v_contact_id
                  AND type = 'order'
                  AND (metadata->>'order_id')::integer = r.id
            ) THEN
                INSERT INTO public.crm_activities (
                    contact_id,
                    type,
                    title,
                    description,
                    metadata,
                    created_at
                ) VALUES (
                    v_contact_id,
                    'order',
                    'Store Order #' || r.id,
                    'Purchased merchandise / donated: $' || coalesce(r.total::text, '0'),
                    jsonb_build_object('order_id', r.id, 'total', r.total),
                    r.created_at
                );
                v_activities_created := v_activities_created + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'contacts_synced', v_contacts_synced,
        'activities_created', v_activities_created
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_sync_historical_records() TO authenticated, service_role;
