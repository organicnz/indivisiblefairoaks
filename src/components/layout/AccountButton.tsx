'use client';

import type { User } from '@supabase/supabase-js';
import { User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

/**
 * Navbar account entry point (right side, next to Donate).
 *
 * Session-aware: signed-in users get a profile icon linking to /account
 * (which hosts the admin tab for admins); signed-out users get Sign In.
 * Listens to auth changes so login/logout swaps it without a reload.
 * Renders a fixed-size skeleton while resolving to avoid layout shift.
 */
export function AccountButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <span aria-hidden="true" className="inline-block w-9 h-9 rounded-full bg-white/10" />;
  }

  if (user) {
    return (
      <Link
        href="/account"
        aria-label="Your account"
        title="Your account"
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
      >
        <UserIcon size={18} />
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="inline-flex items-center px-4 py-2 rounded-full border border-white/20 hover:border-white/40 text-white font-bold text-xs uppercase tracking-wider transition-all"
    >
      Sign In
    </Link>
  );
}
