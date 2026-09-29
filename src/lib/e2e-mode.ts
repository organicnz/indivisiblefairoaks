import { env } from '@/lib/env';

/**
 * True only in a build that Playwright produced and the harness flagged.
 *
 * **Both halves are required.** `NEXT_E2E_BUILD` alone is true in any CI build,
 * where sending is exactly what we want. `CONTACT_SUBMISSION_TEST_MODE` alone
 * would be a production switch that silently stops delivering contact messages —
 * the kind of variable an admin sets once during an incident and forgets. Asking
 * for both means CI cannot enable it by accident and an admin cannot disable
 * real delivery with a single value.
 *
 * This lives outside the app's `actions.ts` files because Turbopack requires
 * every export of a `'use server'` module to be an async function, and a
 * synchronous predicate is what a caller wants.
 */
export function isE2EMode(): boolean {
  return env.CONTACT_SUBMISSION_TEST_MODE === '1' && env.NEXT_E2E_BUILD === 'true';
}
