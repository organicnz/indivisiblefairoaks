import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildMobilizeEventUrl,
  buildMobilizeEventsQuery,
  type MobilizeEvent,
  type MobilizeEventRule,
  type MobilizeSettings,
  mapMobilizeEvent,
  passesMobilizeFilters,
} from '../_shared/mobilize.ts'

// ---------------------------------------------------------------------------
// Mobilize event sync — issue #153
//
// Invoked by pg_cron through pg_net every 30 minutes (see
// `20261031120000_mobilize_events.sql`), and by the admin "Sync now" button.
//
// What it owns and what it does not:
//
//   writes   title, date/time labels, instants, venue, address, RSVP link
//   ignores  category, highlight, sort_order — curation an admin has done
//   skips    rows with sync_locked = true, entirely
//   hides    an event Mobilize 404s or that has no upcoming timeslot, and
//            never un-hides: a human hide has to stick
//
// The API is public and keyless. Authentication here is about *who may trigger
// a run*, not about reading Mobilize: the gateway's JWT verification stays on
// and the caller presents the service-role key, exactly like walle-refresh.
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** Two runs inside this window are almost always a retry, not a change. */
const MIN_MINUTES_BETWEEN_RUNS = 20

/** Mobilize allows 15 GET/sec; this is a polite fraction of it. */
const REQUEST_SPACING_MS = 250

const MAX_PAGES = 4

const USER_AGENT =
  'Indivisible-Fair-Oaks-Carmichael-EventSync/1.0 (+https://indivisiblefairoaks.org)'

interface EventRow {
  slug: string
  rsvp_url: string | null
  source: string | null
  external_id: string | null
  sync_locked: boolean | null
  category: string
  highlight: boolean | null
  sort_order: number
}

interface RunCounters {
  checked: number
  imported: number
  updated: number
  hidden: number
  filtered: number
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get('authorization') ?? ''
  const apikey = request.headers.get('apikey') ?? ''
  return Boolean(SERVICE_KEY) && (authorization === `Bearer ${SERVICE_KEY}` || apikey === SERVICE_KEY)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function mobilizGet<T>(url: string): Promise<{ status: number; data: T | null }> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    await response.body?.cancel()
    return { status: response.status, data: null }
  }
  const body = (await response.json()) as { data?: T }
  return { status: response.status, data: (body.data ?? null) as T | null }
}

/** Every page of a discovery query, up to a bound that keeps a run short. */
async function fetchEventList(url: string): Promise<MobilizeEvent[]> {
  const events: MobilizeEvent[] = []
  let next: string | null = url
  for (let page = 0; page < MAX_PAGES && next; page += 1) {
    const response = await fetch(next, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      console.error(`[sync-mobilize-events] list ${next} → HTTP ${response.status}`)
      break
    }
    const body = (await response.json()) as {
      data?: MobilizeEvent[]
      next?: string | null
      results_limited_to?: number | null
    }
    events.push(...(body.data ?? []))
    if (body.results_limited_to && events.length >= body.results_limited_to) break
    next = body.next ?? null
    if (next) await sleep(REQUEST_SPACING_MS)
  }
  return events
}

