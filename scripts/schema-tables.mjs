/**
 * The tables whose shape is part of the generated Supabase client types.
 *
 * `gen-types.mjs` filters the live project's generated output down to this
 * allowlist, and `check-migration-types.mjs` compares the result with the
 * migrations. A table belongs here when application code expects the typed
 * client to know about it.
 *
 * Adding a table here is a commitment to regenerate `src/types/supabase.ts` in
 * the same change. The static guard reports a missing table or column until
 * that happens.
 */
export const APP_TABLES = new Set([
  'coalition_links',
  'contact_submissions',
  'content',
  'content_media',
  'content_revisions',
  'crm_activities',
  'crm_broadcast_recipients',
  'crm_broadcasts',
  'crm_contacts',
  'crm_email_events',
  'crm_segments',
  'crm_tasks',
  'data_points',
  'error_reports',
  'events',
  'faqs',
  'gallery_photos',
  'newsletters',
  'partners',
  'profiles',
  'search_rate_limit',
  'walle_knowledge_snapshots',
]);

/**
 * Migration tables deliberately outside the generated type surface.
 *
 * These are explicit decisions, not silent omissions:
 *
 *   - `admin_audit_log` / `admin_audit_outbox` are service-only tables whose
 *     row shapes live beside the audit code rather than in the browser-safe
 *     generated client.
 *   - The `ice_*` tables are read through hand-written row types in the ICE
 *     surfaces, which carry narrower public shapes than the storage tables.
 *   - The `legacy_*` tables exist only for the one-way content archive import.
 *   - `mfa_recovery_codes` and the `mobilize_*` tables are accessed through
 *     explicitly untyped admin clients.
 *
 * The static guard requires every migration table to be in exactly one of these
 * lists. A new table in neither is reported so somebody decides whether it
 * belongs in the generated client instead of letting it disappear from types.
 */
export const UNTYPED_TABLES = new Set([
  'admin_audit_log',
  'admin_audit_outbox',
  'ice_alert_rate_limits',
  'ice_alert_subscribers',
  'ice_alert_surge_events',
  'ice_crawl_discoveries',
  'ice_crawl_pages',
  'ice_crawl_sources',
  'ice_heatmap_cities',
  'ice_heatmap_releases',
  'ice_public_reports',
  'ice_rapid_feed_cache',
  'ice_report_intake',
  'ice_reunification_requests',
  'ice_source_reports',
  'legacy_assets',
  'legacy_documents',
  'legacy_import_runs',
  'legacy_page_links',
  'legacy_pages',
  'mfa_recovery_codes',
  'mobilize_event_rules',
  'mobilize_settings',
  'mobilize_sync_runs',
]);
