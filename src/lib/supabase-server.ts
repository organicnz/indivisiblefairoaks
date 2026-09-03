import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from '@/types/supabase';

export const createServerClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing environment variables:', {
      url: !!supabaseUrl,
      key: !!supabaseKey,
    });
    throw new Error('Supabase environment variables are not configured');
  }

  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};

/**
 * Public client that doesn't use cookies.
 * Ideal for public data fetches (products, categories) to avoid stale JWT issues.
 */
export const createPublicClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing environment variables for public client');
    throw new Error('Supabase environment variables are not configured');
  }

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
};

/**
 * Admin client that bypasses RLS. Use ONLY for secure server-side operations.
 */
export const createAdminClient = async () => {
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SECRET_KEY is not configured — admin operations will fail');
  }
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  return createSupabaseServerClient<Database>(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
};

/**
 * Server-side settings fetcher with caching
 */
export const getSettings = cache(async () => {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Try by email if user_id match fails (for legacy profiles)
        if (!user.email) return null;

        const { data: emailData, error: emailError } = await supabase
          .from('profiles')
          .select('settings')
          .eq('email', user.email)
          .single();

        if (!emailError) return emailData?.settings;
      }
      return null;
    }

    return data?.settings;
  } catch (error) {
    // Under Cache Components, cookies() rejects once the static shell completes
    // prerendering; React retries this read at request time. Don't log that signal.
    if (!(error instanceof Error && /prerender/i.test(error.message))) {
      console.error('Error in getSettings:', error);
    }
    return null;
  }
});
