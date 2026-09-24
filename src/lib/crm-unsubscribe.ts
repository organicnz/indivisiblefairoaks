import { escapeHtml, stripControls } from '@/lib/email';

const MAX_GREETING_NAME = 80;

/**
 * Builds the optional personalization prefix for the public unsubscribe page.
 *
 * `first_name` can arrive from the contact-form RPC (length-checked only —
 * markup is allowed). The unsubscribe HTML is server-rendered under a CSP
 * that still permits `unsafe-inline`, so this value MUST be control-stripped,
 * length-capped, and HTML-escaped before interpolation.
 */
export function renderUnsubscribeGreeting(firstName: string | null | undefined): string {
  if (!firstName) return '';
  const clean = stripControls(firstName).slice(0, MAX_GREETING_NAME).trim();
  if (!clean) return '';
  return `Hi ${escapeHtml(clean)}, `;
}
