// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = await Bun.file(
  resolve(process.cwd(), 'supabase/migrations/20261119200000_crm_newsletter_broadcast.sql')
).text();
const ACTION_SOURCE = await Bun.file(
  resolve(process.cwd(), 'src/lib/actions/crm/broadcasts.ts')
).text();
const EDGE_SOURCE = await Bun.file(
  resolve(process.cwd(), 'supabase/functions/crm-broadcast-send/index.ts')
).text();
const BROADCAST_DIALOG = await Bun.file(
  resolve(process.cwd(), 'src/components/admin/news/NewsletterBroadcastDialog.tsx')
).text();

describe('newsletter double opt-in migration', () => {
  it('stores confirmation separately from chapter consent', () => {
    expect(SQL).toMatch(/newsletter_confirmed_at\s+timestamptz/);
    expect(SQL).toMatch(/newsletter_confirm_token\s+uuid/);
    expect(SQL).toMatch(/newsletter_confirm_expires_at\s+timestamptz/);
    expect(SQL).toMatch(/newsletter_confirmation_sent_at\s+timestamptz/);
    expect(SQL).toMatch(/COMMENT ON COLUMN public\.crm_contacts\.newsletter_confirmed_at IS/);
  });

  it('makes the confirmation token single-use and lookup-indexed', () => {
    expect(SQL).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_newsletter_confirm_token_key/
    );
    expect(SQL).toMatch(/WHERE newsletter_confirm_token IS NOT NULL/);
  });

  it('links one bulletin to one real campaign', () => {
    expect(SQL).toMatch(
      /ALTER TABLE public\.crm_broadcasts\n {2}ADD COLUMN IF NOT EXISTS source_newsletter_slug text/
    );
    expect(SQL).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS crm_broadcasts_source_newsletter_slug_key/
    );
    expect(SQL).toMatch(/WHERE source_newsletter_slug IS NOT NULL AND status <> 'failed'/);
  });
});

describe('bulletin audience is enforced in both resolvers', () => {
  it('the Next resolver can require a completed confirmation', () => {
    const resolver = ACTION_SOURCE.slice(
      ACTION_SOURCE.indexOf('async function resolveBroadcastRecipients'),
      ACTION_SOURCE.indexOf('export async function previewCRMBroadcast')
    );
    expect(resolver).toContain("'newsletter_confirmed_at'");
    expect(resolver).toContain('newsletterConfirmedOnly');
    expect(resolver).toContain('Boolean(r.newsletter_confirmed_at)');
  });

  it('the Edge sender re-applies the gate from the source slug', () => {
    expect(EDGE_SOURCE).toContain('source_newsletter_slug');
    expect(EDGE_SOURCE).toContain('newsletterConfirmedOnly');
    expect(EDGE_SOURCE).toContain("qb.not('newsletter_confirmed_at', 'is', null)");
    expect(EDGE_SOURCE).toContain('Boolean(r.newsletter_confirmed_at)');
  });

  it('the admin confirmation warns that the send cannot be undone', () => {
    expect(BROADCAST_DIALOG).toContain('cannot be undone from this screen');
    expect(BROADCAST_DIALOG).toContain('List-Unsubscribe');
    expect(BROADCAST_DIALOG).toContain('confirmed subscribers');
  });
});
