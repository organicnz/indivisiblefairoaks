-- Seed store, auth, account, shipping, cancel, and success screen data points
-- Migration: 20261015010000_seed_store_auth_account_data_points.sql

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Shipping & Returns
  ('shipping.hero.title', 'shipping', 'Shipping Hero Title', 'Shipping & Returns', 'text'),
  ('shipping.policy.title', 'shipping', 'Shipping Policy Title', 'Shipping & Distribution', 'text'),
  ('shipping.policy.body', 'shipping', 'Shipping Policy Body', 'We take every care in packing and dispatching your grassroots materials and advocacy supplies. Advocacy items are dispatched from our local Indivisible Fair Oaks distribution hub.', 'text'),
  ('shipping.rates.title', 'shipping', 'Shipping Rates Title', 'Shipping & Distribution Options', 'text'),
  ('shipping.returns.title', 'shipping', 'Shipping Returns Title', 'Returns & Exchanges', 'text'),
  ('shipping.returns.body', 'shipping', 'Shipping Returns Body', 'Your satisfaction and grassroots participation are our highest priority. If an item arrives damaged or incomplete, contact our volunteer logistics team immediately.', 'text'),
  ('shipping.delivery.title', 'shipping', 'Shipping Delivery Title', 'Delivery Times', 'text'),
  ('shipping.delivery.body', 'shipping', 'Shipping Delivery Body', 'Delivery times are indicative. We work hard to ensure prompt arrival for upcoming rallies, canvassing events, and community actions.', 'text'),
  ('shipping.damaged.title', 'shipping', 'Shipping Damaged Title', 'Damaged Goods', 'text'),
  ('shipping.damaged.body', 'shipping', 'Shipping Damaged Body', 'Indivisible Fair Oaks is dedicated to ensuring you receive all advocacy materials in good order. Please reach out to our volunteer logistics team if anything is damaged.', 'text'),
  ('shipping.help.title', 'shipping', 'Shipping Help Title', 'Need help with materials or an order?', 'text'),
  ('shipping.help.body', 'shipping', 'Shipping Help Body', 'Our volunteer organizing team is ready to assist with any questions regarding deliveries, rally materials, or community inquiries.', 'text'),
  ('shipping.help.cta', 'shipping', 'Shipping Help CTA', 'Contact Organizing Team', 'text'),

  -- Cancel Page
  ('cancel.hero.title', 'cancel', 'Cancel Hero Title', 'Checkout Cancelled', 'text'),
  ('cancel.hero.desc', 'cancel', 'Cancel Hero Description', 'No charges were made. Your items are still saved in your cart waiting for your next visit.', 'text'),
  ('cancel.btn.cart', 'cancel', 'Cancel Review Cart Button', 'Review Cart', 'text'),
  ('cancel.btn.store', 'cancel', 'Cancel Back to Store Button', 'Back to Store', 'text'),

  -- Success Page
  ('success.hero.title', 'success', 'Success Hero Title', 'Order Confirmed!', 'text'),
  ('success.hero.desc', 'success', 'Success Hero Description', 'Thank you for supporting Indivisible Fair Oaks-Carmichael. We have received your order and will follow up with details shortly.', 'text'),
  ('success.btn.home', 'success', 'Success Return Home Button', 'Return to Home', 'text'),
  ('success.badge.volunteer', 'success', 'Success Volunteer Badge', '100% Volunteer Powered • Grassroots Community Funded', 'text'),

  -- Login Page
  ('login.gateway.admin', 'login', 'Login Gateway Admin', 'Administrative Gateway', 'text'),
  ('login.gateway.secure', 'login', 'Login Gateway Secure', 'Secure Gateway', 'text'),
  ('login.title.join', 'login', 'Login Title Join', 'Join', 'text'),
  ('login.title.welcome', 'login', 'Login Title Welcome', 'Welcome', 'text'),
  ('login.title.sub_join', 'login', 'Login Title Sub Join', 'The Crew', 'text'),
  ('login.title.sub_back', 'login', 'Login Title Sub Back', 'Back', 'text'),
  ('login.desc.admin', 'login', 'Login Desc Admin', 'Authorized access for chapter administrators and organizers', 'text'),
  ('login.desc.signup', 'login', 'Login Desc Sign Up', 'Join the community of grassroots organizers', 'text'),
  ('login.desc.login', 'login', 'Login Desc Login', 'Authorized access for returning personnel only', 'text'),
  ('login.tab.otp', 'login', 'Login Tab OTP', 'Magic Link', 'text'),
  ('login.tab.password', 'login', 'Login Tab Password', 'Password', 'text'),
  ('login.notice.admin_title', 'login', 'Login Notice Admin Title', 'Chapter Administration', 'text'),
  ('login.notice.admin_body', 'login', 'Login Notice Admin Body', 'You are accessing an administrative section. Please authenticate with your authorized chapter credentials.', 'text'),
  ('login.form.email_label', 'login', 'Login Form Email Label', 'Credential Email', 'text'),
  ('login.form.password_label', 'login', 'Login Form Password Label', 'Access Key', 'text'),
  ('login.form.forgot_btn', 'login', 'Login Form Forgot Button', 'Forgot?', 'text'),
  ('login.btn.otp', 'login', 'Login Button OTP', 'Initialize Link', 'text'),
  ('login.btn.signup', 'login', 'Login Button Signup', 'Generate Account', 'text'),
  ('login.btn.login', 'login', 'Login Button Login', 'Authenticate', 'text'),
  ('login.footer.switch_signup', 'login', 'Login Switch to Signup', 'New Recruit? Join The Crew', 'text'),
  ('login.footer.switch_login', 'login', 'Login Switch to Login', 'Existing Personnel? Sign In', 'text'),
  ('login.badge.encryption', 'login', 'Login Badge Encryption', 'Encryption Active', 'text'),
  ('login.badge.vault', 'login', 'Login Badge Vault', 'Supabase v2 Vault', 'text'),

  -- Cart Page
  ('cart.empty.title', 'cart', 'Cart Empty Title', 'Your Cart is Empty', 'text'),
  ('cart.empty.desc', 'cart', 'Cart Empty Description', 'Looks like you have not added any gear yet. Let us get you equipped.', 'text'),
  ('cart.empty.btn', 'cart', 'Cart Empty Button', 'Start Shopping', 'text'),
  ('cart.header.title', 'cart', 'Cart Header Title', 'Your Cart', 'text'),
  ('cart.summary.title', 'cart', 'Cart Summary Title', 'Order Summary', 'text'),
  ('cart.summary.shipping', 'cart', 'Cart Summary Shipping', 'Estimated Shipping', 'text'),
  ('cart.summary.total', 'cart', 'Cart Summary Total', 'Total', 'text'),
  ('cart.btn.checkout', 'cart', 'Cart Checkout Button', 'Proceed to Checkout', 'text'),

  -- Wishlist Page
  ('wishlist.hero.title', 'wishlist', 'Wishlist Hero Title', 'My Wishlist', 'text'),
  ('wishlist.empty.title', 'wishlist', 'Wishlist Empty Title', 'Your wishlist is empty.', 'text'),
  ('wishlist.empty.btn', 'wishlist', 'Wishlist Empty Button', 'Explore Gear', 'text'),
  ('wishlist.btn.clear', 'wishlist', 'Wishlist Clear Button', 'Clear Wishlist', 'text'),
  ('wishlist.btn.add_to_cart', 'wishlist', 'Wishlist Add to Cart Button', 'Add to Cart', 'text'),
  ('wishlist.btn.remove', 'wishlist', 'Wishlist Remove Item Button', 'Remove', 'text'),
  ('wishlist.item.no_image', 'wishlist', 'Wishlist Item No Image', 'No Image', 'text'),

  -- Search Page
  ('search.header.title', 'search', 'Search Header Title', 'Search Results', 'text'),
  ('search.results.gear', 'search', 'Search Results Gear Header', 'Gear Found', 'text'),
  ('search.results.logbook', 'search', 'Search Results Logbook Header', 'From the Logbook & Pages', 'text'),
  ('search.empty.desc', 'search', 'Search Empty Description', 'No matches found.', 'text'),
  ('search.empty.btn', 'search', 'Search Empty Button', 'Browse all gear', 'text'),

  -- Products & Product Details
  ('products.sidebar.categories', 'products', 'Products Sidebar Categories', 'Categories', 'text'),
  ('products.sidebar.all', 'products', 'Products Sidebar All Gear', 'All Gear', 'text'),
  ('products.sidebar.help_title', 'products', 'Products Sidebar Help Title', 'Need Help?', 'text'),
  ('products.sidebar.help_desc', 'products', 'Products Sidebar Help Description', 'Can not find what you are looking for? Contact our gear experts for advice.', 'text'),
  ('products.sidebar.contact_cta', 'products', 'Products Sidebar Contact CTA', 'Contact Us →', 'text'),
  ('products.empty.desc', 'products', 'Products Empty Description', 'No gear found in this category.', 'text'),
  ('products.empty.btn', 'products', 'Products Empty Button', 'View all products', 'text'),
  ('product.shipping.title', 'products', 'Product Shipping Badge Title', 'Shipping & Pickup', 'text'),
  ('product.shipping.desc', 'products', 'Product Shipping Badge Description', 'Local Pickup & Fast Shipping', 'text'),
  ('product.impact.title', 'products', 'Product Impact Badge Title', 'Grassroots Impact', 'text'),
  ('product.impact.desc', 'products', 'Product Impact Badge Description', '100% Funds Community Actions', 'text'),
  ('product.related.headline', 'products', 'Product Related Headline', 'You might also like', 'text'),
  ('product.details.description_heading', 'products', 'Product Details Description Heading', 'Description', 'text'),
  ('product.stock.in_stock', 'products', 'Product Stock In Stock Badge', 'In Stock', 'text'),
  ('product.stock.out_of_stock', 'products', 'Product Stock Out of Stock Badge', 'Out of Stock', 'text'),
  ('product.nav.gear', 'products', 'Product Nav Gear Link', 'Gear', 'text'),

  -- Account / Update Password
  ('account.security.confirm_title', 'account', 'Account Security Confirm Title', 'Confirm it''s you', 'text'),
  ('account.security.confirm_desc', 'account', 'Account Security Confirm Description', 'This account has two-factor authentication, so changing the password needs a verification code first.', 'text'),
  ('account.security.confirm_btn', 'account', 'Account Security Confirm Button', 'Enter verification code', 'text'),
  ('account.password.updated_title', 'account', 'Account Password Updated Title', 'Password Updated', 'text'),
  ('account.password.updated_desc', 'account', 'Account Password Updated Description', 'Your password has been changed successfully. You can now sign in with your new credentials.', 'text'),
  ('account.password.new_title', 'account', 'Account Set New Password Title', 'Set New Password', 'text'),
  ('account.password.new_desc', 'account', 'Account Set New Password Description', 'Create a strong password of at least 8 characters for your account.', 'text'),
  ('account.password.btn_update', 'account', 'Account Password Update Button', 'Update Password', 'text'),
  ('account.password.reset_badge', 'account', 'Account Password Reset Badge', 'Secure Reset', 'text'),
  ('account.password.btn_go_account', 'account', 'Account Password Go to Account Button', 'Go to Account', 'text'),
  ('account.admin_bridge.badge', 'account', 'Account Admin Bridge Badge', 'Chapter Leadership', 'text'),
  ('account.admin_bridge.title', 'account', 'Account Admin Bridge Title', 'Admin Control & Civic CRM', 'text'),
  ('account.admin_bridge.desc', 'account', 'Account Admin Bridge Description', 'Manage chapter constituents, target volunteer rings, and dispatch Resend broadcasts.', 'text'),
  ('account.admin_bridge.crm_btn', 'account', 'Account Admin Bridge CRM Button', 'Open CRM', 'text'),
  ('account.admin_bridge.control_btn', 'account', 'Account Admin Bridge Control Button', 'Control Center', 'text'),
  ('account.title.dashboard', 'account', 'Account Title Dashboard', 'Dashboard', 'text'),
  ('account.title.my_account', 'account', 'Account Title My Account', 'My Account', 'text'),
  ('account.tab.all_orders', 'account', 'Account Tab All Orders', 'All Orders', 'text'),
  ('account.tab.my_orders', 'account', 'Account Tab My Orders', 'My Orders', 'text'),
  ('account.tab.orders', 'account', 'Account Tab Orders', 'Orders', 'text'),
  ('account.tab.settings', 'account', 'Account Tab Settings', 'Settings', 'text'),
  ('account.session.title', 'account', 'Account Session Control Title', 'Session Control', 'text')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
