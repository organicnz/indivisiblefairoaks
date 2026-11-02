'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { env } from '@/lib/env';
import {
  buildMobilizeEventsQuery,
  buildMobilizeEventUrl,
  formatDateLabel,
  formatTimeLabel,
  MOBILIZE_DEFAULT_MAX_DIST,
  MOBILIZE_DEFAULT_ORG_ID,
  MOBILIZE_DEFAULT_ZIP,
  type MobilizeEvent,
  type MobilizeEventRule,
  type MobilizeSettings,
  mapMobilizeEvent,
  nextUpcomingTimeslot,
  parseMobilizeEventUrl,
  parseMobilizeFeedUrl,
  passesMobilizeFilters,
} from '../../../supabase/functions/_shared/mobilize';

/**
 * Admin actions behind `/admin/events → Mobilize` (issue #153).
 *
 * The translation and filtering live in `_shared/mobilize.ts`, imported here
 * and by the scheduled Edge Function, so the preview an organizer approves is
 * produced by the same code the sync runs. Everything in this file is a thin
 * I/O shell around it.
 */

export type MobilizeActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): { success: false; error: string } {
  return { success: false, error };
}

/**
 * Mirrors the seeded row in `20261031120000_mobilize_events.sql`. Used only
 * when the admin UI is opened before the migration has been applied, so the
 * preview still renders instead of throwing an unhelpful PostgREST error.
 */
const FALLBACK_SETTINGS: MobilizeSettings = {
  enabled: true,
  org_id: MOBILIZE_DEFAULT_ORG_ID,
  zipcode: MOBILIZE_DEFAULT_ZIP,
  max_dist: MOBILIZE_DEFAULT_MAX_DIST,
  locality_allowlist: [
    'Sacramento',
    'Carmichael',
    'Fair Oaks',
    'Citrus Heights',
    'Orangevale',
    'Rancho Cordova',
    'North Highlands',
    'Antelope',
    'Folsom',
    'Gold River',
  ],
  include_virtual: false,
  high_priority_only: false,
  auto_publish: true,
};

/** The new tables predate the next `types:generate` run, so these reads are untyped. */
async function adminClient(): Promise<SupabaseClient> {
  const { adminClient } = await requireAdmin();
  return adminClient as unknown as SupabaseClient;
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  org_id: z.number().int().positive().max(2_147_483_647),
  zipcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'A five-digit ZIP code is required'),
  max_dist: z.number().int().min(1).max(100),
  locality_allowlist: z.array(z.string().trim().min(1)).max(50),
  include_virtual: z.boolean(),
  high_priority_only: z.boolean(),
  auto_publish: z.boolean(),
});

export interface MobilizeSettingsRecord extends MobilizeSettings {
  updated_at?: string;
}

export interface MobilizePreviewRow {
  id: number;
  title: string;
  /** `Carbondale, CA`, or `Online`. */
  place: string;
  /** `Tuesday, November 10, 2026 · 6:30 PM – 8:00 PM`, in the event's zone. */
  when: string;
  eventType: string;
  highPriority: boolean;
  isVirtual: boolean;
  browserUrl: string;
  include: boolean;
  reason: string;
  alreadyImported: boolean;
}

export interface MobilizePreview {
  rows: MobilizePreviewRow[];
  settings: MobilizeSettings;
  warning?: string;
  inPersonTogether: number;
  virtualTogether: number;
  filteredOut: number;
}

export interface MobilizeSyncRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  checked: number;
  imported: number;
  updated: number;
  hidden: number;
  filtered: number;
  error: string | null;
}

async function fetchEventList(url: string): Promise<MobilizeEvent[]> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'Indivisible-Fair-Oaks-Carmichael/1.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Mobilize returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as { data?: MobilizeEvent[] };
  return body.data ?? [];
}

