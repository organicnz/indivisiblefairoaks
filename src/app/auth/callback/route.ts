import { NextResponse } from 'next/server';
import { getSafeNextPath } from '@/lib/safe-redirect';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const explicitNext = getSafeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (explicitNext) {
        return NextResponse.redirect(`${origin}${explicitNext}`);
      }

      // If no explicit destination was requested, route admins to the admin panel
      try {
        if (typeof supabase.auth?.getUser === 'function') {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user && typeof supabase.from === 'function') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('is_admin')
              .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
              .maybeSingle();

            if (profile?.is_admin) {
              return NextResponse.redirect(`${origin}/admin`);
            }
          }
        }
      } catch {
        // Fall through to /account on any lookup error
      }

      return NextResponse.redirect(`${origin}/account`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Invalid_Token`);
}
