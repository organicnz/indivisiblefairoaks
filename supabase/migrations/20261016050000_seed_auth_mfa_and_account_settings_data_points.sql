-- ==============================================================================
-- Migration: 20261016050000_seed_auth_mfa_and_account_settings_data_points.sql
-- Description: Seeds MFA security challenge and account settings data points into public.data_points.
-- ==============================================================================

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Auth MFA Challenge
  ('auth.mfa.unreadable_heading', 'auth', 'MFA Unreadable Heading', 'We could not check your security status', 'text'),
  ('auth.mfa.unreadable_desc', 'auth', 'MFA Unreadable Description', 'Your sign-in worked, but we could not read your authenticator setup. Nothing has been changed and nothing is locked.', 'text'),
  ('auth.mfa.unreadable_btn_retry', 'auth', 'MFA Unreadable Retry Button', 'Try again', 'text'),
  ('auth.mfa.unreadable_help', 'auth', 'MFA Unreadable Help Text', 'Still failing? Sign out and back in.', 'text'),
  ('auth.mfa.unreadable_link_settings', 'auth', 'MFA Unreadable Settings Link', 'Account settings', 'text'),
  ('auth.mfa.no_factor_heading', 'auth', 'MFA No Factor Heading', 'No authenticator app is set up', 'text'),
  ('auth.mfa.no_factor_desc', 'auth', 'MFA No Factor Description', 'This account cannot ask for a verification code, so there is nothing to enter here.', 'text'),
  ('auth.mfa.no_factor_btn_settings', 'auth', 'MFA No Factor Settings Button', 'Go to account settings', 'text'),
  ('auth.mfa.challenge_heading', 'auth', 'MFA Challenge Heading', 'Security Check', 'text'),
  ('auth.mfa.challenge_desc', 'auth', 'MFA Challenge Description', 'Please enter the verification code from your authenticator app to continue.', 'text'),
  ('auth.mfa.challenge_code_label', 'auth', 'MFA Challenge Code Label', '6-Digit Code', 'text'),
  ('auth.mfa.challenge_btn_verify', 'auth', 'MFA Challenge Verify Button', 'Verify & Continue', 'text'),
  ('auth.mfa.challenge_btn_verifying', 'auth', 'MFA Challenge Verifying Label', 'Verifying...', 'text'),
  ('auth.mfa.challenge_code_hint', 'auth', 'MFA Challenge Code Hint', 'Codes change every 30 seconds — type the one showing now.', 'text'),

  -- Account MFA Settings
  ('account.mfa.title', 'account', 'MFA Panel Title', 'Two-Factor Authentication', 'text'),
  ('account.mfa.subtitle', 'account', 'MFA Panel Subtitle', 'Secure your account with TOTP', 'text'),
  ('account.mfa.active_single', 'account', 'MFA Active Single Notice', '2FA is currently active', 'text'),
  ('account.mfa.btn_add_another', 'account', 'MFA Add Another Button', 'Add another authenticator', 'text'),
  ('account.mfa.desc_disabled', 'account', 'MFA Disabled Description', 'Add an extra layer of security to your account. When enabled, you will be asked for a verification code from your mobile device when signing in.', 'text'),
  ('account.mfa.btn_enable', 'account', 'MFA Enable Button', 'Enable 2FA', 'text'),
  ('account.mfa.dialog_title', 'account', 'MFA Dialog Title', 'Enable 2FA', 'text'),
  ('account.mfa.dialog_desc', 'account', 'MFA Dialog Description', 'Secure your account with an authenticator app', 'text'),
  ('account.mfa.qr_instruction', 'account', 'MFA QR Instruction', 'Scan this QR code with your authenticator app', 'text'),
  ('account.mfa.code_label', 'account', 'MFA Code Input Label', 'Verification Code', 'text'),
  ('account.mfa.btn_verify_activate', 'account', 'MFA Verify and Activate Button', 'Verify & Activate', 'text'),

  -- Account Settings Preferences & Store Region
  ('account.settings.region_title', 'account', 'Store Region Title', 'Store Region', 'text'),
  ('account.settings.region_sub', 'account', 'Store Region Subtitle', 'Where we ship and what we charge', 'text'),
  ('account.settings.currency_label', 'account', 'Currency Label', 'Currency', 'text'),
  ('account.settings.ships_label', 'account', 'Ships From Label', 'Ships from', 'text'),
  ('account.settings.ships_val', 'account', 'Ships From Location', 'Carmichael, CA', 'text'),
  ('account.settings.synced_msg', 'account', 'Cloud Synced Message', 'Settings are synced with the cloud', 'text')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
