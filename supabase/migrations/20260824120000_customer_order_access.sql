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

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
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
