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

const DEFAULT_FROM = 'contact@indivisiblefairoaks.org'
const DEFAULT_ADMIN = 'contact@indivisiblefairoaks.org'

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

const LOGO_URL =
  'https://mojsubkqjdruhpxbzgme.supabase.co/storage/v1/object/public/media/wp-content/uploads/2021/10/logo.png'

export function brandShell(opts: {
  eyebrow: string
  body: string
  footer: string
}): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
<a href="https://indivisiblefairoaks.org" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${LOGO_URL}" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
</a>
<div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">${opts.eyebrow}</div>
</td></tr>
<tr><td style="padding:36px 40px 28px;color:#E2E8F0;font-size:14px;line-height:1.7;">${opts.body}</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
<p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${opts.footer}</p>
<p style="margin:6px 0 0;color:#64748B;font-size:11px;">Indivisible Fair Oaks-Carmichael &middot; Sacramento County</p>
</td></tr>
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
