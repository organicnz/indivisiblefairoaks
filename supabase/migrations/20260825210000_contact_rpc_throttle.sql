-- Storage-flood guard for the contact submission RPC.
--
-- 20260825170000 exposed submit_contact_submission to anon. Without a write
-- throttle at this layer, scripted PostgREST calls (bypassing the form's
-- in-memory IP rate limit entirely) can create rows unbounded — each up to
-- ~5KB given the validation caps. The notify-contact Edge Function caps
-- EMAIL volume, but nothing capped ROW creation until now.
--
-- Mirrors the edge function's rolling-window posture: past the cap, new
-- submissions are rejected outright (the form shows its generic error and
-- genuine users retry after the window slides). Cap is generous versus real
-- traffic: the form itself allows ~3/10min/IP.

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
  IF (
    SELECT count(*)
    FROM public.contact_submissions
    WHERE created_at > now() - interval '10 minutes'
  ) >= 30 THEN
    RAISE EXCEPTION 'submission rate limit exceeded';
  END IF;

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
