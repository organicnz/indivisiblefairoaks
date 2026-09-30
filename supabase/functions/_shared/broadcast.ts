/**
 * Broadcast email template — Edge Function copy.
 *
 * The Next app owns the preview and the Edge Function owns the delivery, and an
 * author must not be able to approve one document and receive another. So both
 * render through an identical implementation:
 *
 *   src/lib/crm-broadcast.ts            (Next, preview + direct sends)
 *   supabase/functions/_shared/broadcast.ts   (this file, background delivery)
 *
 * Deno cannot import from `src/`, so the duplication is real. What makes it
 * safe is `src/lib/__tests__/crm-broadcast-parity.test.ts`, which asserts the
 * two render byte-identical output for the same input — the same contract
 * `commerce-parity.test.ts` already holds for the currency bug that shipped as
 * NZD. If this file is edited, that test fails.
 */

export const BROADCAST_EYEBROW = 'Chapter Broadcast'
export const BROADCAST_FOOTER =
  'You received this community broadcast as a registered supporter or volunteer.'
export const BROADCAST_SITE_URL = 'https://indivisiblefairoaks.org'
export const BROADCAST_ORG = 'Indivisible Fair Oaks-Carmichael Organizing Team'

/** Must match src/lib/crm-broadcast.ts. */
export const BROADCAST_RECIPIENT_CEILING = 5_000

export function escapeBroadcastHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function stripBroadcastControls(value: string): string {
  // A bare CR/LF in a subject line truncates it and can append headers, so those
  // fold to a space; the rest of C0 and DEL are dropped outright.
  //
  // Written as an explicit character walk rather than a control-character regex
  // so the intent is readable and no suppression is needed for the lint that
  // exists precisely to stop them being written by accident.
  const C0_MAX = 0x1f;
  const DEL = 0x7f;
  const SPACE = ' ';
  const TAB = 0x09;
  const LF = 0x0a;
  const CR = 0x0d;
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === CR || code === LF || code === TAB) {
      out += SPACE;
    } else if (code > C0_MAX && code !== DEL) {
      out += char;
    }
  }
  return out;
}

export function broadcastSubject(raw: string): string {
  // Header injection guard: a newline truncates the subject and can append
  // headers, so every run of whitespace collapses to a single space. Collapsing
  // rather than substituting matters because stripBroadcastControls has already
  // turned the line break into a space — replacing [\r\n] here would leave a
  // double space where a subject was wrapped.
  return stripBroadcastControls(raw).replace(/\s+/g, ' ').trim()
}

export function broadcastText({
  recipientName,
  body,
  unsubscribeUrl,
}: {
  recipientName: string
  body: string
  unsubscribeUrl: string
}): string {
  return [
    `Hello ${recipientName},`,
    '',
    body.trim(),
    '',
    '—',
    BROADCAST_ORG,
    BROADCAST_SITE_URL,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')
}

export function broadcastBodyHtml({
  recipientName,
  body,
  unsubscribeUrl,
}: {
  recipientName: string
  body: string
  unsubscribeUrl: string
}): string {
  const name = escapeBroadcastHtml(recipientName)
  const text = escapeBroadcastHtml(body.trim()).replace(/\n/g, '<br />')
  return `
    <p style="margin:0 0 16px;color:#F1F5F9;font-size:16px;">Hello ${name},</p>
    <div style="margin:0 0 20px;padding:20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.7;">
      ${text}
    </div>
    <p style="margin:24px 0 0;color:#94A3B8;font-size:13px;line-height:1.5;">
      ${BROADCAST_ORG}<br />
      <a href="${BROADCAST_SITE_URL}" style="color:#60A5FA;text-decoration:none;">indivisiblefairoaks.org</a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;">
      <a href="${unsubscribeUrl}" style="color:#60A5FA;">Unsubscribe from chapter email</a>
    </p>
  `.trim()
}

export interface BrandShellInput {
  eyebrow: string
  body: string
  footer: string
  logoUrl: string
}

function brandShellMarkup({ eyebrow, body, footer, logoUrl }: BrandShellInput): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
<a href="${BROADCAST_SITE_URL}" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${logoUrl}" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
</a>
<div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">${eyebrow}</div>
</td></tr>
<tr><td style="padding:36px 40px 28px;color:#E2E8F0;font-size:14px;line-height:1.7;">${body}</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
<p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${footer}</p>
<p style="margin:6px 0 0;color:#64748B;font-size:11px;">Indivisible Fair Oaks-Carmichael &middot; Sacramento County</p>
</td></tr>
</table></td></tr></table></body></html>`
}

export function buildBroadcastEmail({
  recipientName,
  body,
  unsubscribeUrl,
  logoUrl,
}: {
  recipientName: string
  body: string
  unsubscribeUrl: string
  logoUrl: string
}): { html: string; text: string } {
  const bodyHtml = broadcastBodyHtml({ recipientName, body, unsubscribeUrl })
  return {
    html: brandShellMarkup({
      eyebrow: BROADCAST_EYEBROW,
      body: bodyHtml,
      footer: BROADCAST_FOOTER,
      logoUrl,
    }),
    text: broadcastText({ recipientName, body, unsubscribeUrl }),
  }
}

/**
 * A single deliverable address — one address, no separators, no whitespace.
 *
 * ## Why this is a shared, tested module and not a local helper
 *
 * It was a local helper inside `crm-broadcast-send/index.ts`, with no test
 * anywhere, and it was **broken in a way that rejected every realistic
 * address**. The pattern was `[^@[:space:],]`, written for a POSIX regex. In
 * JavaScript a POSIX class inside a character class is not a class at all: it
 * is the literal run of characters `[ : s p a c e : ]`, so the negated set
 * forbade `@`, `:`, `,` — and the letters `s`, `p`, `a`, `c`, `e`.
 *
 * `a`, `c`, `e` and `s` are among the most common letters in an email address,
 * so `alice@example.com` and `test@example.com` were both rejected. The guard
 * exists to stop a self-test resolving to more than one recipient, and it
 * achieved that by refusing to resolve to any recipient at all — which is the
 * same shape of bug as the broadcast that had never been sent: a narrow
 * guard that fails closed on legitimate input is still a broken guard, and a
 * broken guard nobody can see is worse than no guard, because it reads as
 * protection.
 *
 * It is exported and tested here for the same reason the rest of this file is
 * duplicated-and-parity-checked: the delivery path is otherwise untestable from
 * the Next app, and that is precisely where the previous two broadcast bugs
 * lived. `src/lib/__tests__/crm-broadcast-parity.test.ts` imports this module
 * directly, so a regression fails the ordinary unit suite.
 *
 * Deliberately still *closed*: a value carrying a comma is rejected, never
 * split. A self-test that resolved to several recipients would be exactly the
 * widening the self-test exists to prevent, so the operator fixes the row and
 * this function does not guess.
 */
export function isDeliverableAddress(value: string): boolean {
  // `\s`, not `[:space:]`. `%s` is never a valid character in an address
  // literal, and silently matching a broader set than intended is the failure
  // this function exists to avoid.
  return /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(value)
}
