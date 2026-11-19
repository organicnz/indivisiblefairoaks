-- Newsletter double opt-in and bulletin-to-broadcast linkage.
--
-- A public subscription request is intent, not consent. These columns record the
-- confirmation that makes a contact eligible for chapter bulletin broadcasts:
-- the single-use token mailed to the address, its expiry, and the instant the
-- person followed the link. `do_not_email` remains the chapter-wide consent
-- gate, so a newsletter send requires *both* an explicit yes and a completed
-- confirmation.
--
-- Confirmation is deliberately a timestamp rather than a tag alone. Tags are a
-- presentation/filtering convenience and are capped at 20 per contact; a
-- confirmation that could be dropped because a contact already had twenty tags
-- would silently remove them from the audience.
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS newsletter_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_confirm_token uuid,
  ADD COLUMN IF NOT EXISTS newsletter_confirm_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_confirmation_sent_at timestamptz;

COMMENT ON COLUMN public.crm_contacts.newsletter_confirmed_at IS
  'When the contact completed the newsletter double opt-in. NULL means not eligible for bulletin broadcasts.';
COMMENT ON COLUMN public.crm_contacts.newsletter_confirm_token IS
  'Single-use token in the latest newsletter confirmation email. Cleared on confirmation and unsubscribe.';
COMMENT ON COLUMN public.crm_contacts.newsletter_confirm_expires_at IS
  'Expiry of newsletter_confirm_token. A stale token cannot confirm a subscription.';
COMMENT ON COLUMN public.crm_contacts.newsletter_confirmation_sent_at IS
  'When the latest newsletter confirmation email was requested, for support and abuse review.';

-- The token is a UUID and is only ever looked up as a whole value. The partial
-- unique index both enforces one contact per token and gives that lookup an
-- index; NULL tokens (the normal state) are not indexed.
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_newsletter_confirm_token_key
  ON public.crm_contacts (newsletter_confirm_token)
  WHERE newsletter_confirm_token IS NOT NULL;

-- A bulletin is emailed through the existing CRM broadcast path. Remembering
-- which bulletin produced a campaign makes the row readable in the campaign log
-- and makes a concurrent or repeat real send impossible: the unique index is the
-- idempotency guard, not a client-side "already sent" badge.
--
-- A failed campaign is deliberately excluded from the index. The sender may have
-- failed before the first provider call (missing configuration, unreachable
-- function), and a bulletin must remain sendable after that is fixed. Once the
-- retry is queued it is the only non-failed row for that slug, so it still cannot
-- race a second click.
ALTER TABLE public.crm_broadcasts
  ADD COLUMN IF NOT EXISTS source_newsletter_slug text;

COMMENT ON COLUMN public.crm_broadcasts.source_newsletter_slug IS
  'When set, the bulletin whose issue was emailed through this campaign. Unique among active and completed campaigns.';

CREATE UNIQUE INDEX IF NOT EXISTS crm_broadcasts_source_newsletter_slug_key
  ON public.crm_broadcasts (source_newsletter_slug)
  WHERE source_newsletter_slug IS NOT NULL AND status <> 'failed';
