import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isE2EMode } from '@/lib/e2e-mode';
import { createIceAlertConfirmationToken } from '@/lib/ice-alert-confirmation';
import { sendIceAlertConfirmation } from '@/lib/ice-alert-email';
import { createIceAlertManagementToken } from '@/lib/ice-alert-management';
import { verifyIceAlertProof } from '@/lib/ice-alert-proof';
import {
  hashIceAlertRateLimitKey,
  iceAlertEndpointHost,
  ICE_ALERT_RATE_LIMITS,
  ICE_ALERT_RATE_LIMIT_WINDOW_SECONDS,
} from '@/lib/ice-alert-rate-limit';
import {
  consumeIceAlertRateLimits,
  findSubscriberByEmail,
  getIceAlertStore,
  insertSubscriber,
  normalizeAlertEmail,
  updateSubscriber,
} from '@/lib/ice-alert-store';
import { clientIp } from '@/lib/rate-limit';
import { US_STATE_CODES } from '@/lib/rapid-city-match';
import { validatePushEndpoint } from '@/lib/push-endpoint';
import { readJsonBodyWithLimit } from '@/lib/request-body';

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

const proofSchema = z.object({
  token: z.string().min(1).max(4_096),
  nonce: z.string().regex(/^\d{1,10}$/),
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
  /** Signed proof-of-work from /api/ice-rapid/challenge. */
  proof: proofSchema.optional(),
  /** Honeypot. Real browsers leave this empty. */
  company: z.string().max(200).optional(),
});

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  const body = await readJsonBodyWithLimit(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.code === 'too-large'
      ? json({ ok: false, code: 'too-large' }, 413)
      : json({ ok: false, code: 'invalid-json' }, 400);
  }

  const parsed = bodySchema.safeParse(body.value);
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

  const { email, city, pushSubscription, proof } = parsed.data;
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

  const normalizedEmail = normalizeAlertEmail(email);
  const endpointHost = pushSubscription
    ? iceAlertEndpointHost(pushSubscription.endpoint)
    : null;
  const store = getIceAlertStore();

  if (!store || (pushSubscription && !endpointHost)) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Surge alerts are not configured on this deployment yet.',
      },
      503
    );
  }

  const ipHash = await hashIceAlertRateLimitKey('ip', clientIp(req.headers));
  const emailHash = await hashIceAlertRateLimitKey('email', normalizedEmail);
  const endpointHash = endpointHost
    ? await hashIceAlertRateLimitKey('endpoint', endpointHost)
    : null;
  if (!ipHash || !emailHash || (endpointHost && !endpointHash)) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Surge alerts are not configured on this deployment yet.',
      },
      503
    );
  }

  if (!proof) {
    return json(
      {
        ok: false,
        code: 'proof-required',
        message: 'Complete the browser check and try again.',
      },
      400
    );
  }

  if (!(await verifyIceAlertProof(proof, ipHash))) {
    return json(
      {
        ok: false,
        code: 'proof-invalid',
        message: 'The browser check expired. Refresh and try again.',
      },
      400
    );
  }

  const gate = await consumeIceAlertRateLimits(store, {
    ipHash,
    emailHash,
    endpointHash,
    windowSeconds: ICE_ALERT_RATE_LIMIT_WINDOW_SECONDS,
    ipLimit: ICE_ALERT_RATE_LIMITS.ip,
    emailLimit: ICE_ALERT_RATE_LIMITS.email,
    endpointLimit: ICE_ALERT_RATE_LIMITS.endpoint,
    globalLimit: ICE_ALERT_RATE_LIMITS.global,
  }).catch(() => null);
  if (!gate) {
    return json(
      {
        ok: false,
        code: 'server-error',
        message: 'Surge alerts are temporarily unavailable. Try again shortly.',
      },
      500
    );
  }
  if (!gate.allowed) {
    const response = json(
      {
        ok: false,
        code: 'rate-limited',
        message: `Too many requests. Try again in ${gate.retryAfterSec}s.`,
      },
      429
    );
    response.headers.set('Retry-After', String(gate.retryAfterSec));
    return response;
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

  try {
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
       * No preference changes until that token is confirmed; the only write
       * before the email is the capability-token rotation below.
       */
      // An omitted area means "leave the existing area alone", not
      // "silently move this subscriber to nationwide".
      const managementStateCode = stateCode ?? existing.state_code;
      const managementCity = stateCode
        ? city || null
        : city || existing.city;
      const confirmation = createIceAlertConfirmationToken();
      const managementToken = await createIceAlertManagementToken({
        subscriberId: existing.id,
        confirmToken: confirmation.token,
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

      /*
       * Rotate before sending. The signed link carries this token, and the
       * confirmation route refuses it unless the row still names it, so an
       * older link stops working the moment a newer email is requested.
       */
      await updateSubscriber(store, existing.id, {
        confirm_token: confirmation.token,
        confirm_token_expires_at: confirmation.expiresAt,
      });

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

      await updateSubscriber(store, existing.id, {
        confirmation_sent_at: new Date().toISOString(),
      });

      return json(ACCEPTED);
    }

    const confirmation = createIceAlertConfirmationToken();
    const subscriber = await insertSubscriber(store, {
      email: normalizedEmail,
      state_code: stateCode,
      city: city || null,
      email_opt_in: true,
      push_opt_in: Boolean(pushSubscription),
      push_subscription: pushSubscription ?? null,
      confirm_token: confirmation.token,
      confirm_token_expires_at: confirmation.expiresAt,
      unsubscribe_token: crypto.randomUUID(),
      confirmed_at: null,
      confirmation_sent_at: null,
    });

    const sent = await sendIceAlertConfirmation({
      email: normalizedEmail,
      token: confirmation.token,
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
