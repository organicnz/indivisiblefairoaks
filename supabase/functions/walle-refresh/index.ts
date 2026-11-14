import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { selectCurrentEvents } from '../_shared/walle-freshness.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const REFRESH_TOKEN = Deno.env.get('WALLE_REFRESH_TOKEN') ?? ''
const MAX_ROWS = 500

type Snapshot = {
  source_key: string
  content_hash: string
  record_count: number
  payload: unknown[]
  refreshed_at: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get('authorization') ?? ''
  return (
    Boolean(SERVICE_KEY && authorization === `Bearer ${SERVICE_KEY}`) ||
    Boolean(REFRESH_TOKEN && request.headers.get('x-walle-refresh-token') === REFRESH_TOKEN)
  )
}

async function readTable(
  client: SupabaseClient<any>,
  table: string,
  columns: string
): Promise<unknown[]> {
  const { data, error } = await client.from(table).select(columns).limit(MAX_ROWS)
  if (error) throw new Error(`${table}:${error.message}`)
  return data ?? []
}

async function readPublishedContent(client: SupabaseClient<any>): Promise<unknown[]> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('content')
    .select('title,slug,type,body,excerpt,status,published_at,updated_at')
    .eq('status', 'publish')
    .or(`published_at.is.null,published_at.lte.${now}`)
    .limit(MAX_ROWS)
  if (error) throw new Error(`content:${error.message}`)
  return data ?? []
}

/**
 * The events table keeps history for the admin archive. A knowledge snapshot
 * must not: a past rally in the fallback corpus is a wrong answer waiting to be
 * repeated. Recurring rows stay, with their original date intact, and the chat
 * layer labels them as recurring rather than as the next occurrence.
 */
async function readCurrentEvents(client: SupabaseClient<any>, now: Date): Promise<unknown[]> {
  const { data, error } = await client
    .from('events')
    .select(
      'slug,title,category,date_label,time_label,starts_at,ends_at,location_name,address,description,rsvp_url,is_hidden'
    )
    .eq('is_hidden', false)
    .order('starts_at', { ascending: true, nullsFirst: false })
    .limit(MAX_ROWS)
  if (error) throw new Error(`events:${error.message}`)
  return selectCurrentEvents((data ?? []) as Record<string, unknown>[], now, MAX_ROWS).map(
    ({ _status: _ignored, ...row }) => row
  )
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY || !isAuthorized(request)) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  try {
    const client = createClient<any>(SUPABASE_URL, SERVICE_KEY)
    const refreshedAt = new Date()
    const publicData = await Promise.all([
      (async () => ['content', await readPublishedContent(client)] as const)(),
      (async () => ['events', await readCurrentEvents(client, refreshedAt)] as const)(),
      (async () => [
        'partners',
        await readTable(client, 'partners', 'slug,name,category,description,url'),
      ] as const)(),
      (async () => [
        'coalition_links',
        await readTable(client, 'coalition_links', 'slug,name,category,description,url,badge'),
      ] as const)(),
      (async () => [
        'newsletters',
        await readTable(client, 'newsletters', 'slug,title,date_label,description,topics,published_at'),
      ] as const)(),
      (async () => [
        'gallery_photos',
        await readTable(
          client,
          'gallery_photos',
          'slug,alt,caption,location,category,sign_quote,date_label,photographer'
        ),
      ] as const)(),
    ])

    const snapshots: Snapshot[] = []
    for (const [sourceKey, payload] of publicData) {
      const normalized = JSON.stringify(payload)
      snapshots.push({
        source_key: sourceKey,
        content_hash: await sha256(normalized),
        record_count: payload.length,
        payload,
        refreshed_at: refreshedAt.toISOString(),
      })
    }

    const { error } = await client
      .from('walle_knowledge_snapshots')
      .upsert(snapshots, { onConflict: 'source_key' })
    if (error) throw new Error(`snapshot:${error.message}`)

    // A table that is no longer public must not linger as an answer source.
    // `products` is the concrete case: the store was retired, but its snapshot
    // remained and could answer a gear question with obsolete inventory.
    const managed = new Set(snapshots.map(({ source_key }) => source_key))
    const { data: existing, error: listError } = await client
      .from('walle_knowledge_snapshots')
      .select('source_key')
    if (listError) throw new Error(`snapshot-list:${listError.message}`)
    const removed: string[] = []
    for (const row of existing ?? []) {
      const sourceKey = String((row as { source_key?: unknown }).source_key ?? '')
      if (!sourceKey || managed.has(sourceKey)) continue
      const { error: deleteError } = await client
        .from('walle_knowledge_snapshots')
        .delete()
        .eq('source_key', sourceKey)
      if (deleteError) throw new Error(`snapshot-prune:${deleteError.message}`)
      removed.push(sourceKey)
    }

    return json({
      refreshed_at: refreshedAt.toISOString(),
      sources: snapshots.map(({ source_key, record_count, content_hash }) => ({
        source_key,
        record_count,
        content_hash,
      })),
      removed_snapshots: removed,
    })
  } catch (error) {
    console.error(
      '[walle-refresh] failed',
      error instanceof Error ? error.message : 'unknown-error'
    )
    return json({ error: 'Refresh failed.' }, 500)
  }
})
