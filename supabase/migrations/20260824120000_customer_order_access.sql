-- Authorization fixes from the data-layer audit:
--
-- 1. Customers could never see their own orders: `orders`/`order_items` only
--    had admin SELECT policies, so the user-scoped query behind
--    MyOrdersPanel always returned an empty list. Grant self-read scoped to
--    the owning profile (matched by auth.uid() or JWT email, mirroring the
--    profiles self-policy which supports legacy rows keyed by email).
--
-- 2. "Admins can view submissions" on contact_submissions only required
--    auth.role() = 'authenticated', letting ANY signed-in account read all
--    customer messages. Require profiles.is_admin instead.

CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (
    customer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = customer_id
        AND (p.user_id = auth.uid() OR p.email = auth.jwt()->>'email')
    )
  );

CREATE POLICY "Users can view their own order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.profiles p ON p.id = o.customer_id
      WHERE o.id = order_id
        AND (p.user_id = auth.uid() OR p.email = auth.jwt()->>'email')
    )
  );

DROP POLICY IF EXISTS "Admins can view submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions"
  ON public.contact_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND is_admin = TRUE
    )
  );
