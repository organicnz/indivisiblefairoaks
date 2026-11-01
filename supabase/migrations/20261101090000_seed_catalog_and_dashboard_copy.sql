-- Seed the copy introduced by the catalog-only storefront and the admin
-- dashboard's recent-content card.
--
-- The dashboard reads three keys that had no seed: the recent-content heading,
-- its "view all" link, and its empty state. The product detail page's primary
-- action became an enquiry link, so that CTA is a data point too. Each value
-- is the literal the screen renders, which is what keeps SSR identical whether
-- or not the row is reachable.
--
-- The two shipping rows are updated in place: the catalog-only copy no longer
-- mentions orders, so the shipped fallback is now the canonical wording.
-- Appending the values here rather than editing the earlier seed keeps the
-- migration history intact while letting the data-points guard compare the
-- fallback with the current seed.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('admin.dashboard.recent_title', 'admin', 'Admin Dashboard Recent Content Heading', 'Recently edited', 'text'),
  ('admin.dashboard.view_all', 'admin', 'Admin Dashboard View All Link', 'View all', 'text'),
  ('admin.dashboard.no_content', 'admin', 'Admin Dashboard Empty Content Message', 'No pages or posts yet.', 'text'),
  ('product.cta.enquire', 'products', 'Product Enquiry CTA', 'Ask about this item', 'text'),
  ('shipping.bullet.delivery_times', 'shipping', 'Shipping Policy Bullet Item 3', 'Indicative delivery times confirmed when you request an item', 'text'),
  ('shipping.help.title', 'shipping', 'Shipping Help Title', 'Need help with materials or a delivery?', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
