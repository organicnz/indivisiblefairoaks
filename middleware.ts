import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// Safe origins for the `next` redirect param — prevents open-redirect abuse.
// Only paths on this same origin are allowed; absolute URLs are rejected.
function safeNextUrl(request: NextRequest): string {
  const next = request.nextUrl.searchParams.get('next');
  if (!next) return '/account';
  // Must be a relative path starting with / and not //  (protocol-relative)
  if (/^\/(?!\/)/.test(next)) return next;
  return '/account';
}

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

  // Protect /account — redirect to /login?next=<original-path>
  if (pathname.startsWith('/account') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /admin — redirect to /login?next=<original-path>
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in — honour ?next= or fall back to /account
  if (pathname.startsWith('/login') && user) {
    return NextResponse.redirect(new URL(safeNextUrl(request), request.url));
  }

  return response;
}

export const config = {
  // Run ONLY on the paths middleware actually gates (auth redirects). Every
  // other request — CDN-served static shells, /api (incl. Stripe webhooks),
  // images, OG graphics — skips middleware entirely and costs zero function
  // CPU. Session refresh on general navigation is handled client-side by
  // supabase-js autoRefreshToken; middleware re-syncs on gated surfaces.
  matcher: ['/account/:path*', '/admin/:path*', '/login'],
};
