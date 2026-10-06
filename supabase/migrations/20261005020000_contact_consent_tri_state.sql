-- ═══════════════════════════════════════════════════════════════════════════
-- Consent becomes tri-state, and is finally captured.
--
-- ── The gap this closes ──────────────────────────────────────────────────────
--
-- `crm_contacts.do_not_email` was `boolean NOT NULL DEFAULT false`, so *every*
-- contact was opted-in by column default. Nothing in the codebase ever wrote
-- `true` except an unsubscribe click or an admin action, and the contact form's
-- only checkbox was `sendCopy` — "send me a copy of this message for my records",
-- a transactional copy, which is not consent.
--
-- The consequence: a resident who wrote once about a parking permit was in the
-- next broadcast audience. Consent was *enforced* in four places and *counted* in
-- one, and captured nowhere. That is the shape of the bug — every part of the
-- machinery worked, and the thing it was machinery for did not exist.
--
-- ── Why tri-state, and why NULL means "never asked" ──────────────────────────
--
-- Three states, not two:
--
--   true  — asked, declined (or unsubscribed)
--   false — asked, agreed
--   NULL  — never asked
--
-- A boolean cannot express the third, so "never asked" and "agreed" were the
-- same value, and the one that mattered was reachable by nobody. With NULL
-- separate, the audience resolver can require `false` — an explicit yes — rather
-- than merely "not opted out".
--
-- ── The two behaviours this changes, stated plainly ──────────────────────────
--
-- 1. **Existing rows are unaffected.** They hold `false` today and keep it, so
--    the current audience is exactly the current audience. No backfill.
--
-- 2. **New contacts are not.** A contact-form submitter who does not tick the
--    new box is recorded as declined, and a contact created any other way
--    (profile signup, store order, CSV import with no consent column) is recorded
--    as never asked. Both are excluded from broadcasts. The next campaign after
--    this migration reaches fewer people than the one before it, and that is the
--    correct direction — but it is a visible change to a chapter-visible number,
--    so it is called out here rather than discovered mid-campaign.
--
-- ── The default is dropped, deliberately ─────────────────────────────────────
--
-- `DROP DEFAULT` so that an INSERT which does not mention consent records NULL
-- ("never asked") rather than `false` ("agreed"). Keeping `DEFAULT false` would
-- mean every future code path that forgets to think about consent silently opts
-- somebody in — which is the bug this migration exists to close. Fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. crm_contacts.do_not_email: nullable, no default ───────────────────────
--
-- `DROP NOT NULL` first, then `DROP DEFAULT`. Order matters in neither
-- direction here — both are independent — but doing NOT NULL last would fail on a
-- table that already held a null from a partial application.
ALTER TABLE public.crm_contacts
    ALTER COLUMN do_not_email DROP NOT NULL,
    ALTER COLUMN do_not_email DROP DEFAULT;

COMMENT ON COLUMN public.crm_contacts.do_not_email IS
    'Email consent, tri-state. TRUE = asked and declined (or unsubscribed). '
    'FALSE = asked and agreed. NULL = never asked, and excluded from broadcasts. '
    'NULL is not a synonym for FALSE: only an explicit false is an opt-in, and '
    'there is deliberately no column default so an insert that forgets consent '
    'records "never asked" rather than "agreed".';

-- A row that says "never asked" while carrying an unsubscribe timestamp is a
-- contradiction, and NULL now makes it expressible. It is *not* constrained,
-- deliberately: the only writer of `do_not_email = false` is
-- `setCRMEmailConsent`, and a constraint here would have to be mirrored in every
-- other writer (the merge RPC, the CSV importer) to avoid failing a production
-- data path mid-campaign. It is also harmless — the resolver and both senders
-- read `do_not_email`, never `unsubscribed_at`, so the timestamp is evidence
-- rather than state. Adding the constraint is a chapter decision about whether
-- the two should ever disagree.

-- ── 2. Indexes for the three states ──────────────────────────────────────────
--
-- No new index, and that is deliberate. `20261005000000` already created two
-- whose *predicates* are the right shape for a nullable column, and which happen
-- to be the two queries in this codebase that matter:
--
--   * `WHERE do_not_email IS NOT FALSE` covers both `true` and NULL — exactly the
--     "not in the audience" population, which is what
--     `getBroadcastRecipientCount`'s exclusion half now filters with
--     (`not(…, 'is', false)` is `IS NOT FALSE`). So the count the dispatch bar
--     shows reads one index covering both exclusion reasons.
--   * `WHERE do_not_email IS FALSE` is the audience the resolver pages.
--
-- Neither needs re-creating for nullability: `IS NOT FALSE` and `IS FALSE` were
-- already written as predicates rather than as `= true` / `= false`, so they
-- mean the same thing before and after `DROP NOT NULL`. A plain
-- `CREATE INDEX (do_not_email)` would also still work — btree indexes nulls — it
-- would just include rows neither query wants and be larger than it needs to be.
--
-- The one thing worth watching is that this migration changes the *column* while
-- those predicates were written for the old one. Postgres does not re-validate a
-- partial index predicate when the underlying column changes type or
-- nullability, and it would not error here anyway — the predicates remain
-- semantically correct, which is the reason there is nothing to do here at all.