async function fetchEvent(eventId: number): Promise<MobilizeEvent | null> {
  const response = await fetch(buildMobilizeEventUrl(eventId), {
    headers: { accept: 'application/json', 'user-agent': 'Indivisible-Fair-Oaks-Carmichael/1.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: MobilizeEvent };
  return body.data ?? null;
}

function eventWhen(event: MobilizeEvent): string {
  const slot = nextUpcomingTimeslot(event);
  if (!slot) return 'No upcoming time';
  const start = new Date(slot.start_date * 1000);
  const end = new Date(slot.end_date * 1000);
  return `${formatDateLabel(start, event.timezone)} · ${formatTimeLabel(start, end, event.timezone)}`;
}

export async function getMobilizeSettings(): Promise<MobilizeActionResult<MobilizeSettingsRecord>> {
  try {
    const client = await adminClient();
    const { data, error } = await client
      .from('mobilize_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return { success: true, data: { ...FALLBACK_SETTINGS } };
    return { success: true, data: data as MobilizeSettingsRecord };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to load Mobilize settings');
  }
}

export async function saveMobilizeSettings(
  input: MobilizeSettings
): Promise<MobilizeActionResult<MobilizeSettingsRecord>> {
  try {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid Mobilize settings');
    }

    const client = await adminClient();
    const row = {
      id: 1,
      ...parsed.data,
      locality_allowlist: parsed.data.locality_allowlist.map((name) => name.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('mobilize_settings')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) return fail(error.message);
    return { success: true, data: data as MobilizeSettingsRecord };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save Mobilize settings');
  }
}

const previewSchema = z.object({
  feedUrl: z.string().trim().max(500).optional(),
  zipcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/)
    .optional(),
  maxDist: z.number().int().min(1).max(100).optional(),
  includeVirtual: z.boolean().optional(),
  highPriorityOnly: z.boolean().optional(),
});

/**
 * What the current (or proposed) source returns, without writing anything.
 *
 * This is the screen to show Erin and Christiana: it lists every event the
 * filters admit, every one they reject with the reason, and the per-event
 * Include/Exclude state. The same `passesMobilizeFilters` runs inside the sync,
 * so approving this list is approving the import.
 */
export async function previewMobilizeSource(
  input: z.input<typeof previewSchema> = {}
): Promise<MobilizeActionResult<MobilizePreview>> {
  try {
    const client = await adminClient();
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid preview options');
    }

    const { data: settingsRow, error: settingsError } = await client
      .from('mobilize_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const settings: MobilizeSettings = settingsRow
      ? (settingsRow as MobilizeSettings)
      : { ...FALLBACK_SETTINGS };

    // A pasted Mobilize feed link overrides the numeric filters for this
    // preview only — the shape of the answer Erin and Christiana give.
    const feed = parsed.data.feedUrl ? parseMobilizeFeedUrl(parsed.data.feedUrl) : null;
    const effective: MobilizeSettings = {
      ...settings,
      zipcode: parsed.data.zipcode ?? feed?.zipcode ?? settings.zipcode,
      max_dist: parsed.data.maxDist ?? feed?.maxDist ?? settings.max_dist,
      include_virtual:
        parsed.data.includeVirtual ?? feed?.includeVirtual ?? settings.include_virtual,
      high_priority_only:
        parsed.data.highPriorityOnly ?? feed?.highPriorityOnly ?? settings.high_priority_only,
    };

    const { data: ruleRows } = await client
      .from('mobilize_event_rules')
      .select('external_id, action');
    const rules = (ruleRows ?? []) as MobilizeEventRule[];

    const { data: importedRows } = await client
      .from('events')
      .select('external_id')
      .not('external_id', 'is', null);
    const imported = new Set(
      (importedRows ?? []).map((row: { external_id: string }) => String(row.external_id))
    );

    const events: MobilizeEvent[] = [];
    let inPersonTogether = 0;
    let virtualTogether = 0;

    const inPerson = await fetchEventList(buildMobilizeEventsQuery(effective));
    inPersonTogether = inPerson.length;
    events.push(...inPerson);

    if (effective.include_virtual) {
      const virtual = await fetchEventList(buildMobilizeEventsQuery(effective, { virtual: true }));
      virtualTogether = virtual.length;
      events.push(...virtual);
    }

    let filteredOut = 0;
    // Sorted on the timeslot instant, not the rendered label: locale-sorting
    // "Tuesday, November 10" against "Saturday, October 17" is alphabetical
    // nonsense. The label exists for a human to read.
    const ordered = events.map((event) => {
      const verdict = passesMobilizeFilters(event, effective, rules);
      if (!verdict.include) filteredOut += 1;
      const location = event.location ?? {};
      const start = nextUpcomingTimeslot(event)?.start_date ?? Number.MAX_SAFE_INTEGER;
      return {
        start,
        row: {
          id: event.id,
          title: event.title,
          place: event.is_virtual
            ? 'Online'
            : [location.locality, location.region].filter(Boolean).join(', ') || '—',
          when: eventWhen(event),
          eventType: event.event_type,
          highPriority: Boolean(event.high_priority),
          isVirtual: Boolean(event.is_virtual),
          browserUrl: event.browser_url,
          include: verdict.include,
          reason: verdict.reason,
          alreadyImported: imported.has(String(event.id)),
        } satisfies MobilizePreviewRow,
      };
    });
    ordered.sort((a, b) => a.start - b.start);
    const rows = ordered.map((entry) => entry.row);

    const preview: MobilizePreview = {
      rows,
      settings: effective,
      inPersonTogether,
      virtualTogether,
      filteredOut,
    };

    if (settingsError) {
      preview.warning =
        'Mobilize tables are not installed yet — showing built-in defaults. Apply the migration before importing.';
    } else if (!parsed.data.feedUrl && feed === null && input.feedUrl) {
      preview.warning = 'That is not a recognizable Mobilize link; the saved filters were used.';
    }

    return { success: true, data: preview };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to preview Mobilize events');
  }
}

export interface MobilizeImportResult {
  slug: string;
  title: string;
  /** True when an existing hand-made card was adopted rather than duplicated. */
  converted: boolean;
  warnings: string[];
}

function revalidateEvents() {
  revalidateTag('events', 'hours');
  revalidatePath('/events');
  revalidatePath('/');
}

/**
 * Import one event by URL or id.
 *
 * The duplicate guard is not optional: the table already holds hand-made rows
 * whose `rsvp_url` points at these exact events. Matching one on its Mobilize
 * id adopts it — keeping its slug, sort order and category — instead of
 * rendering the same gathering twice on the calendar.
 */
export async function importMobilizeEvent(
  input: string
): Promise<MobilizeActionResult<MobilizeImportResult>> {
  try {
    const client = await adminClient();
    const eventId = parseMobilizeEventUrl(input);
    if (!eventId)
      return fail(
        'Paste a Mobilize event link, e.g. https://www.mobilize.us/indivisible/event/1011420/'
      );

    const event = await fetchEvent(eventId);
    if (!event) return fail('Mobilize did not return that event (it may have been deleted).');

    const mapped = mapMobilizeEvent(event);
    if (!mapped) return fail('That event has no upcoming date, so there is nothing to add.');

    const nowIso = new Date().toISOString();
    const facts = {
      title: mapped.row.title,
      date_label: mapped.row.date_label,
      time_label: mapped.row.time_label,
      starts_at: mapped.row.starts_at,
      ends_at: mapped.row.ends_at,
      location_name: mapped.row.location_name,
      address: mapped.row.address,
      rsvp_url: mapped.row.rsvp_url,
      external_url: mapped.row.external_url,
      last_synced_at: nowIso,
      updated_at: nowIso,
    };

    const { data: alreadyOwned } = await client
      .from('events')
      .select('slug')
      .eq('external_id', String(eventId))
      .maybeSingle();

    if (alreadyOwned) {
      const { error } = await client.from('events').update(facts).eq('slug', alreadyOwned.slug);
      if (error) return fail(error.message);
      revalidateEvents();
      return {
        success: true,
        data: {
          slug: alreadyOwned.slug,
          title: mapped.row.title,
          converted: false,
          warnings: mapped.warnings,
        },
      };
    }

    const { data: manualMatch } = await client
      .from('events')
      .select('slug')
      .is('external_id', null)
      .ilike('rsvp_url', `%/event/${eventId}%`)
      .limit(1)
      .maybeSingle();

    if (manualMatch) {
      const { error } = await client
        .from('events')
        .update({ ...facts, source: 'mobilize', external_id: String(eventId) })
        .eq('slug', manualMatch.slug);
      if (error) return fail(error.message);
      revalidateEvents();
      return {
        success: true,
        data: {
          slug: manualMatch.slug,
          title: mapped.row.title,
          converted: true,
          warnings: mapped.warnings,
        },
      };
    }

    const { error } = await client.from('events').insert({
      ...mapped.row,
      source: 'mobilize',
      highlight: false,
      sort_order: 100,
      is_hidden: false,
      sync_locked: false,
      last_synced_at: nowIso,
      updated_at: nowIso,
    });
    if (error) return fail(error.message);

    revalidateEvents();
    return {
      success: true,
      data: {
        slug: mapped.row.slug,
        title: mapped.row.title,
        converted: false,
        warnings: mapped.warnings,
      },
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to import that Mobilize event');
  }
}

export interface MobilizePreviewData {
  title: string;
  category:
    | 'Meetings'
    | 'Resistance Choir'
    | 'Voter Mobilization'
    | 'Rallies & Street Action'
    | 'Community';
  date_label: string;
  time_label: string;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string;
  address: string;
  description: string;
  rsvp_url: string;
  external_url: string;
  warnings: string[];
}

/**
 * Fetches and maps a Mobilize event without saving it, allowing an admin to
 * auto-fill the event creation modal on /events or inspect before committing.
 */
export async function getMobilizeEventPreview(
  input: string
): Promise<MobilizeActionResult<MobilizePreviewData>> {
  try {
    const eventId = parseMobilizeEventUrl(input);
    if (!eventId) {
      return fail(
        'Paste a Mobilize event link, e.g. https://www.mobilize.us/indivisible/event/1011420/'
      );
    }

    const event = await fetchEvent(eventId);
    if (!event) return fail('Mobilize did not return that event (it may have been deleted).');

    const mapped = mapMobilizeEvent(event);
    if (!mapped) return fail('That event has no upcoming date, so there is nothing to preview.');

    return {
      success: true,
      data: {
        title: mapped.row.title,
        category: mapped.row.category,
        date_label: mapped.row.date_label,
        time_label: mapped.row.time_label,
        starts_at: mapped.row.starts_at,
        ends_at: mapped.row.ends_at,
        location_name: mapped.row.location_name,
        address: mapped.row.address,
        description: mapped.row.description,
        rsvp_url: mapped.row.rsvp_url,
        external_url: mapped.row.external_url,
        warnings: mapped.warnings,
      },
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to preview Mobilize event');
  }
}

/** `pin` / `exclude` / `null` (clear) — the per-event answer. */
export async function setMobilizeRule(
  externalId: string,
  action: 'pin' | 'exclude' | null
): Promise<MobilizeActionResult<null>> {
  try {
    const cleanId = String(externalId).trim();
    if (!/^\d+$/.test(cleanId)) return fail('A numeric Mobilize event id is required');

    const client = await adminClient();
    if (action === null) {
      const { error } = await client
        .from('mobilize_event_rules')
        .delete()
        .eq('external_id', cleanId);
      if (error) return fail(error.message);
    } else {
      const { error } = await client
        .from('mobilize_event_rules')
        .upsert({ external_id: cleanId, action }, { onConflict: 'external_id' });
      if (error) return fail(error.message);
    }

    revalidateEvents();
    return { success: true, data: null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save the event rule');
  }
}

/** Hide or restore an imported event without deleting the row. */
export async function setMobilizeEventHidden(
  externalId: string,
  hidden: boolean
): Promise<MobilizeActionResult<null>> {
  try {
    const client = await adminClient();
    const { error } = await client
      .from('events')
      .update({ is_hidden: hidden, updated_at: new Date().toISOString() })
      .eq('external_id', String(externalId).trim());
    if (error) return fail(error.message);

    revalidateEvents();
    return { success: true, data: null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to update the event');
  }
}

/** Stop the sync touching one row (or let it resume). */
export async function setEventSyncLock(
  slug: string,
  locked: boolean
): Promise<MobilizeActionResult<null>> {
  try {
    const client = await adminClient();
    const { error } = await client
      .from('events')
      .update({ sync_locked: locked, updated_at: new Date().toISOString() })
      .eq('slug', slug);
    if (error) return fail(error.message);

    revalidateEvents();
    return { success: true, data: null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to update the event');
  }
}

export async function getMobilizeSyncRuns(
  limit = 10
): Promise<MobilizeActionResult<MobilizeSyncRun[]>> {
  try {
    const client = await adminClient();
    const { data, error } = await client
      .from('mobilize_sync_runs')
      .select('id, started_at, finished_at, checked, imported, updated, hidden, filtered, error')
      .order('started_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (error) return fail(error.message);
    return { success: true, data: (data ?? []) as MobilizeSyncRun[] };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to load sync history');
  }
}

/**
 * "Sync now" — invokes the Edge Function with the same credential the cron job
 * uses, `force` bypassing the 20-minute throttle. One implementation of the
 * sync, not a second copy in Node.
 */
export async function runMobilizeSyncNow(): Promise<MobilizeActionResult<Record<string, unknown>>> {
  try {
    await requireAdmin();

    const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = env.SUPABASE_SECRET_KEY;
    if (!secret) {
      return fail('SUPABASE_SECRET_KEY is not configured, so the sync function cannot be called.');
    }

    const response = await fetch(`${baseUrl}/functions/v1/sync-mobilize-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        apikey: secret,
      },
      body: JSON.stringify({ force: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return fail(
        typeof body.error === 'string'
          ? body.error
          : `The sync function returned HTTP ${response.status}`
      );
    }

    revalidateEvents();
    return { success: true, data: body };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to run the Mobilize sync');
  }
}
