/**
 * The browser half of client error telemetry.
 *
 * Kept free of Zod on purpose: this module is loaded from the error boundaries
 * after a crash, and importing the schema module pulled 107 KB of validation
 * code into every route's first load. The bounds below are the same ones the
 * server schema enforces; the server remains the authority.
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

export interface ErrorReportInput {
  message: string;
  stack?: string;
  componentStack?: string;
  digest?: string;
  path?: string;
  category?: ValidErrorCategory;
}

function bounded(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length <= max ? value : undefined;
}

function isValidCategory(value: unknown): value is ValidErrorCategory | undefined {
  return value === undefined || (VALID_ERROR_CATEGORIES as readonly unknown[]).includes(value);
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
    if (message.trim().length === 0 || message.length > ERROR_MESSAGE_MAX) return;

    const stackInput = extras.stack ?? (error instanceof Error ? error.stack : undefined);
    const pathInput =
      extras.path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
    const stack = bounded(stackInput, ERROR_STACK_MAX);
    const path = bounded(pathInput, ERROR_PATH_MAX);
    const componentStack = bounded(extras.componentStack, ERROR_COMPONENT_STACK_MAX);
    const digest = bounded(extras.digest, ERROR_DIGEST_MAX);
    if (!isValidCategory(extras.category)) return;
    if (stackInput !== undefined && stack === undefined) return;
    if (pathInput !== undefined && path === undefined) return;
    if (extras.componentStack !== undefined && componentStack === undefined) return;
    if (extras.digest !== undefined && digest === undefined) return;

    const payload: ErrorReportInput = { message };
    if (path !== undefined) payload.path = path;
    if (stack !== undefined) payload.stack = stack;
    if (componentStack !== undefined) payload.componentStack = componentStack;
    if (digest !== undefined) payload.digest = digest;
    if (extras.category !== undefined) payload.category = extras.category;

    void fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry must never become its own incident.
  }
}
