import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/email';
import {
  findSubscriberByToken,
  getIceAlertStore,
  updateSubscriber,
} from '@/lib/ice-alert-store';
import { clientKey, rateLimit } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow' };

const PAGE = (body: string) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,nofollow" /><title>ICE Alert surge subscription</title></head><body style="margin:0;background:#0F172A;font-family:system-ui,-apple-system,sans-serif;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:480px;text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#F87171;margin-bottom:12px;">ICE Alert / Surge watch</div>${body}</div></body></html>`;

const html = (body: string) =>
  new NextResponse(PAGE(body), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...NO_INDEX,
    },
  });

function label(stateCode: string | null, city: string | null) {
  if (city && stateCode) return `${city}, ${stateCode}`;
  return stateCode ?? 'nationwide';
}

async function resolve(req: Request, token: string | null) {
  const gate = rateLimit(clientKey(req.headers, 'ice-alert-unsubscribe'), 20, 600_000);
  if (!gate.ok) {
    return {
      response: new NextResponse('Too many requests. Please retry shortly.', {
        status: 429,
        headers: { 'Retry-After': String(gate.retryAfterSec) },
      }),
    };
  }

  if (!token || !UUID_RE.test(token)) {
    return { response: new NextResponse('Invalid unsubscribe link.', { status: 400 }) };
  }

  const store = getIceAlertStore();
  if (!store) {
    return {
      response: new NextResponse('Surge alerts are not configured yet.', { status: 503 }),
    };
  }

  const subscriber = await findSubscriberByToken(store, 'unsubscribe_token', token);
  if (!subscriber) {
    return {
      response: new NextResponse('This unsubscribe link is no longer valid.', {
        status: 404,
      }),
    };
  }

  return { store, subscriber };
}

/** GET only renders the confirmation form; a scanner cannot unsubscribe someone. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  try {
    const resolved = await resolve(req, token);
    if ('response' in resolved) return resolved.response;
    const { subscriber } = resolved;
    const place = escapeHtml(label(subscriber.state_code, subscriber.city));

    return html(
      `<h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#fff;">Stop surge alerts?</h1>` +
        `<p style="font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 22px;">Confirm and you will no longer receive emails or phone notifications about community report clusters for <strong style="color:#fff;">${place}</strong>.</p>` +
        `<form method="post" action="/api/ice-rapid/unsubscribe?token=${encodeURIComponent(token ?? '')}">` +
        `<input type="hidden" name="token" value="${escapeHtml(token ?? '')}" />` +
        `<input type="hidden" name="confirm" value="1" />` +
        `<button type="submit" style="font:inherit;font-size:14px;font-weight:800;color:#fff;background:#DC2626;border:0;border-radius:8px;padding:13px 24px;cursor:pointer;">Unsubscribe me</button>` +
        `</form>` +
        `<p style="font-size:12px;line-height:1.7;color:#64748B;margin:24px 0 0;">We ask for confirmation because some mail security software opens every link in an email automatically.</p>`
    );
  } catch {
    return new NextResponse('Unable to process unsubscribe right now.', { status: 500 });
  }
}

/** The only method that writes. RFC 8058 posts here with an empty body. */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentType = req.headers.get('content-type') || '';
  let token = searchParams.get('token');
  let fromBrowserForm = false;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData().catch(() => null);
    const fromBody = form?.get('token');
    if (typeof fromBody === 'string' && fromBody) token = fromBody;
    if (form?.get('confirm') === '1') fromBrowserForm = true;
  }

  try {
    const resolved = await resolve(req, token);
    if ('response' in resolved) return resolved.response;
    const { store, subscriber } = resolved;

    await updateSubscriber(store, subscriber.id, {
      email_opt_in: false,
      push_opt_in: false,
      push_subscription: null,
      confirmed_at: null,
      unsubscribed_at: new Date().toISOString(),
    });

    if (!fromBrowserForm) {
      return new NextResponse(null, { status: 204, headers: NO_INDEX });
    }

    return html(
      `<h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re unsubscribed</h1>` +
        `<p style="font-size:14px;line-height:1.7;color:#94A3B8;margin:0;">Surge alerts for ${escapeHtml(label(subscriber.state_code, subscriber.city))} are stopped. You can resubscribe from the map at any time.</p>` +
        `<a href="/ice-alerts" style="display:inline-block;margin-top:20px;background:#DC2626;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:12px 20px;border-radius:8px;">Open the map</a>`
    );
  } catch {
    return new NextResponse('Unable to process unsubscribe right now.', { status: 500 });
  }
}
