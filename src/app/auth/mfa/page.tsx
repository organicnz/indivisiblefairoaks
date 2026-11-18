'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { Suspense } from 'react';
import { MfaChallengeForm } from '@/components/auth/mfa/MfaChallengeForm';
import { MfaNoFactorPanel } from '@/components/auth/mfa/MfaNoFactorPanel';
import { MfaShell } from '@/components/auth/mfa/MfaShell';
import { MfaUnreadablePanel } from '@/components/auth/mfa/MfaUnreadablePanel';
import { useMfaGate } from '@/components/auth/mfa/use-mfa-gate';

/**
 * Exported named as well as through the default wrapper so the gate and submit
 * paths are testable without a Suspense boundary — the component itself is the
 * unit under test, the wrapper is three lines of plumbing.
 */
export function MfaChallengePage() {
  const mfa = useMfaGate();
  const { destination } = mfa;

  // `already-verified` has nothing to render: the redirect effect in the gate
  // is already navigating. Falling through to the form instead is how a user
  // who is *already* AAL2 could be shown a code box for a step-up they do not
  // need — the redirect is a navigation, not an instant state change, so the
  // form would be interactive on the way out.
  if (mfa.recoveryReset) {
    const next = `/account?tab=settings&mfa=enroll&next=${encodeURIComponent(destination)}`;
    return (
      <MfaShell
        heading="Recovery code accepted"
        tone="normal"
        icon={<ShieldCheck size={32} aria-hidden="true" />}
      >
        <p className="text-muted-foreground mb-8 font-medium leading-relaxed">
          Your authenticator setup was reset. Sign in again, then enroll a new authenticator
          before continuing.
        </p>
        <a
          href={`/login?next=${encodeURIComponent(next)}`}
          className="inline-flex w-full items-center justify-center bg-primary dark:bg-primary-bright text-white font-bold rounded-sm py-5 uppercase tracking-[0.2em] text-sm transition-all hover:bg-primary-dark dark:hover:bg-primary-light"
        >
          Sign in and enroll
        </a>
      </MfaShell>
    );
  }

  if (mfa.checking || !mfa.outcome || mfa.outcome.kind === 'already-verified')
    return (
      <div className="civic-page min-h-screen flex items-center justify-center">
        <Loader2
          className="animate-spin text-primary dark:text-primary-on-dark"
          aria-label="Checking your security status"
        />
      </div>
    );

  if (mfa.outcome.kind === 'unreadable') {
    return <MfaUnreadablePanel detail={mfa.outcome.detail} />;
  }

  if (mfa.outcome.kind === 'no-factor') {
    return <MfaNoFactorPanel factorTypes={mfa.outcome.factorTypes} />;
  }

  return (
    <MfaChallengeForm
      useRecoveryCode={mfa.useRecoveryCode}
      code={mfa.code}
      recoveryCode={mfa.recoveryCode}
      loading={mfa.loading}
      error={mfa.error}
      availableFactors={mfa.availableFactors}
      selectedFactorId={mfa.selectedFactorId}
      onCodeChange={mfa.setCode}
      onRecoveryCodeChange={mfa.setRecoveryCode}
      onFactorChange={mfa.setSelectedFactorId}
      onSubmit={mfa.handleSubmit}
      onRecoverySubmit={mfa.handleRecoverySubmit}
      onToggleMode={mfa.toggleRecoveryMode}
    />
  );
}

/**
 * `useSearchParams` needs a Suspense boundary for `?next=`. Without one, the
 * build fails the prerender for the whole segment — which is why this is a
 * wrapper rather than the boundary living in `auth/layout.tsx`.
 */
export default function MfaChallengeRoute() {
  return (
    <Suspense
      fallback={
        <div className="civic-page min-h-screen flex items-center justify-center">
          <Loader2
            className="animate-spin text-primary dark:text-primary-on-dark"
            aria-label="Loading"
          />
        </div>
      }
    >
      <MfaChallengePage />
    </Suspense>
  );
}
