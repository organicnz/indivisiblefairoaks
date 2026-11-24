import { z } from 'zod';
import {
  ERROR_COMPONENT_STACK_MAX,
  ERROR_DIGEST_MAX,
  ERROR_MESSAGE_MAX,
  ERROR_PATH_MAX,
  ERROR_STACK_MAX,
  VALID_ERROR_CATEGORIES,
} from '@/lib/error-report-client';

/**
 * Server-side client-error telemetry schema - shared with the
 * /api/report-error route. The browser reporter lives in
 * `error-report-client.ts` so a crash does not ship Zod in the first load.
 *
 * Bounds are enforced here (not only in the DB) so oversized junk is rejected
 * before it ever reaches Postgres or burns rate-limiter accounting.
 */

export {
  ERROR_COMPONENT_STACK_MAX,
  ERROR_DIGEST_MAX,
  ERROR_MESSAGE_MAX,
  ERROR_PATH_MAX,
  ERROR_STACK_MAX,
  type ErrorReportInput,
  reportClientError,
  VALID_ERROR_CATEGORIES,
  type ValidErrorCategory,
} from '@/lib/error-report-client';

export const errorReportSchema = z.object({
  message: z.string().trim().min(1).max(ERROR_MESSAGE_MAX),
  stack: z.string().max(ERROR_STACK_MAX).optional(),
  componentStack: z.string().max(ERROR_COMPONENT_STACK_MAX).optional(),
  digest: z.string().max(ERROR_DIGEST_MAX).optional(),
  path: z.string().max(ERROR_PATH_MAX).optional(),
  category: z.enum(VALID_ERROR_CATEGORIES).default('other').optional(),
});

/**
 * Groups identical crashes into one triage family: SHA-256 of the message
 * plus the first stack frame (the throw site), hex-truncated to 32 chars.
 * Uses Web Crypto (globalThis.crypto) — compatible with both Node 18+ and
 * edge runtimes. Server-side only: a client-supplied fingerprint would let a
 * bot poison the grouping key.
 */
export async function errorFingerprint(message: string, stack?: string): Promise<string> {
  // Prefer the first real frame: V8 prefixes stacks with an "Error: msg"
  // header that just duplicates the message, while V8 frames look like
  // "    at fn (file)" and JSC/SpiderMonkey frames like "fn@file".
  const lines = stack?.split('\n').filter((line) => line.trim().length > 0) ?? [];
  const topFrame =
    lines.find((line) => /^\s*at\s/.test(line) || line.includes('@')) ?? lines[0] ?? '';
  const input = `${message}\n${topFrame}`;
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
