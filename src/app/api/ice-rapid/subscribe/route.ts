import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isE2EMode } from '@/lib/e2e-mode';
import { sendIceAlertConfirmation } from '@/lib/ice-alert-email';
import { createIceAlertManagementToken } from '@/lib/ice-alert-management';
import {
  findSubscriberByEmail,
  getIceAlertStore,
  insertSubscriber,
  normalizeAlertEmail,
  updateSubscriber,
} from '@/lib/ice-alert-store';
import { US_STATE_CODES } from '@/lib/rapid-city-match';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { validatePushEndpoint } from '@/lib/push-endpoint';

const MAX_BODY_BYTES = 12_000;
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1_000;

/**
 * Every successful request receives this exact body, whether the address is
 * new, pending, confirmed, unsubscribed, or recently emailed. The route must
 * not become an address-book oracle.
 */
const ACCEPTED = {
  ok: true,
  status: 'pending',
  message: 'Check your inbox to confirm your surge-alert preferences.',
};

const EMAIL_NOT_CONFIGURED = {
  ok: false,
  code: 'email-not-configured',
  message: 'Email delivery is not configured on this deployment yet.',
};

const EMAIL_FAILED = {
  ok: false,
  code: 'email-failed',
  message: 'We could not send the confirmation email. Try again in a few minutes.',
};

const pushSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2_048)
    .refine((value) => value.startsWith('https://'), 'Push endpoint must use HTTPS.'),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(500),
  }),
});

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  stateCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: z.string().trim().max(80).optional(),
  pushSubscription: pushSchema.nullish(),
  /** Honeypot. Real browsers leave this empty. */
  company: z.string().max(200).optional(),
});

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  const gate = rateLimit(clientKey(req.headers, 'ice-alert-subscribe'), 5, 600_000);
  if (!gate.ok) {
    return json(
      {
        ok: false,
        code: 'rate-limited',
        message: `Too many requests. Try again in ${gate.retryAfterSec}s.`,
      },
      429
    );
  }

  const length = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return json({ ok: false, code: 'too-large' }, 413);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, code: 'invalid-json' }, 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        code: 'invalid',
        message: 'Enter a valid email and, if you choose an area, a U.S. state.',
      },
      400
    );
  }

  if (parsed.data.company) {
    return json({ ok: true, status: 'ignored' });
  }

  const { email, city, pushSubscription } = parsed.data;
  const stateCode = parsed.data.stateCode ?? null;
  if (stateCode && !US_STATE_CODES.has(stateCode)) {
    return json({ ok: false, code: 'invalid-state' }, 400);
  }
  if (city && !stateCode) {
    return json(
      {
        ok: false,
        code: 'state-required',
        message: 'Choose a state so the city filter has a location.',
      },
      400
    );
  }

  if (isE2EMode()) {
    return json({
      ok: true,
      status: 'test-build',
      message: 'Test build: no email or push was sent.',
    });
  }

  if (pushSubscription) {
    try {
      await validatePushEndpoint(pushSubscription.endpoint);
    } catch {
      return json(
        {
          ok: false,
          code: 'invalid-push-endpoint',
          message:
            'Phone alerts are not available for this browser. Email alerts still work.',
        },
        400
      );
    }
  }

  const store = getIceAlertStore();
  if (!store) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Surge alerts are not configured on this deployment yet.',
      },
      503
    );
  }

  try {
    const normalizedEmail = normalizeAlertEmail(email);
    const existing = await findSubscriberByEmail(store, normalizedEmail);

    if (existing) {
      const recentConfirmation =
        existing.confirmation_sent_at &&
        Date.now() - Date.parse(existing.confirmation_sent_at) <
          CONFIRMATION_COOLDOWN_MS;
      if (recentConfirmation) return json(ACCEPTED);

      /*
       * An email address is not proof of control. Snapshot the requested
       * preferences into a signed token and mail it to the address on file.
       * Nothing on this row changes until that token is confirmed.
       */
      // An omitted area means "leave the existing area alone", not
      // "silently move this subscriber to nationwide".
      const managementStateCode = stateCode ?? existing.state_code;
      const managementCity = stateCode
        ? city || null
        : city || existing.city;
      const managementToken = await createIceAlertManagementToken({
        subscriberId: existing.id,
        stateCode: managementStateCode,
        city: managementCity,
        pushSubscription: pushSubscription ?? null,
      });
      if (!managementToken) {
        return json(
          {
            ok: false,
            code: 'not-configured',
            message: 'Surge alerts are not configured on this deployment yet.',
          },
          503
        );
      }

      const sent = await sendIceAlertConfirmation({
        email: existing.email,
        token: managementToken,
        unsubscribeToken: existing.unsubscribe_token,
        intent: 'manage',
        stateCode: managementStateCode,
        city: managementCity,
      });

      if (!sent.ok) {
        return json(
          sent.error === 'missing-resend-api-key'
            ? EMAIL_NOT_CONFIGURED
            : EMAIL_FAILED,
          502
        );
      }

      return json(ACCEPTED);
    }

    const confirmToken = crypto.randomUUID();
    const subscriber = await insertSubscriber(store, {
      email: normalizedEmail,
      state_code: stateCode,
      city: city || null,
      email_opt_in: true,
      push_opt_in: Boolean(pushSubscription),
      push_subscription: pushSubscription ?? null,
      confirm_token: confirmToken,
      unsubscribe_token: crypto.randomUUID(),
      confirmed_at: null,
      confirmation_sent_at: null,
    });

    const sent = await sendIceAlertConfirmation({
      email: normalizedEmail,
      token: confirmToken,
      unsubscribeToken: subscriber.unsubscribe_token,
      stateCode: subscriber.state_code,
      city: subscriber.city,
    });

    if (!sent.ok) {
      return json(
        sent.error === 'missing-resend-api-key'
          ? EMAIL_NOT_CONFIGURED
          : EMAIL_FAILED,
        502
      );
    }

    await updateSubscriber(store, subscriber.id, {
      confirmation_sent_at: new Date().toISOString(),
    });

    return json(ACCEPTED);
  } catch {
    return json(
      {
        ok: false,
        code: 'server-error',
        message: 'Surge alerts are temporarily unavailable. Try again shortly.',
      },
      500
    );
  }
}
