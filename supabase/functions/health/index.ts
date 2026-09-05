import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Health-check edge function.
//
// Called by uptime monitors and CI live-probe jobs. Returns the current
// liveness status of the Supabase DB by performing a cheap single-row read.
//
// GET  /health  →  { ok, status, checks: { database }, latencyMs, ts }
// POST /health  →  same (so monitors can use either method)
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

Deno.serve(async (req: Request) => {
    // Allow GET and POST; reject everything else
    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const start = Date.now()
    let db: 'up' | 'degraded' | 'down' = 'down'

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
            const { error } = await supabase
                .from('products')
                .select('id')
                .limit(1)
                .maybeSingle()
            db = error ? 'degraded' : 'up'
        } catch {
            db = 'down'
        }
    }

    const latencyMs = Date.now() - start
    const ok = db === 'up'

    return new Response(
        JSON.stringify({
            ok,
            status: ok ? 'ok' : 'degraded',
            checks: { database: db },
            latencyMs,
            ts: new Date().toISOString(),
            service: 'health',
        }),
        {
            status: ok ? 200 : 503,
            headers: { 'Content-Type': 'application/json' },
        },
    )
})
