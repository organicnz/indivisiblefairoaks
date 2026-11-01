// @deno-types="npm:@hono/hono@^5.0.0"
// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveContactNotificationRecipient } from '../_shared/contact-recipient.ts'
import { htmlToText, sendResendEmail } from '../_shared/email.ts'

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

const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'contact@indivisiblefairoaks.org'
const TO_EMAIL = Deno.env.get('ADMIN_ORDER_EMAIL') ?? 'contact@indivisiblefairoaks.org'
const BACKEND_VERIFY_EMAIL = Deno.env.get('BACKEND_VERIFY_EMAIL')

const NOTIFY_VOLUME_CAP = 5

// Max notifications per UTC day, globally. The Resend free tier allows
// 100 emails/day shared across contact notifications (up to 2 sends each),
// auth mail, and order mail — cap contact notifications well below that so
// a form flood can never exhaust the quota alone.
const NOTIFY_DAILY_CAP = 15

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

const LOGO_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/media/wp-content/uploads/2021/10/logo.png`
  : '/icon-512.png'

function buildEmail(name: string, email: string, message: string, receivedAt: string): string {
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message)

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
<a href="https://indivisiblefairoaks.org" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${LOGO_URL}" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
</a>
<div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">Contact Form Submission</div>
</td></tr>
<tr><td style="padding:36px 40px 28px;color:#E2E8F0;font-size:14px;line-height:1.7;">
<p style="margin:0 0 16px;"><span style="display:block;color:#94A3B8;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">From</span><strong style="font-size:16px;color:#FFFFFF;">${safeName}</strong></p>
<p style="margin:0 0 16px;"><span style="display:block;color:#94A3B8;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">Email</span><a href="mailto:${safeEmail}" style="color:#60A5FA;text-decoration:none;font-weight:600;">${safeEmail}</a></p>
<div style="margin:0 0 8px;"><span style="display:block;color:#94A3B8;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">Message</span></div>
<div style="margin:0;padding:18px 20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.6;">${safeMessage}</div>
</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
<p style="margin:0;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Received ${receivedAt} PT &middot; Reply directly to this email</p>
<p style="margin:6px 0 0;color:#64748B;font-size:11px;">Indivisible Fair Oaks-Carmichael &middot; Sacramento County</p>
</td></tr>
</table></td></tr></table></body></html>`
}

function buildCustomerCopy(name: string, email: string, message: string, receivedAt: string): string {
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message)

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
<a href="https://indivisiblefairoaks.org" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${LOGO_URL}" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
</a>
<div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">Message Received</div>
</td></tr>
<tr><td style="padding:36px 40px 28px;color:#E2E8F0;font-size:14px;line-height:1.7;">
<p style="margin:0 0 16px;color:#FFFFFF;font-weight:600;font-size:15px;">Hi ${safeName}, thanks for getting in touch with Indivisible Fair Oaks-Carmichael.</p>
<p style="margin:0 0 16px;color:#CBD5E1;">This is a confirmation copy of the message you submitted:</p>
<div style="margin:0 0 20px;padding:18px 20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.6;">${safeMessage}</div>
<p style="margin:0;color:#94A3B8;font-size:13px;">Our organizing team will get back to you at <a href="mailto:${safeEmail}" style="color:#60A5FA;text-decoration:none;">${safeEmail}</a> as soon as possible.</p>
</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
<p style="margin:0;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Sent ${receivedAt} PT &middot; Indivisible Fair Oaks-Carmichael</p>
<p style="margin:6px 0 0;color:#64748B;font-size:11px;">Grassroots Democracy &middot; Sacramento County</p>
</td></tr>
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

  const recipient = resolveContactNotificationRecipient({
    name: claimed.name,
    message: claimed.message,
    defaultRecipient: TO_EMAIL,
    verificationRecipient: BACKEND_VERIFY_EMAIL,
  })

  if (!recipient) {
    console.warn(`[contact:${id}] no safe notification recipient — releasing claim, skipping send`)
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

  // Daily ceiling (see NOTIFY_DAILY_CAP): bot floods arrive faster than any
  // rolling window throttles, so bound total sends per UTC day. Claimed rows
  // are released — a later retry still sends nothing until the cap resets.
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { count: sentToday } = await admin
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('email_sent_at', startOfDay.toISOString())

  if ((sentToday ?? 0) >= NOTIFY_DAILY_CAP) {
    console.warn(`[contact:${id}] daily cap reached (${sentToday} sent today) — releasing claim, skipping sends`)
    await releaseClaim(id)
    return c.json({ ok: true, skipped: 'daily-cap' })
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

  // Both sends go through the shared sender rather than a hand-rolled fetch.
  // The three things it adds are the reason: a bounded timeout (so a hung
  // connection cannot strand the claim — before this a throw escaped past
  // `releaseClaim` and the chapter never heard about the message), the
  // Idempotency-Key, and the plain-text part below. The `text` field is
  // required by `SendEmailInput`; without it these were the only two emails in
  // the project shipped HTML-only, which costs deliverability in every client
  // that down-weights Single-Part HTML.
  const notifyHtml = buildEmail(contactName, contactEmail, claimed.message, receivedPt)
  const notifyResult = await sendResendEmail(
    { apiKey: RESEND_API_KEY, from: FROM_EMAIL },
    {
      to: recipient,
      replyTo: contactEmail,
      subject: `New message from ${contactName} — indivisiblefairoaks.org`,
      html: notifyHtml,
      text: htmlToText(notifyHtml),
      idempotencyKey: `contact-notify/${id}`,
      tags: [{ name: 'type', value: 'contact-notify' }],
    },
  )

  if (!notifyResult.ok) {
    // `error` is the shared sender's log-safe form: a transport name or a
    // capped provider body, never the API key.
    console.error(`[contact:${id}] notification send failed:`, notifyResult.error)
    await releaseClaim(id)
    return c.json({ ok: false, error: 'send-failed' }, 502)
  }

  console.log(`[contact:${id}] notification sent to ${recipient}`)

  // Sender's copy: opt-in only, recipient locked to the row's own address so
  // the feature can never relay spam to arbitrary third parties. Best-effort
  // — a failed copy never un-delivers the admin notification.
  let copied = false
  if (claimed.wants_copy) {
    // Best-effort, so a failed or timed-out copy is reported as `copied:
    // false` rather than turning a delivered notification into a 500.
    const copyHtml = buildCustomerCopy(
      contactName,
      contactEmail,
      claimed.message,
      receivedPt,
    )
    const copyResult = await sendResendEmail(
      { apiKey: RESEND_API_KEY, from: FROM_EMAIL },
      {
        to: contactEmail,
        replyTo: recipient,
        subject: 'Copy of your message to Indivisible Fair Oaks',
        html: copyHtml,
        text: htmlToText(copyHtml),
        idempotencyKey: `contact-copy/${id}`,
        tags: [{ name: 'type', value: 'contact-copy' }],
      },
    )
    copied = copyResult.ok
    if (!copyResult.ok) {
      console.error(`[contact:${id}] sender copy failed:`, copyResult.error)
    }
  }

  return c.json({ ok: true, emailed: true, copied })
})

Deno.serve((req) => app.fetch(req))
