-- Contact submission entry point returning the new row id.
--
-- Why an RPC instead of INSERT..RETURNING through PostgREST: RETURNING makes
-- Postgres evaluate the SELECT policy against the new row. contact_submissions
-- deliberately has an admin-only SELECT policy (nobody may scrape submissions),
-- so an anonymous INSERT .. RETURNING always fails with
-- "new row violates row-level security policy" even though the INSERT policy
-- is permissive. The definer-rights function below performs the insert and
-- returns the id without granting anon any read path.
--
-- Validation mirrors src/app/contact/actions.ts so direct RPC callers cannot
-- bypass the input contract. Failure raises; the action maps errors to its
-- generic user-facing message.

CREATE OR REPLACE FUNCTION public.submit_contact_submission(
  p_name text,
  p_email text,
  p_message text,
  p_wants_copy boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id integer;
BEGIN
  IF p_name IS NULL OR p_email IS NULL OR p_message IS NULL THEN
    RAISE EXCEPTION 'missing fields';
  END IF;
  IF char_length(p_name) < 2 OR char_length(p_name) > 100
     OR p_name ~ '[\x00-\x1f\x7f]' THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  IF char_length(p_email) > 254 OR p_email !~ '@' OR p_email ~ '[\x00-\x1f\x7f]' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  IF char_length(p_message) < 10 OR char_length(p_message) > 5000 THEN
    RAISE EXCEPTION 'invalid message';
  END IF;

  INSERT INTO public.contact_submissions (name, email, message, wants_copy)
  VALUES (p_name, p_email, p_message, COALESCE(p_wants_copy, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_contact_submission(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_submission(text, text, text, boolean) TO anon, authenticated;
