// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  buildBroadcastEmail,
  BROADCAST_RECIPIENT_CEILING,
  isDeliverableAddress,
} from '../_shared/broadcast.ts'

/**
 * Background broadcast sender.
 *
 * ## Why this exists
 *
 * `sendCRMBroadcast` used to deliver the whole campaign inside a single Next.js
 * server action: five recipients per sequential round-trip, within one request.
 * Past roughly a thousand recipients the platform killed the request. The log
 * row had already been written as `sending` before the loop began and was never
 * corrected, so an interrupted send sat at `sending` forever, rendered as a
 * benign amber pill, with no way to retry or to tell how much had gone out.
 *
 * The action now only queues the broadcast and calls this function. Delivery,
 * progress and the final status live here, and the composer's poll reads them
 * off the row.
 *
 * ## Idempotency
 *
 * `dispatched_at` is claimed with a conditional update before any send. A second
 * dispatch — a retried request, a duplicated job, a curious admin with the
 * service key — finds the row already claimed and exits without sending. A
 * broadcast that has already gone out must never go out twice.
 *
 * ## Auth
 *
 * service_role only. The caller is an admin-gated server action; this function
 * is not a public endpoint and must never be reachable with the anon key.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'contact@indivisiblefairoaks.org'
const ADMIN_ORDER_EMAIL = Deno.env.get('ADMIN_ORDER_EMAIL') ?? 'contact@indivisiblefairoaks.org'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org'
const LOGO_PATH = 'storage/v1/object/public/media/wp-content/uploads/2021/10/logo.png'
const RESEND_API_URL = 'https://api.resend.com/emails'

/** Recipients per PostgREST page. */
const PAGE = 500
/** Concurrent sends per round. Kept modest: this function is CPU-bound on
 *  awaiting the provider, and a larger fan-out just queues inside one isolate. */
const BATCH = 10
/** How often the row is updated so the composer's poll shows movement. */
const PROGRESS_EVERY = 25
/**
 * Per-request budget for the Resend API.
 *
 * Generous for a single email send, and short relative to the isolate's own
 * limit: the point is that one slow provider connection fails as *this batch*
 * rather than stalling the whole campaign. A hang here is unrecoverable in
 * practice — the row stays `sending` with `dispatched_at` set, which is the
 * state docs/crm-operations.md says must never be re-dispatched — so the
 * timeout has to be here rather than left to the platform.
 */
const RESEND_TIMEOUT_MS = 20_000

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
  if (!RESEND_API_KEY) missing.push('RESEND_API_KEY')
  if (missing.length > 0) {
    throw new HTTPException(503, { message: `Broadcast sender is not configured: ${missing.join(', ')}` })
  }
}

interface Recipient {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  unsubscribe_token: string
}