/** `https://…/event/1072857/` → `1072857`, for the duplicate guard. */
function eventIdFromRsvpUrl(url: string | null): string | null {
  const match = /\/events?\/(\d+)/.exec(url ?? '')
  return match ? match[1] : null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY || !isAuthorized(request)) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  let force = false
  try {
    const body = await request.json()
    force = body?.force === true
  } catch {
    // An empty body from pg_cron is the normal case.
  }

  const client = createClient<any>(SUPABASE_URL, SERVICE_KEY)
  const now = new Date()
  const nowIso = now.toISOString()

  const counters: RunCounters = { checked: 0, imported: 0, updated: 0, hidden: 0, filtered: 0 }
  const errors: string[] = []

  // Declared outside the `try` so a thrown error can still close the row it
  // opened. An unclosed row is not just untidy: it reads as a run that never
  // finished, and the throttle below used to count it.
  let runId: number | null = null

  try {
    const { data: settingsRow, error: settingsError } = await client
      .from('mobilize_settings')
      .select('enabled, org_id, zipcode, max_dist, locality_allowlist, include_virtual, high_priority_only, auto_publish')
      .eq('id', 1)
      .maybeSingle()

    if (settingsError) throw new Error(`settings:${settingsError.message}`)
    if (!settingsRow) return json({ ok: true, skipped: 'no-settings' })
    if (!settingsRow.enabled) return json({ ok: true, skipped: 'disabled' })

    const settings = settingsRow as MobilizeSettings

    if (!force) {
      const { data: lastRun } = await client
        .from('mobilize_sync_runs')
        .select('started_at')
        .not('finished_at', 'is', null)
        .is('error', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastRun?.started_at) {
        const elapsedMinutes = (now.getTime() - new Date(lastRun.started_at).getTime()) / 60_000
        if (elapsedMinutes < MIN_MINUTES_BETWEEN_RUNS) {
          return json({ ok: true, skipped: 'throttled', elapsed_minutes: Math.round(elapsedMinutes) })
        }
      }
    }

    const { data: runRow, error: runError } = await client
      .from('mobilize_sync_runs')
      .insert({ started_at: nowIso })
      .select('id')
      .single()
    if (runError) throw new Error(`run:${runError.message}`)
    runId = runRow.id as number

    const { data: ruleRows } = await client
      .from('mobilize_event_rules')
      .select('external_id, action')
    const rules = (ruleRows ?? []) as MobilizeEventRule[]

    const { data: eventRows, error: eventsError } = await client
      .from('events')
      .select('slug, rsvp_url, source, external_id, sync_locked, category, highlight, sort_order')
    if (eventsError) throw new Error(`events:${eventsError.message}`)

    const rows = (eventRows ?? []) as EventRow[]
    const byExternalId = new Map<string, EventRow>()
    const byRsvpEventId = new Map<string, EventRow>()
    for (const row of rows) {
      if (row.external_id) byExternalId.set(row.external_id, row)
      const rsvpId = eventIdFromRsvpUrl(row.rsvp_url)
      if (rsvpId && !row.external_id) byRsvpEventId.set(rsvpId, row)
    }

    const handled = new Set<string>()

    const upsertMapped = async (event: MobilizeEvent) => {
      counters.checked += 1
      const externalId = String(event.id)
      handled.add(externalId)

      const existing = byExternalId.get(externalId)
      if (existing?.sync_locked) return

      const mapped = mapMobilizeEvent(event, now)
      if (!mapped) {
        if (existing) {
          const { error } = await client
            .from('events')
            .update({ is_hidden: true, last_synced_at: nowIso, updated_at: nowIso })
            .eq('external_id', externalId)
          if (error) errors.push(`hide ${externalId}: ${error.message}`)
          else counters.hidden += 1
        }
        return
      }

      // Facts only. `description` is written on insert, because an admin may
      // have shortened it; `category`, `highlight` and `sort_order` are never
      // written after the row exists.
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
      }

      if (existing) {
        const { error } = await client
          .from('events')
          .update(facts)
          .eq('external_id', externalId)
        if (error) errors.push(`update ${externalId}: ${error.message}`)
        else counters.updated += 1
        return
      }

      // Duplicate guard: the table already holds hand-made rows whose RSVP link
      // points at this very event (the choir protest, the monthly gathering).
      // Converting one preserves its slug, sort order and curation instead of
      // rendering the same gathering twice.
      const manual = byRsvpEventId.get(externalId)
      if (manual) {
        const { error } = await client
          .from('events')
          .update({
            ...facts,
            source: 'mobilize',
            external_id: externalId,
          })
          .eq('slug', manual.slug)
        if (error) errors.push(`convert ${externalId}: ${error.message}`)
        else {
          counters.updated += 1
          byExternalId.set(externalId, { ...manual, external_id: externalId, source: 'mobilize' })
        }
        return
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
      })
      if (error) errors.push(`insert ${externalId}: ${error.message}`)
      else counters.imported += 1
    }

    // ── Discovery ────────────────────────────────────────────────────────────
    const discoveryUrls = [buildMobilizeEventsQuery(settings)]
    if (settings.include_virtual) {
      discoveryUrls.push(buildMobilizeEventsQuery(settings, { virtual: true }))
    }

    for (const [index, url] of discoveryUrls.entries()) {
      if (index > 0) await sleep(REQUEST_SPACING_MS)
      for (const event of await fetchEventList(url)) {
        const verdict = passesMobilizeFilters(event, settings, rules)
        if (!verdict.include) {
          counters.filtered += 1
          continue
        }

        // `auto_publish` off means "find them, but let me add them": discovery
        // only refreshes rows that are already on the calendar, and the admin
        // tab shows the rest for a one-click import. Anything else would make
        // the checkbox a control that does nothing.
        if (
          !settings.auto_publish &&
          !byExternalId.has(String(event.id)) &&
          !byRsvpEventId.has(String(event.id))
        ) {
          counters.filtered += 1
          continue
        }

        await upsertMapped(event)
      }
    }

    // ── Refresh ──────────────────────────────────────────────────────────────
    // Imported rows can drop out of the discovery feed — they pass, they move
    // out of the radius, they are deleted. Refreshing by id keeps the calendar
    // honest about time and venue changes, and turns a 404 into a hide.
    for (const row of rows) {
      if (row.source !== 'mobilize' || !row.external_id) continue
      if (handled.has(row.external_id)) continue
      if (row.sync_locked) continue

      await sleep(REQUEST_SPACING_MS)
      const { status, data } = await mobilizGet<MobilizeEvent>(
        buildMobilizeEventUrl(Number(row.external_id))
      )

      if (status === 404) {
        const { error } = await client
          .from('events')
          .update({ is_hidden: true, last_synced_at: nowIso, updated_at: nowIso })
          .eq('external_id', row.external_id)
        if (error) errors.push(`hide ${row.external_id}: ${error.message}`)
        else counters.hidden += 1
        continue
      }

      if (!data) {
        errors.push(`refresh ${row.external_id}: HTTP ${status}`)
        continue
      }

      await upsertMapped(data)
    }

    const finishedAt = new Date().toISOString()
    const { error: finishError } = await client
      .from('mobilize_sync_runs')
      .update({
        finished_at: finishedAt,
        checked: counters.checked,
        imported: counters.imported,
        updated: counters.updated,
        hidden: counters.hidden,
        filtered: counters.filtered,
        error: errors.length > 0 ? errors.slice(0, 5).join(' | ').slice(0, 2000) : null,
      })
      .eq('id', runId)
    if (finishError) console.error(`[sync-mobilize-events] run update: ${finishError.message}`)

    return json({ ok: errors.length === 0, ...counters, errors: errors.slice(0, 5) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error'
    console.error('[sync-mobilize-events] failed', message)

    if (runId !== null) {
      const { error: closeError } = await client
        .from('mobilize_sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          checked: counters.checked,
          imported: counters.imported,
          updated: counters.updated,
          hidden: counters.hidden,
          filtered: counters.filtered,
          error: message.slice(0, 2000),
        })
        .eq('id', runId)
      if (closeError) {
        console.error(`[sync-mobilize-events] failed-run update: ${closeError.message}`)
      }
    }

    return json({ error: 'Sync failed.', detail: message, ...counters }, 500)
  }
})
