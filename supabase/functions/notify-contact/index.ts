// @deno-types="npm:@hono/hono@^5.0.0"
// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Contact form email delivery.
//
// Called fire-and-forget by the contact_submissions AFTER INSERT trigger
// (pg_net) with { id }. The payload carries NO row data — the submission is
// fetched server-side, so callers can never inject arbitrary email content.
//
// Abuse model: deployed --no-verify-jwt per project convention (the anon key
// is public anyway). Safety comes from the atomic claim: each submission row
// can yield exactly one notification, ever. Volume is additionally throttled
// in SQL (see 20260825140000_contact_notification.sql).
// ---------------------------------------------------------------------------

const REQUIRED_ENV: [string, string | undefined][] = [
  ['SUPABASE_URL', Deno.env.get('SUPABASE_URL')],
  ['SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')],
  ['RESEND_API_KEY', Deno.env.get('RESEND_API_KEY')],
]

for (const [name, value] of REQUIRED_ENV) {
  if (!value) {
    throw new Error(`notify-contact is missing required environment variable: ${name}`)
  }
}

const SUPABASE_URL = REQUIRED_ENV[0][1]!
const SUPABASE_SERVICE_ROLE_KEY = REQUIRED_ENV[1][1]!
const RESEND_API_KEY = REQUIRED_ENV[2][1]!

const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'orders@indivisiblefairoaks.org'
const TO_EMAIL = Deno.env.get('ADMIN_ORDER_EMAIL')

// Max notifications per rolling 10 minutes, globally.
const NOTIFY_VOLUME_CAP = 20

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

