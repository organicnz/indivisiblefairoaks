'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ArrowUpRight, ChevronDown, LogOut, Shield, User, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
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
 * Signed-out users get a “Sign In” CTA with a compact square profile mark.
 * Signed-in users get an avatar (image from user_metadata, else initials) with a
 * Radix dropdown: My Account, Settings (if org email), Sign Out.
 *
 * The component listens to auth state changes so login/logout swaps without a reload.
 * A fixed-size skeleton renders while resolving to avoid layout shift.
 */
export function AccountButton({ variant = 'pill', onNavigate }: AccountButtonProps) {
  const { dataPoints } = useDataPoints('account');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    // The auth client can be slow or unreachable in local/preview setups. A
    // permanent loading pill used to occupy the masthead when `getSession()`
    // never settled. Resolve to the signed-out entry point after a short beat;
    // a real session arriving later still replaces it through the listener.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2500);

    try {
      const supabase = createClient();
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (mounted) {
            setUser(session?.user ?? null);
            setLoading(false);
          }
        })
        .catch(() => {
          // Auth being unreachable must not leave a permanent loading pill in
          // the masthead. Fall back to the signed-out entry point.
          if (mounted) setLoading(false);
        });

      subscription = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }).data.subscription;
    } catch {
      if (mounted) setLoading(false);
    }

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return variant === 'block' ? (
      <span
        aria-hidden="true"
        className="flex w-full items-center gap-3 rounded-sm border border-white/15 bg-white/5 p-3"
      >
        <span className="size-9 shrink-0 rounded-sm bg-white/10" />
        <span className="h-2.5 w-24 animate-pulse rounded-sm bg-white/15 motion-reduce:animate-none" />
      </span>
    ) : (
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-[7.25rem] items-center gap-2 rounded-sm border border-foreground/20 px-2.5"
      >
        <span className="size-5 shrink-0 rounded-sm bg-surface-muted" />
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
          Sign In
        </span>
      </span>
    );
  }

  if (!user) {
    const placeholder = (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-foreground/25 bg-surface-muted text-foreground transition-colors duration-300 ease-out group-hover:border-primary group-hover:text-primary"
      >
        <UserRound size={14} strokeWidth={1.8} />
      </span>
    );

    if (variant === 'block') {
      return (
        <Link
          href="/login"
          onClick={onNavigate}
          className="group flex w-full items-center gap-3 rounded-sm border border-white/15 bg-white/5 p-3 text-left text-ink-on-dark transition-colors duration-300 ease-out hover:border-primary-on-dark/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70"
          aria-label="Sign in to your account"
        >
          {placeholder}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold uppercase tracking-wider">
              <DataPoint as="span" name="account.btn.sign_in" initialData={dataPoints}>
                Sign In
              </DataPoint>
            </span>
            <DataPoint
              as="span"
              name="account.btn.access_account"
              initialData={dataPoints}
              className="mt-0.5 block text-[11px] font-medium normal-case tracking-normal text-ink-muted-on-dark"
            >
              Access your account
            </DataPoint>
          </span>
          <ArrowUpRight
            size={16}
            className="shrink-0 text-ink-muted-on-dark transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-gold"
          />
        </Link>
      );
    }

    return (
      <Link
        href="/login"
        className="group inline-flex h-9 shrink-0 items-center gap-2 rounded-sm border border-foreground/25 px-2.5 transition-colors duration-300 ease-out hover:border-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Sign in to your account"
      >
        {placeholder}
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.13em] text-foreground">
          <DataPoint as="span" name="account.btn.sign_in" initialData={dataPoints}>
            Sign In
          </DataPoint>
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
        className={`flex items-center justify-center rounded-full bg-primary font-bold text-white ring-2 ring-white/15 ${dims} ${text}`}
      >
        {initials}
      </span>
    );

  const menuContent = (
    <DropdownMenuContent
      align="end"
      sideOffset={4}
      className="z-[110] w-48 rounded-sm border border-white/10 bg-secondary p-1 shadow-float"
    >
      <DropdownMenuItem
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-on-dark outline-none transition-colors duration-150 ease-out data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
        onClick={() => {
          onNavigate?.();
          window.location.href = '/account';
        }}
      >
        <span aria-hidden="true" className="flex-shrink-0 w-3.5 h-3.5">
          <User size={14} />
        </span>
        <DataPoint as="span" name="account.btn.my_account" initialData={dataPoints}>
          My Account
        </DataPoint>
      </DropdownMenuItem>

      {user.email?.endsWith('@indivisiblefairoaks.org') ? (
        <DropdownMenuItem
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-on-dark outline-none transition-colors duration-150 ease-out data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
          onClick={() => {
            onNavigate?.();
            window.location.href = '/account?tab=settings';
          }}
        >
          <span aria-hidden="true" className="flex-shrink-0 w-3.5 h-3.5">
            <Shield size={14} />
          </span>
          <DataPoint as="span" name="account.btn.settings" initialData={dataPoints}>
            Settings
          </DataPoint>
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuItem
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-on-dark outline-none transition-colors duration-150 ease-out data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
        onClick={() => {
          onNavigate?.();
          const supabase = createClient();
          supabase.auth.signOut().then(() => {
            window.location.href = '/';
          });
        }}
      >
        <span aria-hidden="true" className="flex-shrink-0 w-3.5 h-3.5">
          <LogOut size={14} />
        </span>
        <DataPoint as="span" name="account.btn.sign_out" initialData={dataPoints}>
          Sign Out
        </DataPoint>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (variant === 'block') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-3 rounded-sm border border-white/15 bg-white/5 p-3 text-left text-ink-on-dark transition-colors duration-300 ease-out hover:border-primary-on-dark/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70"
          aria-label="User menu"
        >
          {renderAvatar('h-9 w-9 shrink-0', 'text-[11px]')}
          <span className="flex-1 min-w-0 text-left text-sm font-bold uppercase tracking-wider truncate">
            {displayName}
          </span>
          <ChevronDown size={16} className="shrink-0 text-ink-muted-on-dark" />
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
