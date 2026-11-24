'use client';

import dynamic from 'next/dynamic';

/**
 * The 2FA panel is a large, below-the-fold client island: TanStack Query, the
 * Supabase factor flow, the QR renderer and recovery-code dialogs. Loading it
 * with the account page put all of that in the first load even for a visitor
 * who only changes an email preference. It is mounted after hydration instead.
 */
const MfaSettings = dynamic(
  () => import('@/components/account/MfaSettings').then((module) => module.MfaSettings),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-12 h-48 animate-pulse rounded-sm border border-border bg-surface-muted"
        aria-hidden="true"
      />
    ),
  }
);

type MfaSettingsLazyProps = {
  autoEnroll?: boolean;
  returnTo?: string;
};

export function MfaSettingsLazy(props: MfaSettingsLazyProps) {
  return <MfaSettings {...props} />;
}