// '*', not '/': Supabase delivers the request with its full path
// (/functions/v1/crm-broadcast-send), so a '/' route never matches and the
// handler is silently dead — the auth middleware still answers 401, which
// makes it look deployed. Every other function in this repo uses '*'.
app.post('*', async (c) => {
  assertConfigured()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  let payload: { broadcast_id?: string }
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  const broadcastId = typeof payload.broadcast_id === 'string' ? payload.broadcast_id : ''
  if (!broadcastId) return c.json({ error: 'broadcast_id is required' }, 400)

  const { data: broadcast, error: readError } = await supabase
    .from('crm_broadcasts')
    .select('id, subject, body, status, recipient_count, sent_count, dispatched_at, target_tags, target_status, target_districts, test_recipient, test_only')
    .eq('id', broadcastId)
    .maybeSingle()

  if (readError) return c.json({ error: readError.message }, 500)
  if (!broadcast) return c.json({ error: 'broadcast not found' }, 404)

  // Claim the run. A row already claimed, or one that is not in a sendable
  // state, exits without touching the audience.
  if (broadcast.status === 'sent') {
    return c.json({ ok: true, skipped: true, reason: 'already sent' })
  }
  if (broadcast.dispatched_at) {
    return c.json({ ok: true, skipped: true, reason: 'already dispatched' })
  }
  // Only a queued campaign may be delivered. The app dispatches nothing else, so
  // this is purely defensive — but a draft is an unsaved draft, and anything
  // holding the service key should not be able to send one by accident.
  if (broadcast.status !== 'queued') {
    return c.json({ ok: true, skipped: true, reason: `not sendable (status: ${broadcast.status})` })
  }

  const { data: claimed, error: claimError } = await supabase
    .from('crm_broadcasts')
    .update({ dispatched_at: new Date().toISOString(), status: 'sending' })
    .eq('id', broadcastId)
    .is('dispatched_at', null)
    .select('id')
    .maybeSingle()

  if (claimError) return c.json({ error: claimError.message }, 500)
  // The conditional update is the lock: if it matched no row, someone else won.
  if (!claimed) return c.json({ ok: true, skipped: true, reason: 'claimed concurrently' })

  const body = broadcast.body ?? ''
  const subject = broadcast.subject ?? '(no subject)'

  const recipients: Recipient[] = []

  /**
   * A self-test addresses exactly one person, and that person is named in the
   * row rather than derived from the audience filters.
   *
   * The narrowing is here, not in the caller, on purpose: this is the only place
   * the recipient list is decided, so a preview cannot be widened by anything
   * written on the client — not a stray `target_*`, not a stale audience. A
   * preview that quietly resolved to a real list would be worse than no preview
   * at all, because the author would ship on the strength of it.
   *
   * `test_only` is a one-way door, so it is read on its own. It used to be read
   * as `test_only === true && typeof test_recipient === 'string'`, and that
   * conjunction was the whole safety property: a `test_only` row whose
   * `test_recipient` was NULL fell through it, `isSelfTest` came out false, and
   * the audience loop then ran against every opted-in contact in the database.
   * The column is nullable and nothing constrained the pair, so "a preview that
   * sends to the whole list" was one absent value away — no bad intent, no
   * caller change, just a row that never got its address written.
   *
   * So the flag now decides on its own, and a self-test with no usable address
   * is a hard refusal. The audience loop below is reached only when
   * `test_only` is false outright.
   */
  const isSelfTest = broadcast.test_only === true
  if (isSelfTest) {
    const address =
      typeof broadcast.test_recipient === 'string' ? broadcast.test_recipient.trim() : ''
    if (!isDeliverableAddress(address)) {
      await finish(supabase, broadcastId, 'failed', 0, 0, 0)
      return c.json(
        {
          error:
            'self-test has no usable test_recipient; refusing to fall back to the full audience',
        },
        422,
      )
    }
    recipients.push({
      id: 'selftest',
      email: address,
      first_name: 'Test',
      last_name: 'Recipient',
      // No token: a preview has no unsubscribe link, because there is no
      // standing subscription to withdraw — this address never opted in.
      unsubscribe_token: '',
    })
  }

  /**
   * The ceiling is a refusal, not a truncation.
   *
   * The loop condition alone cannot enforce that: it stops at
   * `BROADCAST_RECIPIENT_CEILING` and returns whatever it collected, so an
   * audience larger than the ceiling was quietly shortened and then reported as
   * `sent` with a plausible `sent_count`. The organizer sees a delivered
   * campaign; a third of the list silently never heard about it. Every real
   * exit from this loop is therefore one of "the query ran dry" or "the ceiling
   * stopped us", and only the first is allowed to proceed to delivery.
   */
  let audienceExhausted = false
  // `offset <= CEILING`, not `<`, and the over-the-line break below. The
  // previous condition stopped one page *before* the boundary, so it could never
  // learn whether the audience ended exactly at the ceiling or continued past
  // it: an audience of precisely 5,000 was refused as "larger than the limit".
  // Reading one page further is the only way to tell those apart, and it is
  // bounded — the loop breaks the moment the ceiling is passed, so the work is
  // still capped rather than proportional to the list.
  for (let offset = 0; !isSelfTest && offset <= BROADCAST_RECIPIENT_CEILING; offset += PAGE) {
    let qb = supabase
      .from('crm_contacts')
      .select('id, email, first_name, last_name, unsubscribe_token')
      .eq('do_not_email', false)
      // Ordered, and by the primary key.
      //
      // `.range(offset, …)` is *offset* paging, which is only coherent against a
      // total order that does not change between statements. PostgREST emits no
      // `order` parameter when none is given, so the row order is whatever the
      // plan happens to produce, and it is not guaranteed to match the previous
      // page's. A contact who opted out — or a CSV import that landed — between
      // page 3 and page 4 shifts every later row by one, so the boundary contact
      // appears in two pages and is mailed twice, and `recipient_count` is
      // wrong. `id` is unique, so it is a total order; a non-unique column would
      // still tie.
      .order('id', { ascending: true })

    const tags = broadcast.target_tags ?? []
    const statuses = broadcast.target_status ?? []
    const districts = broadcast.target_districts ?? []
    if (statuses.length > 0) qb = qb.in('status', statuses)
    if (districts.length > 0) qb = qb.in('district', districts)
    for (const tag of tags) qb = qb.contains('tags', [tag])

    const { data, error } = await qb.range(offset, offset + PAGE - 1)
    if (error) {
      await finish(supabase, broadcastId, 'failed', recipients.length, 0, 0)
      return c.json({ error: `recipient query failed: ${error.message}` }, 500)
    }
    if (!data || data.length === 0) {
      audienceExhausted = true
      break
    }
    recipients.push(...(data as Recipient[]))
    // Past the ceiling is a refusal, not a truncation: stop collecting and leave
    // `audienceExhausted` false so the check below refuses before any send.
    if (recipients.length > BROADCAST_RECIPIENT_CEILING) break
    // A short page is the only evidence that there is nothing after it.
    if (data.length < PAGE) {
      audienceExhausted = true
      break
    }
  }

  if (!isSelfTest && !audienceExhausted) {
    await finish(supabase, broadcastId, 'failed', 0, 0, 0)
    return c.json(
      {
        error: `audience exceeds the ${BROADCAST_RECIPIENT_CEILING.toLocaleString()} recipient ceiling for one broadcast; nothing was sent`,
      },
      422,
    )
  }

  const logoUrl = `${SUPABASE_URL}/${LOGO_PATH}`
  let sent = 0
  let failed = 0
  let activityWriteFailures = 0
  let activityRowsLost = 0
  const activityRows: Array<Record<string, unknown>> = []

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (recipient) => {
        const recipientName =
          [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'Supporter'
        // A preview has no subscription behind it, so it carries no unsubscribe
        // link and no List-Unsubscribe header. A link built from an empty token
        // would be a dead URL in a real inbox, and an unsubscribe header on a
        // message the recipient never subscribed to is simply untrue.
        const unsubscribe = isSelfTest
          ? ''
          : `${APP_URL.replace(/\/$/, '')}/api/crm/unsubscribe?token=${recipient.unsubscribe_token}`
        const { html, text } = buildBroadcastEmail({
          recipientName,
          body,
          unsubscribeUrl: unsubscribe,
          logoUrl,
        })

        const res = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: [recipient.email],
            subject,
            html,
            text,
            reply_to: ADMIN_ORDER_EMAIL,
            headers: isSelfTest
              ? { 'X-CRM-Test': 'true' }
              : {
                  'List-Unsubscribe': `<${unsubscribe}>, <mailto:${ADMIN_ORDER_EMAIL}?subject=Unsubscribe>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                },
            tags: [
              { name: 'type', value: isSelfTest ? 'crm-broadcast-test' : 'crm-broadcast' },
              { name: 'broadcast_id', value: broadcastId },
            ],
          }),
          // Bounded. Without it a hung provider connection strands the row at
          // `sending` with `dispatched_at` set — the one state
          // docs/crm-operations.md says must never be touched, because
          // clearing it re-sends to everyone already delivered to. A timeout
          // turns that unrecoverable hang into a counted failure this isolate
          // can finish() and report.
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        })
        return { recipient, res }
      }),
    )

    for (const { recipient, res } of results) {
      if (res.ok) {
        sent += 1
        // No activity row for a preview. `crm_activities.contact_id` references
        // `crm_contacts(id)`, and a self-test has no contact — the sentinel id
        // would fail the foreign key and abort the write. Logging it against a
        // real constituent would be worse: it would put "Broadcast: …" on
        // somebody's timeline for a message they never received.
        if (!isSelfTest) {
          activityRows.push({
            contact_id: recipient.id,
            type: 'email_sent',
            title: `Broadcast: ${subject}`,
            description: `Delivered via campaign #${broadcastId}`,
            metadata: { broadcast_id: broadcastId },
          });
        }
      } else {
        failed += 1
      }
    }

    if (activityRows.length > 0) {
      // The returned error used to be discarded, which made this a silent
      // data loss rather than a visible failure. `crm_activities_flood_guard`
      // (migration 20260929120000) RAISEs once 2,000 `email_sent` rows exist in
      // the last hour, and it fires *per statement* — so a broadcast large
      // enough to cross that line lost every activity row from there on, kept
      // counting `sent`, and finished as a healthy green campaign whose
      // recipients had no timeline entry showing they were ever contacted. The
      // count is now tracked, logged, and reported so the discrepancy is
      // visible instead of inferred.
      //
      // The rows are spliced *before* the write, so the loss count has to be the
      // length captured first. It used to add `BATCH` — the batch size, not the
      // number of rows — so a batch with two provider failures reported ten
      // activities lost when eight were. Over-reporting here is not harmless: the
      // number reaches the admin as a warning, and a warning that is wrong is
      // what gets ignored.
      const rowsToWrite = activityRows.splice(0)
      const { error: activityError } = await supabase.from('crm_activities').insert(rowsToWrite)
      if (activityError) {
        activityWriteFailures += 1
        activityRowsLost += rowsToWrite.length
        console.error(
          `[crm-broadcast-send] activity write failed for broadcast ${broadcastId}:`,
          activityError.message,
        )
      }
    }

    if ((i / BATCH) % Math.ceil(PROGRESS_EVERY / BATCH) === 0) {
      await supabase
        .from('crm_broadcasts')
        .update({ sent_count: sent, failed_count: failed })
        .eq('id', broadcastId)
    }
  }

  const status = sent > 0 ? 'sent' : 'failed'
  await finish(supabase, broadcastId, status, recipients.length, sent, failed)

  return c.json({
    ok: activityWriteFailures === 0,
    recipientCount: recipients.length,
    sent,
    failed,
    // Delivery is what `status` reports. These two are a separate, truthful
    // statement: the mail went out, the record of it did not. A caller that
    // only reads `ok` learns the truth; one that reads `sent` still gets the
    // delivery number it always did.
    ...(activityWriteFailures > 0
      ? {
          activityWriteFailures,
          activityRowsLost,
          warning:
            'delivery completed but some timeline entries could not be written; the guard in 20260929120000 may still be counting broadcast rows',
        }
      : {}),
  })
})

async function finish(
  // `SupabaseClient<any>`, NOT `ReturnType<typeof createClient>`: the latter
  // resolves the *generic* signature's constraints rather than the inferred
  // client, erasing to `SupabaseClient<unknown, {PostgrestVersion: string},
  // never, never, …>`, which the concrete `createClient(...)` below is not
  // assignable to — `Type '"public"' is not assignable to type 'never'`, five
  // times over, at every call site of this one function.
  // `wall-e-chat` and `walle-refresh` already type their clients this way.
  supabase: SupabaseClient<any>,
  broadcastId: string,
  status: 'sent' | 'failed',
  recipientCount: number,
  sent: number,
  failed: number,
): Promise<void> {
  await supabase
    .from('crm_broadcasts')
    .update({
      status,
      recipient_count: recipientCount,
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
    })
    .eq('id', broadcastId)
}

app.onError((err) => {
  console.error('[crm-broadcast-send]', err)
  return new Response(JSON.stringify({ error: 'internal' }), {
    status: 500,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
})

Deno.serve(app.fetch)
