import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSafeNextPath } from '@/lib/safe-redirect';

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
