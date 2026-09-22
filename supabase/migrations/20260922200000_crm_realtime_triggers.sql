-- ── Real-time CRM Sync Triggers ──────────────────────────────────────────
-- Automatically ingest contact submissions, user signups, and store orders
-- into public.crm_contacts and public.crm_activities in real time.

-- 1. Contact Form Submissions -> CRM Contacts & Activities
CREATE OR REPLACE FUNCTION public.fn_sync_contact_submission_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contact_id uuid;
    v_first_name text;
    v_last_name text;
    v_clean_email text;
BEGIN
    v_clean_email := lower(trim(NEW.email));
    v_first_name := split_part(trim(NEW.name), ' ', 1);
    IF position(' ' in trim(NEW.name)) > 0 THEN
        v_last_name := substring(trim(NEW.name) from position(' ' in trim(NEW.name)) + 1);
    ELSE
        v_last_name := NULL;
    END IF;

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
        v_clean_email,
        v_first_name,
        v_last_name,
        'contact_form',
        'supporter',
        ARRAY['contact-form'],
        NEW.created_at,
        NEW.created_at
    )
    ON CONFLICT (email) DO UPDATE
    SET
        first_name = coalesce(crm_contacts.first_name, EXCLUDED.first_name),
        last_name = coalesce(crm_contacts.last_name, EXCLUDED.last_name),
        tags = CASE
            WHEN 'contact-form' = ANY(crm_contacts.tags) THEN crm_contacts.tags
            ELSE array_append(crm_contacts.tags, 'contact-form')
        END,
        updated_at = now()
    RETURNING id INTO v_contact_id;

    -- Record activity
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
        NEW.message,
        jsonb_build_object('submission_id', NEW.id, 'name', NEW.name),
        NEW.created_at
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_submission_to_crm ON public.contact_submissions;
CREATE TRIGGER trg_sync_contact_submission_to_crm
    AFTER INSERT ON public.contact_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_contact_submission_to_crm();

-- 2. User Profiles -> CRM Contacts
CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email text;
    v_first_name text;
    v_last_name text;
    v_status text;
BEGIN
    IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
        RETURN NEW;
    END IF;

    v_clean_email := lower(trim(NEW.email));
    v_first_name := coalesce(NEW.first_name, split_part(trim(coalesce(NEW.full_name, '')), ' ', 1));
    IF NEW.last_name IS NOT NULL THEN
        v_last_name := NEW.last_name;
    ELSIF position(' ' in trim(coalesce(NEW.full_name, ''))) > 0 THEN
        v_last_name := substring(trim(NEW.full_name) from position(' ' in trim(NEW.full_name)) + 1);
    ELSE
        v_last_name := NULL;
    END IF;

    v_status := CASE WHEN NEW.is_admin IS TRUE THEN 'organizer' ELSE 'supporter' END;

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
        v_clean_email,
        v_first_name,
        v_last_name,
        'auth_signup',
        v_status,
        CASE WHEN NEW.is_admin IS TRUE THEN ARRAY['organizer', 'registered-member'] ELSE ARRAY['registered-member'] END,
        coalesce(NEW.created_at, now()),
        now()
    )
    ON CONFLICT (email) DO UPDATE
    SET
        first_name = coalesce(crm_contacts.first_name, EXCLUDED.first_name),
        last_name = coalesce(crm_contacts.last_name, EXCLUDED.last_name),
        status = CASE
            WHEN EXCLUDED.status = 'organizer' THEN 'organizer'
            ELSE crm_contacts.status
        END,
        tags = CASE
            WHEN EXCLUDED.status = 'organizer' AND NOT ('organizer' = ANY(crm_contacts.tags))
                THEN array_append(crm_contacts.tags, 'organizer')
            WHEN NOT ('registered-member' = ANY(crm_contacts.tags))
                THEN array_append(crm_contacts.tags, 'registered-member')
            ELSE crm_contacts.tags
        END,
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_crm ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_crm
    AFTER INSERT OR UPDATE OF email, full_name, first_name, last_name, is_admin ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_profile_to_crm();

-- 3. Store Orders / Donations -> CRM Contacts & Activities
CREATE OR REPLACE FUNCTION public.fn_sync_order_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email text;
    v_contact_id uuid;
    v_cents integer;
BEGIN
    -- Only trigger on successful/processing orders
    IF NEW.status NOT IN ('completed', 'processing') THEN
        RETURN NEW;
    END IF;

    -- Resolve email from billing_address or metadata
    v_clean_email := lower(trim(coalesce(
        NEW.billing_address->>'email',
        NEW.metadata->>'customer_email'
    )));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        SELECT lower(trim(p.email)) INTO v_clean_email
        FROM public.profiles p
        WHERE p.id = NEW.user_id OR p.user_id = NEW.user_id;
    END IF;

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN NEW;
    END IF;

    v_cents := coalesce((NEW.total * 100)::integer, 0);

    -- Find or create contact
    INSERT INTO public.crm_contacts (
        email,
        source,
        status,
        tags,
        total_donated_cents,
        created_at,
        updated_at
    ) VALUES (
        v_clean_email,
        'store_order',
        'donor',
        ARRAY['donor'],
        v_cents,
        NEW.created_at,
        now()
    )
    ON CONFLICT (email) DO UPDATE
    SET
        status = CASE WHEN crm_contacts.status = 'supporter' THEN 'donor' ELSE crm_contacts.status END,
        tags = CASE
            WHEN 'donor' = ANY(crm_contacts.tags) THEN crm_contacts.tags
            ELSE array_append(crm_contacts.tags, 'donor')
        END,
        total_donated_cents = crm_contacts.total_donated_cents + v_cents,
        updated_at = now()
    RETURNING id INTO v_contact_id;

    -- Record activity if not already recorded
    IF NOT EXISTS (
        SELECT 1 FROM public.crm_activities
        WHERE contact_id = v_contact_id
          AND type = 'order'
          AND (metadata->>'order_id')::integer = NEW.id
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
            'Store Order #' || NEW.id,
            'Purchased merchandise / grassroots donation: $' || coalesce(NEW.total::text, '0'),
            jsonb_build_object('order_id', NEW.id, 'total', NEW.total),
            NEW.created_at
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_to_crm ON public.orders;
CREATE TRIGGER trg_sync_order_to_crm
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_order_to_crm();
