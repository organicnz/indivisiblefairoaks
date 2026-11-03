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
// OPTIONS /data-points            → CORS preflight response
//
// READ-ONLY, and deployed WITH --no-verify-jwt so that GET stays public.
//
// Writes are not served here. They go through `POST /api/data-points`, which
// authenticates the user, checks `profiles.is_admin`, and writes under RLS,
// where `is_admin()` enforces it a second time. This function used to carry a
// service-role write branch as well. Deployed with JWT verification off, that
// branch was a public write endpoint onto the site's CMS copy; the guard added
// on 2026-11-01 closed the hole, and this removal closes the class.
//
// Nothing reads the service-role key here any more, so the function no longer
// needs it in its environment at all.
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
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
        console.error('[data-points] query failed:', error.message)
        return new Response(
          JSON.stringify({ success: false, error: 'Request failed' }),
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
      // Postgres errors name tables and columns, and this endpoint is public.
      // The detail belongs in the log, not in a response to an anonymous caller.
      console.error('[data-points] request failed:', err)
      return new Response(
        JSON.stringify({ success: false, error: 'Request failed' }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      )
    }
  }

  // Writes are deliberately absent — see the header. A POST/PATCH here answers
  // 405 rather than 401: there is no authorization to satisfy, because there is
  // no write.
  return new Response(
    JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    },
  )
})
