-- ── CRM audit fixes ──────────────────────────────────────────────────────────
-- 1. Allow source = 'import' (CSV import was rejected by the original CHECK).
-- 2. Make order → CRM donation sync idempotent (no double-count on re-fire /
--    status churn / historical re-sync).
-- 3. Make crm_sync_historical_records() idempotent for tags + donation totals.

-- ── 1. source CHECK: include CSV import provenance ───────────────────────────
ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_source_check;
ALTER TABLE public.crm_contacts
    ADD CONSTRAINT crm_contacts_source_check
    CHECK (source IN ('contact_form', 'auth_signup', 'store_order', 'manual', 'event_rsvp', 'import'));

-- ── 2. Order trigger: count each order's amount at most once ─────────────────
-- Donation is applied only when the order activity row is first inserted.
-- Contact upsert no longer increments total_donated_cents.
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
    IF NEW.status NOT IN ('completed', 'processing') THEN
        RETURN NEW;
    END IF;

    v_clean_email := lower(trim(coalesce(
        NEW.billing_address->>'email',
        NEW.metadata->>'customer_email'
    )));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        SELECT lower(trim(p.email)) INTO v_clean_email
        FROM public.profiles p
        WHERE p.id = NEW.user_id OR p.user_id = NEW.user_id
        LIMIT 1;
    END IF;

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN NEW;
    END IF;

    v_cents := coalesce((NEW.total * 100)::integer, 0);

    -- Upsert contact without touching the donation total here.
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
        0,
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
        updated_at = now()
    RETURNING id INTO v_contact_id;

    -- First time we see this order → record activity AND apply the amount once.
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

        UPDATE public.crm_contacts
        SET total_donated_cents = total_donated_cents + v_cents,
            updated_at = now()
        WHERE id = v_contact_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger definition is unchanged; function body replaced above.
DROP TRIGGER IF EXISTS trg_sync_order_to_crm ON public.orders;
CREATE TRIGGER trg_sync_order_to_crm
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_order_to_crm();

-- ── 3. Historical sync: idempotent tags + one-time donation application ──────
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
        SET tags = CASE
                WHEN 'contact-form' = ANY(crm_contacts.tags) THEN crm_contacts.tags
                ELSE array_append(crm_contacts.tags, 'contact-form')
            END
        RETURNING id INTO v_contact_id;

        v_contacts_synced := v_contacts_synced + 1;

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
            tags = (
                SELECT array_agg(DISTINCT t ORDER BY t)
                FROM unnest(crm_contacts.tags || EXCLUDED.tags) AS t
            );

        v_contacts_synced := v_contacts_synced + 1;
    END LOOP;

    -- 3. Sync from completed orders (tag donor; apply total only once per order)
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
                tags = CASE
                    WHEN 'donor' = ANY(tags) THEN tags
                    ELSE array_append(tags, 'donor')
                END,
                updated_at = now()
            WHERE id = v_contact_id;

            IF NOT EXISTS (
                SELECT 1 FROM public.crm_activities
                WHERE contact_id = v_contact_id
                  AND type = 'order'
                  AND (metadata->>'order_id')::integer = r.id
            ) THEN
                UPDATE public.crm_contacts
                SET total_donated_cents = total_donated_cents + coalesce((r.total * 100)::integer, 0)
                WHERE id = v_contact_id;

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
