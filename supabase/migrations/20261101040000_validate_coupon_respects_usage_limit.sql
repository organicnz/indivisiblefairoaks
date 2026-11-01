-- Migration: 20261101040000_validate_coupon_respects_usage_limit.sql
--
-- `validate_coupon` is anon-executable (by design — it is the storefront's
-- "does this code work?" probe) and SECURITY DEFINER, so it reads `coupons`
-- past that table's admin-only RLS. What it checked was the code and the
-- expiry date, and nothing else.
--
-- `coupons` carries `usage_limit` and `times_used` (default 0). Neither was
-- read, so a coupon that had already been used to its limit still validated as
-- `valid: true`, with its discount type and amount attached — the storefront
-- would offer a discount the store could not honour.
--
-- Verified against the live function before this change, through the same anon
-- RPC path the storefront uses, with a probe row (`usage_limit = 1`,
-- `times_used = 1`, future expiry):
--
--   [{"valid":true,"discount_type":"percent","amount":10.00,...}]
--
-- Semantics chosen deliberately:
--   * `usage_limit IS NULL` means unlimited — it is the column default, and the
--     only reading that makes "no limit set" usable.
--   * `times_used` is nullable, so it is coalesced: a row with a limit and a
--     null counter has used the coupon zero times, not an unknown number.
--   * Expiry is unchanged: `NULL` expiry still means no expiry.
--
-- Nothing else about the function changes — same signature, same return shape,
-- same `search_path` pin, same SECURITY DEFINER. `validate_coupon` still only
-- reports; it never consumes a use.

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
 RETURNS TABLE(valid boolean, discount_type text, amount numeric, expiry_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    v_code text := upper(trim(COALESCE(p_code, '')));
BEGIN
    IF v_code = '' OR char_length(v_code) > 50 THEN
        RETURN QUERY SELECT false, NULL::text, NULL::numeric, NULL::timestamptz;
        RETURN;
    END IF;
    RETURN QUERY
    SELECT
        true,
        c.discount_type,
        c.amount,
        c.expiry_date
    FROM public.coupons c
    WHERE c.code = v_code
      AND (c.expiry_date IS NULL OR c.expiry_date > now())
      AND (c.usage_limit IS NULL OR COALESCE(c.times_used, 0) < c.usage_limit)
    LIMIT 1;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::text, NULL::numeric, NULL::timestamptz;
    END IF;
END;
$function$;
