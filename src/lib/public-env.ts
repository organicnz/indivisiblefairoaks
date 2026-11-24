/**
 * Public environment values, safe for both server and client bundles.
 *
 * `src/lib/env.ts` validates the full server schema with Zod. Importing it from
 * a Client Component pulled the whole Zod runtime into the first-load bundle of
 * every route, even though the client only needs these six public values. This
 * module deliberately has no imports: Next inlines each dotted access below at
 * build time, and the browser bundle stays free of the server schema.
 *
 * The server still validates the complete environment at startup through
 * `src/lib/env.ts`, so a malformed deployment fails there rather than here.
 * These defaults keep a half-filled local build renderable, matching the
 * previous public schema's defaults.
 */

const placeholderSupabaseUrl = 'https://placeholder.supabase.co';
const placeholderSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';
const defaultSiteUrl = 'https://indivisiblefairoaks.org';

function optionalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    new URL(value);
    return value;
  } catch {
    return undefined;
  }
}

function optionalString(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function urlOrDefault(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    new URL(value);
    return value;
  } catch {
    return fallback;
  }
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: urlOrDefault(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    placeholderSupabaseUrl
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    optionalString(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? placeholderSupabaseKey,
  NEXT_PUBLIC_SITE_URL: urlOrDefault(process.env.NEXT_PUBLIC_SITE_URL, defaultSiteUrl),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl(process.env.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: optionalString(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
} as const;
