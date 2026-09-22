// ---------------------------------------------------------------------------
// Shared Resend email helper for edge functions.
//
// Single source of truth for transactional email delivery. Both
// `notify-contact` and `webhook` (order notifications) send through here so
// FROM defaults, timeouts, escaping, and error shapes stay consistent.
//
// Design notes:
// - Raw `fetch` to api.resend.com (no npm:resend dep) — zero cold-start cost,
//   no version skew between functions.
// - `supabase functions deploy` bundles the importing function's folder plus
//   `_shared`, so `import ... from '../_shared/email.ts'` works remotely.
// - Never throws on send failure — returns a discriminated result so callers
//   decide retry vs. ack (Stripe webhooks must 500 to retry; contact claims
//   must release instead).
// ---------------------------------------------------------------------------

export const RESEND_API_URL = 'https://api.resend.com/emails'

const DEFAULT_FROM = 'orders@indivisiblefairoaks.org'
const DEFAULT_ADMIN = 'indivisible@indivisiblefairoaks.org'

// Resend caps subjects around 998 chars per RFC; keep well under with room
// for prefixes like "New message from …".
const MAX_SUBJECT_LEN = 200
// Edge runtime default fetch has no timeout — a hung Resend call would burn
// Fluid CPU until the gateway kills it. 10s matches the Next.js caller.
const SEND_TIMEOUT_MS = 10_000

export interface EmailConfig {
  apiKey: string
  from: string
  adminEmail: string
}

/** Reads Resend config from the edge runtime env. Returns nulls, never throws. */
export function getEmailConfig(): EmailConfig {
  return {
    apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
    from: Deno.env.get('RESEND_FROM_EMAIL') ?? DEFAULT_FROM,
    adminEmail: Deno.env.get('ADMIN_ORDER_EMAIL') ?? DEFAULT_ADMIN,
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Strips control/format chars (incl. CR/LF) that could smuggle SMTP headers
 * when user data is echoed into subjects or addresses. */
export function stripControls(value: string): string {
  return value.replace(/\p{C}/gu, '')
}

/** Truncates + sanitizes untrusted input destined for an email subject line. */
export function safeSubject(value: string): string {
  return stripControls(value).slice(0, MAX_SUBJECT_LEN)
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  /** Plain-text fallback — improves deliverability + spam scores. Required. */
  text: string
  replyTo?: string
  /** Resend tags for dashboard filtering, e.g. [{name:'type',value:'contact'}] */
  tags?: { name: string; value: string }[]
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number }

/**
 * Sends one email via Resend. Never throws — network/timeout/rejection all
 * collapse into `{ ok: false }` with a log-safe error string (no key leak).
 */
export async function sendResendEmail(
  config: Pick<EmailConfig, 'apiKey' | 'from'>,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!config.apiKey) {
    return { ok: false, error: 'missing-api-key', status: 0 }
  }

  const to = Array.isArray(input.to) ? input.to : [input.to]
  if (to.length === 0 || to.some((a) => !a.includes('@'))) {
    return { ok: false, error: 'invalid-recipient', status: 0 }
  }

  let res: Response
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to,
        ...(input.replyTo ? { reply_to: stripControls(input.replyTo) } : {}),
        subject: safeSubject(input.subject),
        html: input.html,
        text: input.text,
        ...(input.tags ? { tags: input.tags } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
  } catch (err) {
    const reason = err instanceof Error ? err.name : 'network-error'
    return { ok: false, error: `transport:${reason}`, status: 0 }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Cap logged body — Resend errors are short; never echo the API key.
    return { ok: false, error: body.slice(0, 500), status: res.status }
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string }
  return { ok: true, id: data.id ?? '' }
}

// ---------------------------------------------------------------------------
// Branded shell — "Sensory Luxury" dark card shared by all transactional mail.
// Keep inline styles (email clients strip <style>). Lime accents are
// non-text decoration only; body copy stays high-contrast slate/white.
// ---------------------------------------------------------------------------

export function brandShell(opts: {
  eyebrow: string
  body: string
  footer: string
}): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(209,255,0,0.2);">
<tr><td style="padding:28px 40px;border-bottom:1px solid rgba(209,255,0,0.15);">
<span style="color:#D1FF00;font-weight:900;font-size:18px;letter-spacing:0.2em;text-transform:uppercase;">Indivisible Fair Oaks</span>
<span style="color:rgba(255,255,255,0.4);font-weight:700;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-left:12px;">${opts.eyebrow}</span></td></tr>
<tr><td style="padding:32px 40px;color:#E2E8F0;font-size:14px;line-height:1.7;">${opts.body}</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid rgba(209,255,0,0.2);text-align:center;">
<p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">${opts.footer}</p></td></tr>
</table></td></tr></table></body></html>`
}

/** Strips tags for the text part — deterministic, no DOM needed in Deno. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
