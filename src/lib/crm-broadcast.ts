/**
 * The broadcast email template.
 *
 * Pure and dependency-free so the composer can render a preview and the sender
 * can deliver a message from the *same* function. That is the point: the
 * previous "Sensory Preview" was a hand-rolled approximation that omitted the
 * logo, the greeting, the brand shell and the unsubscribe footer, and rendered
 * the body with `whitespace-pre-line` where the server substituted `<br />`. An
 * author previewing a broadcast saw an email no recipient would ever receive,
 * which is the AGENTS.md "no fake controls" failure in a new place.
 *
 * Everything interpolated here is escaped or built here. The body is plain text
 * from the composer and is escaped and line-broken — it is NOT HTML, and the
 * composer says so.
 *
 * The site URL is a parameter, not a constant. It used to be a hardcoded apex
 * (`BROADCAST_SITE_URL`) in both copies of this template, so a staging build
 * mailed links to a host that 302s to Google Sites until the cutover — the same
 * failure the direct-email text body had before it derived the origin from env.
 * Every caller passes the sending origin: the Next app passes
 * `NEXT_PUBLIC_SITE_URL`, the sender passes `APP_URL`. Both already derive the
 * unsubscribe URL from that origin; the brand link follows it for the same
 * reason.
 */

export const BROADCAST_EYEBROW = 'Chapter Broadcast';
export const BROADCAST_FOOTER =
  'You received this community broadcast as a registered supporter or volunteer.';
export const BROADCAST_ORG = 'Indivisible Fair Oaks-Carmichael Organizing Team';

/**
 * Hard ceiling on one broadcast. The send runs on a background function, but a
 * runaway audience is still a quota event, and a chapter list this size would be
 * a list that was imported twice. Above this the composer asks the admin to
 * narrow the audience rather than silently truncating.
 */
export const BROADCAST_RECIPIENT_CEILING = 5_000;

export function escapeBroadcastHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip control characters that would corrupt a header or a log line. */
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
  return stripBroadcastControls(raw).replace(/\s+/g, ' ').trim();
}

export function broadcastText({
  recipientName,
  body,
  unsubscribeUrl,
  siteUrl,
}: {
  recipientName: string;
  body: string;
  unsubscribeUrl: string;
  siteUrl: string;
}): string {
  return [
    `Hello ${recipientName},`,
    '',
    body.trim(),
    '',
    '—',
    BROADCAST_ORG,
    siteUrl,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
}

/**
 * The message body, without the surrounding brand shell. Kept separate so a
 * preview and the delivered message cannot diverge on the part that varies.
 */
export function broadcastBodyHtml({
  recipientName,
  body,
  unsubscribeUrl,
  siteUrl,
}: {
  recipientName: string;
  body: string;
  unsubscribeUrl: string;
  siteUrl: string;
}): string {
  const name = escapeBroadcastHtml(recipientName);
  const text = escapeBroadcastHtml(body.trim()).replace(/\n/g, '<br />');
  const siteHost = siteUrl.replace(/^https?:\/\//, '');
  return `
    <p style="margin:0 0 16px;color:#F1F5F9;font-size:16px;">Hello ${name},</p>
    <div style="margin:0 0 20px;padding:20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.7;">
      ${text}
    </div>
    <p style="margin:24px 0 0;color:#94A3B8;font-size:13px;line-height:1.5;">
      ${BROADCAST_ORG}<br />
      <a href="${siteUrl}" style="color:#60A5FA;text-decoration:none;">${siteHost}</a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;">
      <a href="${unsubscribeUrl}" style="color:#60A5FA;">Unsubscribe from chapter email</a>
    </p>
  `.trim();
}

/** Shape the shell wraps. Mirrors `brandShell` in src/lib/email.ts. */
export interface BrandShellInput {
  eyebrow: string;
  body: string;
  footer: string;
  logoUrl: string;
  siteUrl: string;
}

/**
 * The brand shell, reproduced here so this module has no import graph. The
 * rendered output is asserted byte-identical to `brandShell()` in
 * `crm-broadcast-parity.test.ts` — that test is what makes the duplication
 * safe, the same contract `commerce-parity.test.ts` holds for currency.
 */
export function brandShellMarkup({
  eyebrow,
  body,
  footer,
  logoUrl,
  siteUrl,
}: BrandShellInput): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
<a href="${siteUrl}" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${logoUrl}" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
</a>
<div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">${eyebrow}</div>
</td></tr>
<tr><td style="padding:36px 40px 28px;color:#E2E8F0;font-size:14px;line-height:1.7;">${body}</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
<p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${footer}</p>
<p style="margin:6px 0 0;color:#64748B;font-size:11px;">Indivisible Fair Oaks-Carmichael &middot; Sacramento County</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function buildBroadcastEmail({
  recipientName,
  body,
  unsubscribeUrl,
  logoUrl,
  siteUrl,
}: {
  recipientName: string;
  body: string;
  unsubscribeUrl: string;
  logoUrl: string;
  siteUrl: string;
}): { html: string; text: string } {
  const bodyHtml = broadcastBodyHtml({ recipientName, body, unsubscribeUrl, siteUrl });
  return {
    html: brandShellMarkup({
      eyebrow: BROADCAST_EYEBROW,
      body: bodyHtml,
      footer: BROADCAST_FOOTER,
      logoUrl,
      siteUrl,
    }),
    text: broadcastText({ recipientName, body, unsubscribeUrl, siteUrl }),
  };
}
