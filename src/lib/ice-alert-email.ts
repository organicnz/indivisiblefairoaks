import { isE2EMode } from '@/lib/e2e-mode';
import {
  brandShell,
  escapeHtml,
  safeSubject,
  sendEmail,
  type SendEmailResult,
} from '@/lib/email';
import { env } from '@/lib/env';
import type { RapidSurge } from '@/lib/ice-rapid-surges';

type IceAlertEmailBase = {
  email: string;
  token: string;
  stateCode?: string | null;
  city?: string | null;
  siteUrl?: string;
};

function appUrl() {
  return (env.NEXT_PUBLIC_SITE_URL || 'https://indivisiblefairoaks.org').replace(
    /\/+$/,
    ''
  );
}

function locationLabel(input: Pick<IceAlertEmailBase, 'stateCode' | 'city'>) {
  if (input.city && input.stateCode) return `${input.city}, ${input.stateCode}`;
  if (input.stateCode) return input.stateCode;
  return 'nationwide';
}

function unsubUrl(token: string, siteUrl: string) {
  return `${siteUrl}/api/ice-rapid/unsubscribe?token=${encodeURIComponent(token)}`;
}

function confirmUrl(token: string, siteUrl: string) {
  return `${siteUrl}/api/ice-rapid/confirm?token=${encodeURIComponent(token)}`;
}

function unsubscribeFooterHtml(token: string, siteUrl: string) {
  return `<p style="margin:18px 0 0;color:#64748B;font-size:11px;line-height:1.6;">You asked for city-level ICE surge alerts for this area. This service does not track your location, publish identities, or replace 911. <a href="${escapeHtml(unsubUrl(token, siteUrl))}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe</a>.</p>`;
}

function emailHeaders(token: string, siteUrl: string) {
  const url = unsubUrl(token, siteUrl);
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * A new send path must never mail a real person from an e2e build. The route
 * calls this wrapper rather than `sendEmail` directly so the guard travels
 * with the code, not with the harness.
 */
async function sendIceAlertEmail(
  input: Parameters<typeof sendEmail>[0]
): Promise<SendEmailResult> {
  if (isE2EMode()) {
    return { ok: false, error: 'test-build', status: 0 };
  }
  return sendEmail(input);
}

export function buildIceAlertConfirmationEmail(input: IceAlertEmailBase) {
  const siteUrl = input.siteUrl ?? appUrl();
  const url = confirmUrl(input.token, siteUrl);
  const place = locationLabel(input);
  const body = `
    <p style="margin:0 0 14px;color:#F8FAFC;font-size:18px;font-weight:800;line-height:1.35;">Confirm your surge alerts</p>
    <p style="margin:0 0 14px;color:#CBD5E1;">You asked for rapid-response alerts for <strong style="color:#FFFFFF;">${escapeHtml(place)}</strong>. Confirm your email and you will get a short alert when community reports cluster in your area.</p>
    <p style="margin:0 0 22px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.04em;padding:13px 22px;border-radius:8px;">Confirm surge alerts</a></p>
    <p style="margin:0 0 10px;color:#94A3B8;font-size:12px;line-height:1.65;">Alerts are based on the public community export, which updates nightly. They are not a live dispatch feed and cannot verify an individual report. Locations are city-level only.</p>
    <p style="margin:0;color:#64748B;font-size:11px;line-height:1.6;">If you did not request this, ignore this email. No alerts will be sent unless you confirm.</p>
    ${unsubscribeFooterHtml(input.token, siteUrl)}
  `;

  return {
    to: input.email,
    subject: safeSubject(`Confirm ICE surge alerts for ${place}`),
    html: brandShell({
      eyebrow: 'ICE Alert / Confirm subscription',
      body,
      footer: 'City-level surge alerts',
      siteUrl,
    }),
    text: [
      `Confirm your ICE surge alerts for ${place}.`,
      '',
      `Confirm: ${url}`,
      '',
      'Alerts are based on a public community export that updates nightly, not a live dispatch feed.',
      'Locations are city-level only. This is not an emergency service. Call 911 in immediate danger.',
      '',
      `Unsubscribe: ${unsubUrl(input.token, siteUrl)}`,
    ].join('\n'),
    headers: emailHeaders(input.token, siteUrl),
    tags: [{ name: 'type', value: 'ice-surge-confirmation' }],
  };
}

export function buildIceAlertSurgeEmail(
  input: IceAlertEmailBase & { surges: RapidSurge[] }
) {
  const siteUrl = input.siteUrl ?? appUrl();
  const place = locationLabel(input);
  const primary = input.surges[0];
  const subject =
    input.surges.length === 1
      ? `ICE surge watch: ${primary.shortLabel}`
      : `ICE surge watch: ${input.surges.length} areas`;

  const items = input.surges
    .map(
      (surge) =>
        `<li style="margin:0 0 12px;padding:12px 14px;background:#0F172A;border-left:3px solid #DC2626;border-radius:8px;color:#E2E8F0;line-height:1.55;"><strong style="color:#FFFFFF;">${escapeHtml(surge.shortLabel)}</strong><br />${escapeHtml(surge.label)}</li>`
    )
    .join('');

  const body = `
    <p style="margin:0 0 6px;color:#F87171;font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;">Community surge watch</p>
    <p style="margin:0 0 18px;color:#F8FAFC;font-size:20px;font-weight:800;line-height:1.3;">A cluster of reports was published near ${escapeHtml(place)}.</p>
    <ul style="margin:0 0 18px;padding:0;list-style:none;">${items}</ul>
    <p style="margin:0 0 20px;"><a href="${escapeHtml(`${siteUrl}/ice-alerts`)}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.04em;padding:13px 22px;border-radius:8px;">Open the live map</a></p>
    <p style="margin:0 0 10px;color:#94A3B8;font-size:12px;line-height:1.65;">These are community report counts, not confirmed enforcement. The export is nightly and a sighting can be delayed, mistaken, or no longer active. Never approach or obstruct enforcement activity.</p>
    <p style="margin:0;color:#FCA5A5;font-size:12px;font-weight:700;line-height:1.6;">Immediate danger? Call 911.</p>
    ${unsubscribeFooterHtml(input.token, siteUrl)}
  `;

  return {
    to: input.email,
    subject: safeSubject(subject),
    html: brandShell({
      eyebrow: 'ICE Alert / Surge watch',
      body,
      footer: 'Community reports, city-level only',
      siteUrl,
    }),
    text: [
      `ICE surge watch near ${place}.`,
      '',
      ...input.surges.map((surge) => `- ${surge.shortLabel}: ${surge.label}`),
      '',
      `Open the map: ${siteUrl}/ice-alerts`,
      'Community report counts, not confirmed enforcement. The export is nightly.',
      'Never approach or obstruct enforcement activity. Immediate danger? Call 911.',
      '',
      `Unsubscribe: ${unsubUrl(input.token, siteUrl)}`,
    ].join('\n'),
    headers: emailHeaders(input.token, siteUrl),
    tags: [{ name: 'type', value: 'ice-surge-alert' }],
  };
}

export async function sendIceAlertConfirmation(input: IceAlertEmailBase) {
  return sendIceAlertEmail(buildIceAlertConfirmationEmail(input));
}

export async function sendIceAlertSurge(
  input: IceAlertEmailBase & { surges: RapidSurge[] }
) {
  return sendIceAlertEmail(buildIceAlertSurgeEmail(input));
}
