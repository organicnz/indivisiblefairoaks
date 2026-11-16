import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import {
  createIceAlertProofChallenge,
  ICE_ALERT_PROOF_DIFFICULTY_BITS,
} from '@/lib/ice-alert-proof';
import { hashIceAlertRateLimitKey } from '@/lib/ice-alert-rate-limit';
import { clientIp } from '@/lib/rate-limit';

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * GET issues a signed, IP-bound proof-of-work challenge. It deliberately does
 * not write to the database: the challenge is cheap to issue, and the expensive
 * operation is solved in the browser before the subscribe POST.
 */
export async function GET(req: Request) {
  if (isE2EMode()) {
    return json({
      ok: true,
      challenge: 'e2e',
      difficulty: 0,
      expiresAt: Date.now() + 60_000,
    });
  }

  const ipHash = await hashIceAlertRateLimitKey('ip', clientIp(req.headers));
  if (!ipHash) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Surge alerts are not configured on this deployment yet.',
      },
      503
    );
  }

  const challenge = await createIceAlertProofChallenge(ipHash, {
    difficulty: ICE_ALERT_PROOF_DIFFICULTY_BITS,
  });
  if (!challenge) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'Surge alerts are not configured on this deployment yet.',
      },
      503
    );
  }

  return json({
    ok: true,
    challenge: challenge.token,
    difficulty: challenge.difficulty,
    expiresAt: challenge.expiresAt,
  });
}
