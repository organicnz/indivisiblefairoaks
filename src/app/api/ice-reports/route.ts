import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import { verifyIceAlertProof } from '@/lib/ice-alert-proof';
import {
  consumeIceAlertRateLimits,
  getIceAlertStore,
} from '@/lib/ice-alert-store';
import {
  hashIceAlertRateLimitKey,
} from '@/lib/ice-alert-rate-limit';
import {
  ICE_REPORT_RETENTION_DAYS,
  iceReportInputSchema,
  iceReportProofSchema,
  getIceReportStore,
  insertIceReport,
  makeIceReportReference,
} from '@/lib/ice-report-intake';
import { isSameOriginRequest } from '@/lib/same-origin';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { readJsonBodyWithLimit } from '@/lib/request-body';

export const maxDuration = 30;

const MAX_BODY_BYTES = 8_000;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const REPORT_RATE_LIMITS = {
  ip: 5,
  email: 5,
  endpoint: 1,
  global: 200,
} as const;
const NO_STORE = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function receivedResponse(referenceCode: string) {
  return json({
    ok: true,
    status: 'received',
    referenceCode,
    message:
      'Received privately. A volunteer will review it. Only a sanitized, city-level summary can be published after a second reviewer approves it.',
  });
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return json({ ok: false, code: 'forbidden-origin' }, 403);
  }

  const memoryGate = rateLimit(
    `ice-report:${clientIp(req.headers)}`,
    REPORT_RATE_LIMITS.ip,
    RATE_LIMIT_WINDOW_SECONDS * 1_000
  );
  if (!memoryGate.ok) {
    return json(
      {
        ok: false,
        code: 'rate-limited',
        message: `Too many reports. Try again in ${memoryGate.retryAfterSec}s.`,
      },
      429
    );
  }

  const body = await readJsonBodyWithLimit(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.code === 'too-large'
      ? json({ ok: false, code: 'too-large' }, 413)
      : json({ ok: false, code: 'invalid-json' }, 400);
  }

  const parsed = iceReportInputSchema
    .extend({ proof: iceReportProofSchema })
    .safeParse(body.value);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        code: 'invalid',
        message:
          parsed.error.issues[0]?.message ||
          'Check the city, state, time, and summary. Do not include names, addresses, plates, or contact details.',
      },
      400
    );
  }

  const data = parsed.data;
  if (data.company) {
    return json({ ok: true, status: 'ignored' });
  }

  if (isE2EMode()) {
    return json({
      ok: true,
      status: 'test-build',
      referenceCode: 'C-TEST000',
      message: 'Test build: no report was stored.',
    });
  }

  const alertStore = getIceAlertStore();
  const reportStore = getIceReportStore();
  if (!alertStore || !reportStore) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Private report review is not configured on this deployment yet.',
      },
      503
    );
  }

  const ipHash = await hashIceAlertRateLimitKey('ip', clientIp(req.headers));
  if (!ipHash) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Private report review is not configured on this deployment yet.',
      },
      503
    );
  }

  let rate;
  try {
    rate = await consumeIceAlertRateLimits(alertStore, {
      ipHash,
      // This endpoint has no reporter email. Reusing the IP hash is deliberate:
      // it keeps the durable controls on the reporter/network boundary without
      // creating a second identifier, and the same key is checked twice.
      emailHash: ipHash,
      endpointHash: null,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      ipLimit: REPORT_RATE_LIMITS.ip,
      emailLimit: REPORT_RATE_LIMITS.email,
      endpointLimit: REPORT_RATE_LIMITS.endpoint,
      globalLimit: REPORT_RATE_LIMITS.global,
    });
  } catch {
    return json(
      {
        ok: false,
        code: 'service-unavailable',
        message: 'The abuse check is temporarily unavailable. Try again shortly.',
      },
      503
    );
  }

  if (!rate.allowed) {
    return json(
      {
        ok: false,
        code: 'rate-limited',
        message: `Too many reports. Try again in ${rate.retryAfterSec}s.`,
      },
      429
    );
  }

  if (!(await verifyIceAlertProof(data.proof, ipHash))) {
    return json(
      {
        ok: false,
        code: 'proof-required',
        message: 'Complete the browser check and try again.',
      },
      400
    );
  }

  const id = crypto.randomUUID();
  const referenceCode = makeIceReportReference();
  const retentionExpiresAt = new Date(
    Date.now() + ICE_REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1_000
  ).toISOString();

  try {
    await insertIceReport(reportStore, {
      id,
      reference_code: referenceCode,
      city: data.city,
      state_code: data.stateCode,
      kind: data.kind,
      observed_at: data.observedAt,
      summary: data.summary,
      retention_expires_at: retentionExpiresAt,
    });
  } catch {
    return json(
      {
        ok: false,
        code: 'server-error',
        message: 'The report could not be saved. Try again shortly.',
      },
      500
    );
  }

  return receivedResponse(referenceCode);
}