/** Best-effort claim release — never let cleanup mask the primary outcome. */
async function releaseClaim(id: number) {
  try {
    await supabaseAdmin().from('contact_submissions').update({ email_sent_at: null }).eq('id', id)
  } catch (err) {
    console.error(`[contact:${id}] claim release failed:`, err)
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Strips control/format characters (incl. CR/LF) that could smuggle SMTP
 * headers when echoed into subjects or addresses. */
function stripControls(value: string): string {
  return value.replace(/\p{C}/gu, '')
}

function buildEmail(name: string, email: string, message: string, receivedAt: string): string {
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message)

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(209,255,0,0.2);">
<tr><td style="padding:28px 40px;border-bottom:1px solid rgba(209,255,0,0.15);">
<span style="color:#D1FF00;font-weight:900;font-size:18px;letter-spacing:0.2em;text-transform:uppercase;">Indivisible Fair Oaks</span>
<span style="color:rgba(255,255,255,0.4);font-weight:700;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-left:12px;">Contact Form</span></td></tr>
<tr><td style="padding:32px 40px;color:#E2E8F0;font-size:14px;line-height:1.7;">
<p style="margin:0 0 18px;"><span style="display:block;color:rgba(255,255,255,0.45);font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">From</span><strong style="font-size:16px;">${safeName}</strong></p>
<p style="margin:0 0 18px;"><span style="display:block;color:rgba(255,255,255,0.45);font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">Email</span><a href="mailto:${safeEmail}" style="color:#D1FF00;text-decoration:none;">${safeEmail}</a></p>
<p style="margin:0;"><span style="display:block;color:rgba(255,255,255,0.45);font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">Message</span>${safeMessage}</p>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid rgba(209,255,0,0.2);text-align:center;">
<p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Received ${receivedAt} PT &middot; Reply directly to this email</p></td></tr>
</table></td></tr></table></body></html>`
}

function buildCustomerCopy(name: string, email: string, message: string, receivedAt: string): string {
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message)

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(209,255,0,0.2);">
<tr><td style="padding:28px 40px;border-bottom:1px solid rgba(209,255,0,0.15);">
<span style="color:#D1FF00;font-weight:900;font-size:18px;letter-spacing:0.2em;text-transform:uppercase;">Indivisible Fair Oaks</span>
<span style="color:rgba(255,255,255,0.4);font-weight:700;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-left:12px;">Message Received</span></td></tr>
<tr><td style="padding:32px 40px;color:#E2E8F0;font-size:14px;line-height:1.7;">
<p style="margin:0 0 18px;">Hi ${safeName}, thanks for getting in touch — this is a copy of the message you sent us via indivisiblefairoaks.org:</p>
<p style="margin:0 0 18px;padding:16px 20px;background:#0F172A;border-radius:12px;border-left:3px solid #D1FF00;">${safeMessage}</p>
<p style="margin:0;">Our team will get back to you at ${safeEmail} as soon as possible. No need to reply to this email.</p>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid rgba(209,255,0,0.2);text-align:center;">
<p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Sent ${receivedAt} PT &middot; Indivisible Fair Oaks &middot; Civic Action &middot; Sacramento County</p></td></tr>
</table></td></tr></table></body></html>`
}

const app = new Hono()

app.post('*', async (c) => {
  let payload: { id?: unknown }
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const id = payload.id
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Valid numeric submission id required' }, 400)
  }

  // Atomic claim: exactly one caller ever wins this row. Concurrent triggers,
  // replayed pg_net requests, or scripted calls to this endpoint all collapse
  // into a single notification (or none, for unknown ids).
  const admin = supabaseAdmin()
  const { data: claimed, error: claimError } = await admin
    .from('contact_submissions')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', id)
    .is('email_sent_at', null)
    .select('name, email, message, created_at, wants_copy')
    .single()

  if (claimError || !claimed) {
    console.log(`[contact:${id}] no unclaimed submission — nothing to do`)
    return c.json({ ok: true, skipped: 'unclaimed-or-unknown' })
  }

  if (!TO_EMAIL) {
    console.warn(`[contact:${id}] ADMIN_ORDER_EMAIL not set — releasing claim, skipping send`)
    await releaseClaim(id)
    return c.json({ ok: true, skipped: 'no-recipient' })
  }

  // Volume guard (moved here from the retired SQL trigger): RLS permits
  // anonymous inserts, so a scripted form flood could otherwise generate
  // unbounded notification sends. Submissions always persist — only the
  // emails stop past the rolling window.
  const { count: recent } = await admin
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', new Date(Date.now() - 10 * 60_000).toISOString())

  if ((recent ?? 0) > NOTIFY_VOLUME_CAP) {
    console.warn(`[contact:${id}] volume cap reached (${recent}/10min) — releasing claim, skipping sends`)
    await releaseClaim(id)
    return c.json({ ok: true, skipped: 'volume-cap' })
  }

  // Control-char hygiene before user data touches subjects, addresses, or
  // reply paths (defense against SMTP header smuggling).
  const contactName = stripControls(claimed.name)
  const contactEmail = stripControls(claimed.email)

  const receivedPt = new Date(claimed.created_at).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: contactEmail,
      subject: `New message from ${contactName} — indivisiblefairoaks.org`,
      html: buildEmail(contactName, contactEmail, claimed.message, receivedPt),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[contact:${id}] Resend rejected the email:`, err)
    await releaseClaim(id)
    return c.json({ ok: false, error: 'send-failed' }, 502)
  }

  console.log(`[contact:${id}] notification sent to ${TO_EMAIL}`)

  // Sender's copy: opt-in only, recipient locked to the row's own address so
  // the feature can never relay spam to arbitrary third parties. Best-effort
  // — a failed copy never un-delivers the admin notification.
  let copied = false
  if (claimed.wants_copy) {
    const copyRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [contactEmail],
        reply_to: TO_EMAIL,
        subject: 'Copy of your message to Indivisible Fair Oaks',
        html: buildCustomerCopy(
          contactName,
          contactEmail,
          claimed.message,
          receivedPt
        ),
      }),
    })
    copied = copyRes.ok
    if (!copied) {
      console.error(`[contact:${id}] sender copy failed:`, await copyRes.text())
    }
  }

  return c.json({ ok: true, emailed: true, copied })
})

Deno.serve((req) => app.fetch(req))
