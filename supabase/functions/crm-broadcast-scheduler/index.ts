// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Broadcast scheduler.
 *
 * ## Why this exists
 *
 * `sendCRMBroadcast` can save a broadcast with status 'scheduled' and a
 * `scheduled_at` timestamp. This function runs on a cron (every minute via
 * Vercel) and dispatches scheduled broadcasts whose time has passed.
 *
 * ## How it works
 *
 * 1. Find scheduled broadcasts where scheduled_at <= now
 * 2. For each, resolve the audience and dispatch to crm-broadcast-send
 *
 * ## Idempotency
 *
 * The status transition 'scheduled' → 'queued' is a conditional update. If two
 * scheduler runs overlap, only one wins the transition; the other sees the row
 * already queued and skips it.
 *
 * ## Auth
 *
 * service_role only. Called by Vercel cron with the service key.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SENDER_URL = `${SUPABASE_URL}/functions/v1/crm-broadcast-send`

const app = new Hono()

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }
  const header = c.req.header('Authorization') ?? ''
  if (header !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
  return
})

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function assertConfigured(): void {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!SENDER_URL) missing.push('CRM_BROADCAST_FUNCTION_URL')
  if (missing.length > 0) {
    throw new HTTPException(503, { message: `Broadcast scheduler is not configured: ${missing.join(', ')}` })
  }
}

app.post('*', async (c) => {
  assertConfigured()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Find scheduled broadcasts whose time has passed
  const { data: due, error: readError } = await supabase
    .from('crm_broadcasts')
    .select('id, subject, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10)

  if (readError) return c.json({ error: readError.message }, 500)
  if (!due || due.length === 0) {
    return c.json({ ok: true, dispatched: 0 })
  }

  let dispatched = 0
  const errors: string[] = []

  for (const broadcast of due) {
    // Claim the transition: scheduled → queued. A concurrent scheduler that
    // already moved this row will match nothing here.
    const { data: claimed, error: claimError } = await supabase
      .from('crm_broadcasts')
      .update({ status: 'queued' })
      .eq('id', broadcast.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle()

    if (claimError) {
      errors.push(`${broadcast.id}: ${claimError.message}`)
      continue
    }
    if (!claimed) {
      // Someone else got there first, or the status changed under us.
      continue
    }

    // Dispatch to the sender
    try {
      const res = await fetch(SENDER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ broadcast_id: broadcast.id }),
      })
      if (!res.ok) {
        // Mark it failed so it does not retry forever
        await supabase
          .from('crm_broadcasts')
          .update({ status: 'failed', sent_at: new Date().toISOString() })
          .eq('id', broadcast.id)
        errors.push(`${broadcast.id}: sender responded ${res.status}`)
      } else {
        dispatched += 1
      }
    } catch (err) {
      await supabase
        .from('crm_broadcasts')
        .update({ status: 'failed', sent_at: new Date().toISOString() })
        .eq('id', broadcast.id)
      errors.push(`${broadcast.id}: ${err instanceof Error ? err.message : 'sender unreachable'}`)
    }
  }

  return c.json({ ok: true, dispatched, errors })
})

app.get('*', async () => {
  return c.json({ ok: true, service: 'crm-broadcast-scheduler' })
})