-- ── 3. contact_submissions: record what the submitter actually chose ──────────
--
-- `NOT NULL DEFAULT false` is right here and wrong on `crm_contacts`: the
-- submission table is the *record of an ask*, so every row has an answer. The
-- false default is the "did not tick the box" case, which is the overwhelmingly
-- common one and needs no backfill of meaning.
ALTER TABLE public.contact_submissions
    ADD COLUMN IF NOT EXISTS consent_to_email BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contact_submissions.consent_to_email IS
    'Whether the submitter asked to receive chapter email. FALSE = they left the '
    'consent box unticked, which is recorded as declined rather than as unknown: '
    'they were shown the box and did not tick it. NOT NULL because this table is '
    'the record of an ask, so every row has an answer.';

-- ── 4. submit_contact_submission: carry the fifth parameter ───────────────────
--
-- **The old four-argument function is dropped, and the drop is not optional.**
--
-- `CREATE OR REPLACE` cannot change a function's arity. Given a *different*
-- number of parameters it does not replace anything — it defines a second
-- function alongside the first, distinguished only by argument count. So the
-- `REVOKE`/`GRANT` pair below, which names the five-argument signature, would
-- have covered only the new function while the four-argument original stayed
-- callable with the grants the canonical schema gave it:
--
--     GRANT EXECUTE ON …(text, text, text, boolean) TO anon, authenticated;
--
-- That is a live hole, not a tidy-up. `anon` is the contact form's own role, so
-- the reachable old overload would insert a `contact_submissions` row with no
-- consent column — the `false` default, a decline — which is the safe direction
-- for the *record*, but it is also an RPC outside every revocation this
-- migration makes and outside `secrets.manifest`/`check-auth-redirects`-style
-- accounting of what `anon` can reach. Dropping it leaves exactly one function
-- of this name to grant and one to reason about.
--
-- Both parameters keep a `DEFAULT`, which is now about PostgREST's named-argument
-- calls rather than about arity: a caller that omits `p_consent_to_email`
-- records a decline, which is the safe direction. The application always sends
-- it — `src/app/contact/actions.ts` reads the checkbox and passes the boolean
-- explicitly — so the default is a floor, not the mechanism.
--
-- The drop is *before* the create, because a `DROP` of a function that does not
-- yet exist needs `IF EXISTS` to stay re-runnable, and doing it after would leave
-- a window where neither signature resolves.
DROP FUNCTION IF EXISTS public.submit_contact_submission(text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.submit_contact_submission(
    p_name text,
    p_email text,
    p_message text,
    p_wants_copy boolean DEFAULT false,
    p_consent_to_email boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id integer;
BEGIN
    -- Global rate cap: 30 submissions per 10 minutes
    IF (
        SELECT count(*) FROM public.contact_submissions
        WHERE created_at > now() - interval '10 minutes'
    ) >= 30 THEN
        RAISE EXCEPTION 'submission rate limit exceeded';
    END IF;

    -- Field presence
    IF p_name IS NULL OR p_email IS NULL OR p_message IS NULL THEN
        RAISE EXCEPTION 'missing fields';
    END IF;
    -- Name: 2–100 chars, no control characters
    IF char_length(p_name) < 2 OR char_length(p_name) > 100
       OR p_name ~ '[\x00-\x1f\x7f]' THEN
        RAISE EXCEPTION 'invalid name';
    END IF;
    -- Email: ≤254 chars, must contain @, no control characters
    IF char_length(p_email) > 254 OR p_email !~ '@' OR p_email ~ '[\x00-\x1f\x7f]' THEN
        RAISE EXCEPTION 'invalid email';
    END IF;
    -- Message: 10–5000 chars
    IF char_length(p_message) < 10 OR char_length(p_message) > 5000 THEN
        RAISE EXCEPTION 'invalid message';
    END IF;

    INSERT INTO public.contact_submissions (name, email, message, wants_copy, consent_to_email)
    VALUES (
        p_name,
        p_email,
        p_message,
        COALESCE(p_wants_copy, false),
        COALESCE(p_consent_to_email, false)
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_contact_submission(text, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_submission(text, text, text, boolean, boolean) TO anon, authenticated;

-- ── 5. The sync trigger writes the answer instead of taking the default ──────
--
-- Re-declared rather than `ALTER`ed because the INSERT statement itself changes,
-- and `CREATE OR REPLACE` preserves the trigger binding. Three changes from
-- 20261005010000, and one non-change that is worth stating:
--
--   * `do_not_email` is now in the INSERT list. It was absent, so it took the
--     column default — which, until the default was dropped two statements ago,
--     meant every contact-form submitter was opted in. This is the line that
--     closes the gap.
--   * `consent_to_email` is read from `NEW`, so the submitter's answer is what
--     lands. A submitter who ticked the box is `false` (agreed); one who did not
--     is `true` (declined). Neither is NULL — they were asked.
--   * `unsubscribed_at` is *not* set here. A decline is not an unsubscribe: it
--     should not put a "clicked unsubscribe at" timestamp on somebody who never
--     saw a campaign. (The earlier version of this line cited "the constraint
--     above" — there is no such constraint, and one would need a
--     `CHECK (do_not_email IS TRUE OR unsubscribed_at IS NULL)`-style rule to
--     behave that way, not the consent column alone. The timestamp stays
--     silent because a decline is not an unsubscribe, full stop.)
--
--   Unchanged: the tag union and the activity row's title and metadata keys.
--
--   The `ON CONFLICT` branch has one consent change, and it is not the one the
--   comment above it used to describe. Leaving `do_not_email` entirely alone was
--   right when the column had two states — `true` meant "declined" and `false`
--   meant "either declined-not or agreed", so there was no third value to fill in
--   and touching it could only ever risk re-subscribing somebody who had opted
--   out. It is wrong now, because there is a third state and it is precisely the
--   one a form submission answers:
--
--   * existing `true`  — asked and declined, possibly by clicking unsubscribe.
--     Left alone, and must be: a repeat form visit is not consent, and silently
--     re-subscribing somebody who unsubscribed is the failure that gets a
--     chapter in trouble.
--   * existing `false` — asked and agreed. Already the answer the form can give.
--     Left alone.
--   * existing `NULL`  — **never asked.** This is the only case that changes, and
--     leaving it out is the gap: a resident whose record predates this migration,
--     or who was created by an import, ticks the marketing box on the contact
--     form and the answer is discarded. The form asked; the record must show it.
--
--   So the update is conditional on the row having no answer yet. Consent still
--   only ever moves through the form, the unsubscribe route and an admin action —
--   this branch just stops the form from being silently ignored for the one
--   state that means "no opinion recorded".
--
--   Note the deliberate asymmetry: declining is *recorded* for a never-asked
--   contact, so an unticked box on a repeat submission turns `NULL` into `true`.
--   That is right. Someone who answered no has answered, and treating silence on
--   a form as "still undecided" would keep them in the unasked pool for ever,
--   re-asking about a question they have answered.
CREATE OR REPLACE FUNCTION public.fn_sync_contact_submission_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
        do_not_email,
        created_at,
        updated_at
    ) VALUES (
        v_clean_email,
        v_first_name,
        v_last_name,
        'contact_form',
        'supporter',
        ARRAY['contact-form'],
        -- `NOT`: the submitter ticked the box, or did not. Either way they were
        -- asked, so neither branch is NULL.
        NOT COALESCE(NEW.consent_to_email, false),
        NEW.created_at,
        NEW.created_at
    )
    ON CONFLICT (email) DO UPDATE
    SET
        first_name = coalesce(public.crm_contacts.first_name, EXCLUDED.first_name),
        last_name = coalesce(public.crm_contacts.last_name, EXCLUDED.last_name),
        tags = CASE
            WHEN 'contact-form' = ANY(public.crm_contacts.tags) THEN public.crm_contacts.tags
            ELSE array_append(public.crm_contacts.tags, 'contact-form')
        END,
        -- Only fill in a consent answer that was never given. `IS NULL`, not
        -- `IS NOT TRUE`: an existing decline is an answer, and overwriting it
        -- would let a form visit resubscribe somebody who unsubscribed.
        do_not_email = CASE
            WHEN public.crm_contacts.do_not_email IS NULL THEN EXCLUDED.do_not_email
            ELSE public.crm_contacts.do_not_email
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

-- The trigger already exists and is attached; `CREATE OR REPLACE` keeps the
-- binding. Asserted rather than assumed — a trigger that failed to attach leaves
-- contact submissions silently un-synced, which is the failure mode this whole
-- migration exists to prevent.
DO $$
DECLARE
    missing text;
BEGIN
    SELECT string_agg(t.expected, ', ')
    INTO missing
    FROM (VALUES ('trg_sync_contact_submission_to_crm')) AS t(expected)
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        WHERE tg.tgname = t.expected
          AND NOT tg.tgisinternal
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'CRM sync trigger missing after recreate: %', missing;
    END IF;
END;
$$;