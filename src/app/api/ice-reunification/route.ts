import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isE2EMode } from '@/lib/e2e-mode';
import {
  detectReunificationImage,
  getReunificationStore,
  insertReunificationRequest,
  makeReferenceCode,
  removeReunificationPhoto,
  uploadReunificationPhoto,
  REUNIFICATION_PHOTO_MAX_BYTES,
} from '@/lib/ice-reunification';
import {
  sendReunificationAdminNotice,
  sendReunificationConfirmation,
} from '@/lib/ice-reunification-email';
import { env } from '@/lib/env';
import { US_STATE_CODES } from '@/lib/rapid-city-match';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { readFormDataWithLimit } from '@/lib/request-body';

export const maxDuration = 30;

const MAX_BODY_BYTES = 4_500_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

/** Reject rollover dates such as 2026-02-31 instead of letting Postgres 500. */
function isCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalDate = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
    .refine(isCalendarDate, 'Invalid date.')
    .optional()
);

const formSchema = z.object({
  submitter_name: z.string().trim().min(2).max(120),
  submitter_email: z.string().trim().email().max(320),
  submitter_phone: optionalText(40),
  relationship: z.string().trim().min(2).max(80),
  person_name: z.string().trim().min(2).max(120),
  person_aliases: optionalText(200),
  person_dob: optionalDate,
  detention_date: optionalDate,
  detention_city: optionalText(80),
  detention_state: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined),
    z
      .string()
      .regex(/^[A-Z]{2}$/)
      .refine((value) => US_STATE_CODES.has(value), 'Use a U.S. state code.')
      .optional()
  ),
  facility: optionalText(160),
  a_number: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined),
    z
      .string()
      .regex(/^[A]?\d{6,10}$/)
      .optional()
  ),
  notes: optionalText(4000),
  consent_contact: z.literal('on'),
  consent_privacy: z.literal('on'),
  website: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const gate = rateLimit(clientKey(req.headers, 'ice-reunification'), 3, 600_000);
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

  const body = await readFormDataWithLimit(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.code === 'too-large'
      ? json(
          {
            ok: false,
            code: 'too-large',
            message: 'The request is too large. Use a photo under 4 MB.',
          },
          413
        )
      : json(
          { ok: false, code: 'invalid-form', message: 'Send the request as a form.' },
          400
        );
  }
  const form = body.value;

  const parsed = formSchema.safeParse({
    submitter_name: field(form, 'submitter_name'),
    submitter_email: field(form, 'submitter_email'),
    submitter_phone: field(form, 'submitter_phone'),
    relationship: field(form, 'relationship'),
    person_name: field(form, 'person_name'),
    person_aliases: field(form, 'person_aliases'),
    person_dob: field(form, 'person_dob'),
    detention_date: field(form, 'detention_date'),
    detention_city: field(form, 'detention_city'),
    detention_state: field(form, 'detention_state'),
    facility: field(form, 'facility'),
    a_number: field(form, 'a_number'),
    notes: field(form, 'notes'),
    consent_contact: field(form, 'consent_contact'),
    consent_privacy: field(form, 'consent_privacy'),
    website: field(form, 'website'),
  });

  if (!parsed.success) {
    return json(
      {
        ok: false,
        code: 'invalid',
        message:
          'Check the required fields, consent boxes, email address, dates, and state. Do not include immigration status.',
      },
      400
    );
  }

  if (parsed.data.website) {
    return json({ ok: true, status: 'ignored' });
  }

  const data = parsed.data;
  if (!data.facility && (!data.detention_city || !data.detention_state)) {
    return json(
      {
        ok: false,
        code: 'location-required',
        message: 'Add the detention city and state, or the facility name if you know it.',
      },
      400
    );
  }

  if (isE2EMode()) {
    return json({
      ok: true,
      status: 'test-build',
      referenceCode: 'R-TEST000',
      statusUrl: '/ice-alerts/reunification/status?token=test-build',
      emailDelivered: false,
      message: 'Test build: no request was stored and no email was sent.',
    });
  }

  const store = getReunificationStore();
  if (!store) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message:
          'Private requests are not configured on this deployment yet. Use the official locator or call the chapter.',
      },
      503
    );
  }

  const requestId = crypto.randomUUID();
  const accessToken = crypto.randomUUID();
  const referenceCode = makeReferenceCode();
  let photoPath: string | null = null;

  try {
    const photo = form.get('photo');
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > REUNIFICATION_PHOTO_MAX_BYTES) {
        return json(
          { ok: false, code: 'photo-too-large', message: 'Use a photo under 4 MB.' },
          413
        );
      }

      const bytes = new Uint8Array(await photo.arrayBuffer());
      const imageType = detectReunificationImage(bytes);
      if (!imageType) {
        return json(
          {
            ok: false,
            code: 'invalid-photo',
            message: 'Use a JPEG, PNG, or WebP image.',
          },
          400
        );
      }

      photoPath = await uploadReunificationPhoto(store, requestId, bytes, imageType);
    }

    await insertReunificationRequest(store, {
      id: requestId,
      reference_code: referenceCode,
      access_token: accessToken,
      submitter_name: data.submitter_name,
      submitter_email: data.submitter_email.toLowerCase(),
      submitter_phone: data.submitter_phone ?? null,
      relationship: data.relationship,
      person_name: data.person_name,
      person_aliases: data.person_aliases ?? null,
      person_dob: data.person_dob ?? null,
      detention_date: data.detention_date ?? null,
      detention_city: data.detention_city ?? null,
      detention_state: data.detention_state ?? null,
      facility: data.facility ?? null,
      a_number: data.a_number ?? null,
      notes: data.notes ?? null,
      photo_path: photoPath,
      consent_contact: true,
      consent_privacy: true,
    });
  } catch (error) {
    if (photoPath) {
      await removeReunificationPhoto(store, photoPath).catch(() => undefined);
    }
    console.error(
      '[ice-reunification] intake failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return json(
      {
        ok: false,
        code: 'server-error',
        message: 'The private request could not be saved. Try again shortly.',
      },
      500
    );
  }

  const siteUrl = (env.NEXT_PUBLIC_SITE_URL || 'https://indivisiblefairoaks.org').replace(
    /\/+$/,
    ''
  );
  const statusUrl = `${siteUrl}/ice-alerts/reunification/status?token=${accessToken}`;

  const [confirmation] = await Promise.all([
    sendReunificationConfirmation({
      email: data.submitter_email.toLowerCase(),
      referenceCode,
      statusUrl,
    }),
    sendReunificationAdminNotice({ referenceCode }).catch(() => ({ ok: false as const })),
  ]);

  return json({
    ok: true,
    referenceCode,
    statusUrl,
    emailDelivered: confirmation.ok,
    message: confirmation.ok
      ? 'Your private request was received. Check your email for the confirmation and status link.'
      : 'Your private request was received. Save this reference and status link now; the confirmation email could not be sent.',
  });
}
