import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

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
  return Boolean(SERVICE_KEY && authorization === `Bearer ${SERVICE_KEY}`) ||
    Boolean(REFRESH_TOKEN && request.headers.get('x-walle-refresh-token') === REFRESH_TOKEN)
}

async function readTable(client: SupabaseClient<any>, table: string, columns: string): Promise<unknown[]> {
  const { data, error } = await client.from(table).select(columns).limit(MAX_ROWS)
  if (error) throw new Error(`${table}:${error.message}`)
  return data ?? []
}

async function readPublishedContent(client: SupabaseClient<any>): Promise<unknown[]> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('content')
    .select('title,slug,type,body,excerpt,status,published_at')
    .eq('status', 'publish')
    .or(`published_at.is.null,published_at.lte.${now}`)
    .limit(MAX_ROWS)
  if (error) throw new Error(`content:${error.message}`)
  return data ?? []
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY || !isAuthorized(request)) return json({ error: 'Unauthorized.' }, 401)

  try {
    const client = createClient<any>(SUPABASE_URL, SERVICE_KEY)
    const publicData = await Promise.all([
      (async () => ['content', await readPublishedContent(client)] as const)(),
      (async () => ['products', await readTable(client, 'products', 'name,slug,description,short_description,price,stock_status')] as const)(),
      (async () => ['events', await readTable(client, 'events', 'slug,title,date_label,time_label,location_name,address,description,rsvp_url')] as const)(),
      (async () => ['partners', await readTable(client, 'partners', 'slug,name,category,description,url')] as const)(),
      (async () => ['coalition_links', await readTable(client, 'coalition_links', 'slug,name,category,description,url,badge')] as const)(),
      (async () => ['newsletters', await readTable(client, 'newsletters', 'slug,title,date_label,description,topics,published_at')] as const)(),
      (async () => ['gallery_photos', await readTable(client, 'gallery_photos', 'slug,alt,caption,location,category,sign_quote,date_label,photographer')] as const)(),
    ])

    const refreshedAt = new Date().toISOString()
    const snapshots: Snapshot[] = []
    for (const [sourceKey, payload] of publicData) {
      const normalized = JSON.stringify(payload)
      snapshots.push({
        source_key: sourceKey,
        content_hash: await sha256(normalized),
        record_count: payload.length,
        payload,
        refreshed_at: refreshedAt,
      })
    }

    const { error } = await client.from('walle_knowledge_snapshots').upsert(snapshots, { onConflict: 'source_key' })
    if (error) throw new Error(`snapshot:${error.message}`)
    return json({ refreshed_at: refreshedAt, sources: snapshots.map(({ source_key, record_count, content_hash }) => ({ source_key, record_count, content_hash })) })
  } catch (error) {
    console.error('[walle-refresh] failed', error instanceof Error ? error.message : 'unknown-error')
    return json({ error: 'Refresh failed.' }, 500)
  }
})
