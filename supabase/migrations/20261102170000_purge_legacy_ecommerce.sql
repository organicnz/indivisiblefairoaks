-- Migration: 20261102170000_purge_legacy_ecommerce.sql
--
-- Deprecate and purge legacy ecommerce artifacts (#158).
--
-- Indivisible Fair Oaks is a grassroots political action organization focused
-- on civic engagement, voter information, events, and community action.
-- The platform does not sell products, operate a commercial storefront, or
-- process retail orders/checkouts.
--
-- This migration safely decommissions unused ecommerce tables, triggers,
-- functions, and obsolete catalog data points.

-- ── 1. Drop ecommerce triggers & functions ───────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_order_to_crm ON public.orders;
DROP FUNCTION IF EXISTS public.fn_sync_order_to_crm();
DROP FUNCTION IF EXISTS public.decrement_stock(integer, integer);
DROP FUNCTION IF EXISTS public.search_products(text, integer);
DROP FUNCTION IF EXISTS public.validate_coupon(text);

-- ── 2. Update crm_sync_historical_records() to remove orders sync ─────────────

CREATE OR REPLACE FUNCTION public.crm_sync_historical_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
                WHEN 'contact-form' = ANY(public.crm_contacts.tags) THEN public.crm_contacts.tags
                ELSE array_append(public.crm_contacts.tags, 'contact-form')
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
            first_name = coalesce(public.crm_contacts.first_name, EXCLUDED.first_name),
            last_name = coalesce(public.crm_contacts.last_name, EXCLUDED.last_name),
            tags = (
                SELECT array_agg(DISTINCT t ORDER BY t)
                FROM unnest(public.crm_contacts.tags || EXCLUDED.tags) AS t
            );

        v_contacts_synced := v_contacts_synced + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'contacts_synced', v_contacts_synced,
        'activities_created', v_activities_created
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_sync_historical_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_sync_historical_records() TO service_role;

-- ── 3. Decommission legacy ecommerce tables ──────────────────────────────────

DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;
DROP TABLE IF EXISTS public.product_variations CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

-- ── 4. Purge obsolete catalog data points ────────────────────────────────────

DELETE FROM public.data_points
 WHERE key LIKE 'products.%'
    OR key LIKE 'product.%'
    OR key LIKE 'shipping.%'
    OR key LIKE 'admin.coupons.%'
    OR key LIKE 'admin.products.%'
    OR key LIKE 'admin.actions.products'
    OR key LIKE 'admin.kpi.active_products'
    OR key LIKE 'account.orders.%'
    OR key LIKE 'account.admin.%'
    OR key LIKE 'account.tab.orders'
    OR key LIKE 'account.tab.all_orders'
    OR key LIKE 'account.tab.my_orders'
    OR key LIKE 'account.tabs.orders'
    OR key LIKE 'account.tabs.all_orders'
    OR key LIKE 'account.tabs.my_orders';

-- ── 5. Re-seed civic copy for system assistants ─────────────────────────────

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES ('walle.starter_msg', 'walle', 'WALL-E Starter Greeting', 'Hi! I''m WALL-E. Ask me about our chapter, events, voter resources, or actions.', 'text')
ON CONFLICT (key) DO UPDATE
   SET value = EXCLUDED.value;
