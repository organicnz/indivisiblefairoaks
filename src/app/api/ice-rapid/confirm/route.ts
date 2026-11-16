import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/email';
import {
  verifyIceAlertManagementToken,
  type IceAlertManagementClaims,
} from '@/lib/ice-alert-management';
import {
  findSubscriberById,
  findSubscriberByToken,
  getIceAlertStore,
  updateSubscriber,
  type IceAlertStore,
  type IceAlertSubscriber,
} from '@/lib/ice-alert-store';
import { clientKey, rateLimit } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN_LENGTH = 8_192;
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow' };

const PAGE = (body: string) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,nofollow" /><title>ICE Alert surge subscription</title></head><body style="margin:0;background:#0F172A;font-family:system-ui,-apple-system,sans-serif;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:480px;text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#F87171;margin-bottom:12px;">ICE Alert / Surge watch</div>${body}</div></body></html>`;

const html = (body: string, status = 200) =>
  new NextResponse(PAGE(body), {
    status,
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

function placeFor(
  subscriber: IceAlertSubscriber,
  claims?: IceAlertManagementClaims
) {
  if (claims) return label(claims.stateCode, claims.city);
  return label(subscriber.state_code, subscriber.city);
}

type ResolveResult =
  | { kind: 'response'; response: NextResponse }
  | {
      kind: 'subscriber';
      store: IceAlertStore;
      subscriber: IceAlertSubscriber;
      claims: IceAlertManagementClaims | null;
    };

async function resolve(
  req: Request,
  token: string | null
): Promise<ResolveResult> {
  const gate = rateLimit(clientKey(req.headers, 'ice-alert-confirm'), 20, 600_000);
  if (!gate.ok) {
    return {
      kind: 'response',
      response: new NextResponse('Too many requests. Please retry shortly.', {
        status: 429,
        headers: { 'Retry-After': String(gate.retryAfterSec) },
      }),
    };
  }

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return {
      kind: 'response',
      response: new NextResponse('Invalid confirmation link.', { status: 400 }),
    };
  }

  const store = getIceAlertStore();
  if (!store) {
    return {
      kind: 'response',
      response: new NextResponse('Surge alerts are not configured yet.', {
        status: 503,
      }),
    };
  }

  const claims = await verifyIceAlertManagementToken(token);
  let subscriber: IceAlertSubscriber | null = null;

  if (claims) {
    subscriber = await findSubscriberById(store, claims.subscriberId);
  } else if (UUID_RE.test(token)) {
    subscriber = await findSubscriberByToken(store, 'confirm_token', token);
  } else {
    return {
      kind: 'response',
      response: new NextResponse('Invalid confirmation link.', { status: 400 }),
    };
  }

  if (!subscriber) {
    return {
      kind: 'response',
      response: new NextResponse('This confirmation link is no longer valid.', {
        status: 404,
      }),
    };
  }

  return { kind: 'subscriber', store, subscriber, claims };
}

/** GET only shows the form. Mail scanners must not confirm a subscription. */
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  try {
    const resolved = await resolve(req, token);
    if (resolved.kind === 'response') return resolved.response;
    const { subscriber, claims } = resolved;
    const place = escapeHtml(placeFor(subscriber, claims ?? undefined));

    if (!claims && subscriber.confirmed_at && subscriber.email_opt_in) {
      return html(
        `<h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#fff;">Already confirmed</h1>` +
          `<p style="font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 20px;">Surge alerts for ${place} are active. You can change or stop them from any alert email.</p>` +
          `<a href="/ice-alerts" style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:12px 20px;border-radius:8px;">Open the map</a>`
      );
    }

    return html(
      `<h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#fff;">${
        claims ? 'Confirm changes?' : 'Confirm surge alerts?'
      }</h1>` +
        `<p style="font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 22px;">${
          claims
            ? 'Confirm the new preferences for '
            : 'You will get a short email when community reports cluster near '
        }<strong style="color:#fff;">${place}</strong>. This is not a live dispatch feed, and locations are city-level only.</p>` +
        `<form method="post" action="/api/ice-rapid/confirm?token=${encodeURIComponent(token ?? '')}">` +
        `<input type="hidden" name="token" value="${escapeHtml(token ?? '')}" />` +
        `<input type="hidden" name="confirm" value="1" />` +
        `<button type="submit" style="font:inherit;font-size:14px;font-weight:800;color:#fff;background:#DC2626;border:0;border-radius:8px;padding:13px 24px;cursor:pointer;">${
          claims ? 'Confirm changes' : 'Confirm surge alerts'
        }</button>` +
        `</form>` +
        `<p style="font-size:12px;line-height:1.7;color:#64748B;margin:24px 0 0;">We use a confirmation step because mail security software opens links automatically. <a href="/ice-alerts" style="color:#94A3B8;">Back to the map</a>.</p>`
    );
  } catch {
    return new NextResponse('Unable to confirm the subscription right now.', {
      status: 500,
    });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const contentType = req.headers.get('content-type') || '';
  let token = searchParams.get('token');

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData().catch(() => null);
    const fromBody = form?.get('token');
    if (typeof fromBody === 'string' && fromBody) token = fromBody;
  }

  try {
    const resolved = await resolve(req, token);
    if (resolved.kind === 'response') return resolved.response;
    const { store, subscriber, claims } = resolved;

    if (claims) {
      await updateSubscriber(store, subscriber.id, {
        state_code: claims.stateCode,
        city: claims.city,
        email_opt_in: true,
        ...(claims.push
          ? {
              push_subscription: claims.push,
              push_opt_in: true,
            }
          : {}),
        confirmed_at: subscriber.confirmed_at ?? new Date().toISOString(),
        unsubscribed_at: null,
      });
    } else if (!subscriber.confirmed_at || !subscriber.email_opt_in) {
      await updateSubscriber(store, subscriber.id, {
        confirmed_at: new Date().toISOString(),
        email_opt_in: true,
        unsubscribed_at: null,
      });
    }

    const place = escapeHtml(placeFor(subscriber, claims ?? undefined));

    return html(
      `<h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re confirmed</h1>` +
        `<p style="font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 20px;">Surge alerts for <strong style="color:#fff;">${place}</strong> are active. We only send when community reports cluster, not for every update.</p>` +
        `<a href="/ice-alerts" style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:12px 20px;border-radius:8px;">Open the map</a>` +
        `<p style="font-size:12px;line-height:1.7;color:#64748B;margin:24px 0 0;">Immediate danger? Call 911. This service cannot dispatch help.</p>`
    );
  } catch {
    return new NextResponse('Unable to confirm the subscription right now.', {
      status: 500,
    });
  }
}
