'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ChevronDown, LogOut, Shield, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface AccountButtonProps {
  /** `pill` = compact desktop CTA, `block` = full-width mobile drawer row */
  variant?: 'pill' | 'block';
  /** Called after navigating from a menu item (e.g. close mobile drawer) */
  onNavigate?: () => void;
}

/**
 * Account entry point for the header.
 *
 * Signed-out users get a “Sign In” CTA with a circular profile-icon placeholder.
 * Signed-in users get an avatar (image from user_metadata, else initials) with a
 * Radix dropdown: My Account, Settings (if org email), Sign Out.
 *
 * The component listens to auth state changes so login/logout swaps without a reload.
 * A fixed-size skeleton renders while resolving to avoid layout shift.
 */
export function AccountButton({ variant = 'pill', onNavigate }: AccountButtonProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
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
    return variant === 'block' ? (
      <span aria-hidden="true" className="block w-full h-12 rounded-xl bg-white/10" />
    ) : (
      <span aria-hidden="true" className="inline-block w-28 h-9 rounded-full bg-white/10" />
    );
  }

  if (!user) {
    const placeholder = (
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-primary-dark text-white ring-2 ring-white/15"
      >
        <User size={14} strokeWidth={2.5} />
      </span>
    );

    if (variant === 'block') {
      return (
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-3 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-200 hover:text-white font-bold text-sm uppercase tracking-wider transition-colors"
          aria-label="Sign in to your account"
        >
          {placeholder}
          Sign In
        </Link>
      );
    }

    return (
      <Link
        href="/login"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/5 py-1 pl-1 pr-4 hover:border-amber-400/50 hover:bg-white/10 transition-colors duration-300 ease-out"
        aria-label="Sign in to your account"
      >
        {placeholder}
        <span className="text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap">
          Sign In
        </span>
      </Link>
    );
  }

  const avatarUrl =
    typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;
  const displayName =
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    user.email?.split('@')[0] ||
    'Account';
  const initials = user.email ? user.email.split('@')[0].substring(0, 2).toUpperCase() : 'U1';

  const renderAvatar = (dims: string, text: string) =>
    avatarUrl ? (
      <Image
        src={avatarUrl}
        alt=""
        width={36}
        height={36}
        unoptimized
        className={`rounded-full object-cover ring-2 ring-white/15 ${dims}`}
      />
    ) : (
      <span
        aria-hidden="true"
        className={`rounded-full bg-gradient-to-br from-primary-light to-primary-dark text-white flex items-center justify-center font-bold ring-2 ring-white/15 ${dims} ${text}`}
      >
        {initials}
      </span>
    );

  const menuContent = (
    <DropdownMenuContent
      align="end"
      sideOffset={4}
      className="z-[110] w-44 rounded-md bg-slate-950 p-1 shadow-lg shadow-slate-900/60 border border-slate-800/30"
    >
      <DropdownMenuItem
        className="flex items-center gap-3 px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50 transition-colors cursor-pointer"
        onClick={() => {
          onNavigate?.();
          window.location.href = '/account';
        }}
      >
        <span className="flex-shrink-0 w-3.5 h-3.5">
          <User size={14} />
        </span>
        My Account
      </DropdownMenuItem>

      {user.email?.endsWith('@indivisiblefairoaks.org') ? (
        <DropdownMenuItem className="flex items-center gap-3 px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50 transition-colors cursor-pointer">
          <span className="flex-shrink-0 w-3.5 h-3.5">
            <Shield size={14} />
          </span>
          Settings
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuItem
        className="flex items-center gap-3 px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50 transition-colors cursor-pointer"
        onClick={() => {
          onNavigate?.();
          const supabase = createClient();
          supabase.auth.signOut().then(() => {
            window.location.href = '/';
          });
        }}
      >
        <span className="flex-shrink-0 w-3.5 h-3.5">
          <LogOut size={14} />
        </span>
        Sign Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (variant === 'block') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-200 hover:text-white transition-colors"
          aria-label="User menu"
        >
          {renderAvatar('h-8 w-8 shrink-0', 'text-[11px]')}
          <span className="flex-1 min-w-0 text-left text-sm font-bold uppercase tracking-wider truncate">
            {displayName}
          </span>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </DropdownMenuTrigger>
        {menuContent}
      </DropdownMenu>
    );
  }

  // Signed-in (desktop pill): circular avatar dropdown trigger
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 ease-out hover:opacity-80"
        aria-label="User menu"
      >
        {renderAvatar('h-9 w-9', 'text-xs')}
      </DropdownMenuTrigger>
      {menuContent}
    </DropdownMenu>
  );
}
