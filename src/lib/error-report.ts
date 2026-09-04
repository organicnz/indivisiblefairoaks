import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Client error telemetry - shared between the browser error boundaries and
 * the /api/report-error route. Pure and dependency-free so it stays
 * unit-testable without a Next.js runtime.
 *
 * Bounds are enforced here (not only in the DB) so oversized junk is rejected
 * before it ever reaches Postgres or burns rate-limiter accounting.
 */

export const ERROR_MESSAGE_MAX = 500;
export const ERROR_STACK_MAX = 2000;
export const ERROR_COMPONENT_STACK_MAX = 1000;
export const ERROR_DIGEST_MAX = 64;
export const ERROR_PATH_MAX = 300;
export const ERROR_CATEGORY_MAX = 50;

export const VALID_ERROR_CATEGORIES = [
  'runtime',
  'build',
  'deploy',
  'ui',
  'api',
  'database',
  'network',
  'auth',
  'stripe',
  'supabase',
  'other',
] as const;

export type ValidErrorCategory = (typeof VALID_ERROR_CATEGORIES)[number];

export const errorReportSchema = z.object({
  message: z.string().trim().min(1).max(ERROR_MESSAGE_MAX),
  stack: z.string().max(ERROR_STACK_MAX).optional(),
  componentStack: z.string().max(ERROR_COMPONENT_STACK_MAX).optional(),
  digest: z.string().max(ERROR_DIGEST_MAX).optional(),
  path: z.string().max(ERROR_PATH_MAX).optional(),
  category: z.enum(VALID_ERROR_CATEGORIES).default('other').optional(),
});

export type ErrorReportInput = z.infer<typeof errorReportSchema>;

/**
 * Groups identical crashes into one triage family: SHA-256 of the message
 * plus the first stack frame (the throw site), hex-truncated to 32 chars.
 * Server-side only (Node runtime): a client-supplied fingerprint would let a
 * bot poison the grouping key with garbage.
 */
export function errorFingerprint(message: string, stack?: string): string {
  // Prefer the first real frame: V8 prefixes stacks with an "Error: msg"
  // header that just duplicates the message, while V8 frames look like
  // "    at fn (file)" and JSC/SpiderMonkey frames like "fn@file".
  const lines = stack?.split('\n').filter((line) => line.trim().length > 0) ?? [];
  const topFrame =
    lines.find((line) => /^\s*at\s/.test(line) || line.includes('@')) ?? lines[0] ?? '';
  return createHash('sha256').update(`${message}\n${topFrame}`).digest('hex').slice(0, 32);
}

/**
 * Fire-and-forget beacon used by the error boundaries. Never throws and never
 * blocks recovery UI: keepalive fetch survives unload-triggered resets, and
 * every failure mode is swallowed. Safe to call from anywhere client-side.
 */
export function reportClientError(error: unknown, extras: Partial<ErrorReportInput> = {}): void {
  try {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const payload = {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ...extras,
    };
    const parsed = errorReportSchema.safeParse(payload);
    if (!parsed.success) return;
    void fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry must never become its own incident.
  }
}
