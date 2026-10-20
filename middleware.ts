import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSafeNextPath } from '@/lib/safe-redirect';

/**
 * Routing middleware — the auth gate in front of /account, /admin, /login and
 * /auth/mfa.
 *
 * ## Why this file is still `middleware.ts` and not `proxy.ts`
 *
 * Next.js 16 deprecated the `middleware` file convention and renamed it to
 * `proxy`. The rename looks like housekeeping. It is not — **it moves this
 * code onto Node.js.**
 *
 * Measured on this repository, both ways, from the build output:
 *
 *   - `middleware.ts` compiles to the **Edge** runtime. The build manifest
 *     lists `server/edge/chunks/…` and the `edge-wrapper` template.
 *   - `proxy.ts` compiles to a **Node** bundle — `server/middleware.js`, a
 *     CommonJS entry — and Next.js's own version history says why: *"Middleware
 *     is deprecated and renamed to Proxy. **Proxy defaults to the Node.js
 *     runtime**."* The build also rejects `export const runtime` inside a
 *     proxy file: *"Proxy always runs on Node.js runtime."*
 *
 * So the file convention decides the runtime, and the current convention is
 * the one that keeps this project off Node.js:
 *
 *   | Surface | Runtime | Node.js? |
 *   |---|---|---|
 *   | Serverless functions — route handlers, ISR renders | Bun 1.4.x | no |
 *   | This middleware | Edge (V8) | no |
 *   | Build, type check, tests, scripts | Bun | no |
 *
 * The Edge runtime is not Bun either — it is V8 without the Node
 * compatibility layer, which is why `src/sentry.edge.config.ts` exists
 * separately from `src/instrumentation.ts`. But it is **not Node.js**, and the
 * project's rule is that no Node.js runtime may remain. Renaming this file
 * would be a silent, framework-level reintroduction of exactly the runtime
 * this project does not have.
 *
 * **Do not rename this file to `proxy.ts` without a runtime decision.** If
 * Next.js removes the `middleware` convention, the replacement is not a
 * rename — it is a choice between the Edge runtime and Node.js, and the
 * answer is not "Node.js" without a reason.
 *
 * ## Do not add `export const runtime` here
 *
 * Next.js accepts only `'edge'` and `'nodejs'` in a segment config. Adding it
 * would pin this to Node.js — and, unlike a build error, a runtime that
 * differs between environments fails at the first request rather than at the
 * build.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for middleware');
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // The *full* original URL, not just the path.
  //
  // `/account?tab=settings` used to be remembered as `/account`, so a volunteer
  // who was bounced to sign-in came back to their Orders tab instead of the
  // Settings tab they were trying to reach. `getSafeNextPath` re-validates it
  // (open-redirect guard) before anything downstream trusts it.
  const returnTo = getSafeNextPath(`${pathname}${request.nextUrl.search}`, pathname) ?? pathname;

  // Protect /account — redirect to /login?next=<original-url>
  if (pathname.startsWith('/account') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /admin — redirect to /login?next=<original-url>
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  // `/auth/mfa` needs no session to *render*, but an unauthenticated visitor has
  // no factor to answer with, and its client-side gate would push them to
  // /login, which middleware immediately bounces back here. One hop, no loop.
  if (pathname.startsWith('/auth/mfa') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in — honour ?next= or fall back to /account
  if (pathname.startsWith('/login') && user) {
    return NextResponse.redirect(
      new URL(
        getSafeNextPath(request.nextUrl.searchParams.get('next'), '/account') ?? '/account',
        request.url
      )
    );
  }

  return response;
}

export const config = {
  // Run ONLY on the paths middleware actually gates (auth redirects). Every
  // other request — CDN-served static shells, /api (incl. Stripe webhooks),
  // images, OG graphics — skips middleware entirely and costs zero function
  // CPU. Session refresh on general navigation is handled client-side by
  // supabase-js autoRefreshToken; middleware re-syncs on gated surfaces.
  //
  // `/auth/mfa` was added for the bounce above, not for session refresh: the
  // challenge is the one step-up surface, and leaving it ungated meant a stale
  // AAL claim there survived until the *next* protected page load threw it out.
  matcher: ['/account/:path*', '/admin/:path*', '/login', '/auth/mfa'],
};
