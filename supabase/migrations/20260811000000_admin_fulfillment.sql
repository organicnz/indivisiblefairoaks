-- Admin fulfilment & customer care fields
-- tracking_number: courier reference for the shipped order
-- admin_notes: internal notes visible to admins only (products, adjustments, context)
alter table orders
  add column if not exists tracking_number text,
  add column if not exists admin_notes text;

-- Admins already have an UPDATE policy on orders (20260808000000_add_admin_flag.sql),
-- which covers the new columns; no additional policy needed.