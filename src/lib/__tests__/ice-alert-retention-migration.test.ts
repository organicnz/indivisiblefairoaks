// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the retention migration.
 *
 * The purge itself is exercised through the route with a row-backed client;
 * this file guards the schema that makes those queries correct in Postgres.
 * A missing partial index does not fail a unit test or a build, but it turns a
 * daily cleanup into a full-table scan.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261116180000_ice_alert_subscriber_retention.sql'
);
const SQL = await Bun.file(MIGRATION).text();
const CODE = SQL.replace(/--[^\n]*/g, '');

describe('ICE alert subscriber retention migration', () => {
  it('adds a nullable confirmation-token expiry', () => {
    expect(CODE).toMatch(
      /alter table public\.ice_alert_subscribers\s+add column if not exists confirm_token_expires_at timestamptz;/i
    );
    expect(CODE).not.toMatch(/confirm_token_expires_at[^;]*not null/i);
  });

  it('indexes the two retention queries', () => {
    expect(CODE).toMatch(
      /ice_alert_subscribers_pending_retention_idx[\s\S]*?on public\.ice_alert_subscribers \(updated_at\)[\s\S]*?where confirmed_at is null and unsubscribed_at is null/i
    );
    expect(CODE).toMatch(
      /ice_alert_subscribers_unsubscribed_retention_idx[\s\S]*?where unsubscribed_at is not null/i
    );
  });

  it('does not backfill an expiry that would keep old links live', () => {
    expect(CODE).not.toMatch(/update public\.ice_alert_subscribers[\s\S]*confirm_token_expires_at/i);
  });
});
