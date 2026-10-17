import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Data Points Edge Function — Supabase Single Source of Truth API
//
// Serves data points from public.data_points to client applications, the
// visual editor, and server-side renderers.
//
// GET   /data-points              → { success: true, count, dataPoints, rows }
// GET   /data-points?group=home   → filtered by group
// GET   /data-points?key=home.hero.headline → filtered by key
// POST  /data-points              → updates or upserts a data point
// OPTIONS /data-points            → CORS preflight response
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

interface UpdatePayload {
  key?: string
  value?: string
  label?: string
  group_name?: string
  content_type?: string
  dataPoints?: Record<string, string>
}

interface DataPointRow {
  key: string
  group_name: string
  label: string
  value: string
  content_type?: string
  updated_at?: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: 'Database environment variables unconfigured' }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    )
  }

  const url = new URL(req.url)
  const groupParam = url.searchParams.get('group')
  const keyParam = url.searchParams.get('key')

  // Read client using ANON key with RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // ── GET: Query data points ──────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('data_points')
        .select('key, group_name, label, value, content_type, updated_at')
        .order('group_name')
        .order('key')

      if (groupParam) {
        const lower = groupParam.toLowerCase();
        const aliases: Record<string, string[]> = {
          product: ['products', 'product'],
          products: ['products', 'product'],
          link: ['links', 'link'],
          links: ['links', 'link'],
          faq: ['faqs', 'faq'],
          faqs: ['faqs', 'faq'],
          partner: ['partners', 'partner'],
          partners: ['partners', 'partner'],
          term: ['terms', 'term'],
          terms: ['terms', 'term'],
        };
        const groups = aliases[lower] || [groupParam];
        if (groups.length === 1) {
          query = query.eq('group_name', groups[0]);
        } else {
          query = query.in('group_name', groups);
        }
      }
      if (keyParam) {
        query = query.eq('key', keyParam)
      }

      const { data, error } = await query

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          },
        )
      }

      const rows = (data ?? []) as DataPointRow[]
      const dataPoints: Record<string, string> = {}
      for (const row of rows) {
        dataPoints[row.key] = row.value
      }

      return new Response(
        JSON.stringify({
          success: true,
          count: rows.length,
          dataPoints,
          rows,
          ts: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          },
        },
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return new Response(
        JSON.stringify({ success: false, error: message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      )
    }
  }

  // ── POST / PATCH: Update or upsert data point ─────────────────────────────
  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      const body = (await req.json()) as UpdatePayload

      // Writes require service role client to update public.data_points
      const adminKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
      const supabaseAdmin = createClient(SUPABASE_URL, adminKey)

      // Batch update mode
      if (body.dataPoints && typeof body.dataPoints === 'object') {
        const entries = Object.entries(body.dataPoints)
        const updates = []

        for (const [key, value] of entries) {
          if (!key || typeof value !== 'string') continue
          const { data, error } = await supabaseAdmin
            .from('data_points')
            .update({
              value,
              updated_at: new Date().toISOString(),
            })
            .eq('key', key)
            .select()

          if (!error && data) {
            updates.push(...data)
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            updatedCount: updates.length,
            records: updates,
          }),
          {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          },
        )
      }

      // Single item update mode
      if (!body.key || typeof body.value !== 'string') {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required fields 'key' and 'value'",
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          },
        )
      }

      const { data, error } = await supabaseAdmin
        .from('data_points')
        .upsert(
          {
            key: body.key,
            value: body.value,
            ...(body.label ? { label: body.label } : {}),
            ...(body.group_name ? { group_name: body.group_name } : {}),
            ...(body.content_type ? { content_type: body.content_type } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' },
        )
        .select()

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          record: data?.[0] ?? null,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return new Response(
        JSON.stringify({ success: false, error: message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      )
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    },
  )
})
