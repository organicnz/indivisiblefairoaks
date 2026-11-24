/**
 * Supabase's browser client stores the session in `sb-<project-ref>-auth-token`,
 * split into numbered chunks when large. Checking for it before importing the
 * SDK keeps anonymous pages from paying for the auth client.
 *
 * This mirrors the server check in `supabase-server.ts`. Server rendering has no
 * `document`, so the browser keeps the loading skeleton until this effect runs.
 */
const SUPABASE_AUTH_COOKIE_NAME = /^sb-.+-auth-token(?:\.\d+)?$/;

export function isSupabaseAuthCookieName(name: string): boolean {
  return SUPABASE_AUTH_COOKIE_NAME.test(name);
}

export function hasSupabaseAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;

  return document.cookie.split(';').some((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    return name ? isSupabaseAuthCookieName(name) : false;
  });
}
