import { NextResponse } from 'next/server';
import type { AdminApiFailure } from '@/lib/admin-api-auth';

/**
 * The one place a failed admin API gate becomes an HTTP response.
 *
 * Route handlers must not each re-derive this mapping: the 401/403/503 split
 * is meaningful (unauthenticated, step-up required, retryable verification
 * fault), and so is `mfaRequired`, which tells the client to send the operator
 * to the challenge rather than retrying the request.
 */
export function adminApiFailureResponse(failure: AdminApiFailure) {
  return NextResponse.json(
    {
      error: failure.error,
      ...(failure.mfaRequired ? { mfaRequired: true } : {}),
    },
    { status: failure.status }
  );
}
