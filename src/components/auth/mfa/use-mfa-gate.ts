'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { redeemMfaRecoveryCodeAction } from '@/lib/actions/mfa-recovery';
import { getSafeNextPath } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase';

/**
 * Why the page decided not to show a code box.
 *
 * Naming the outcome breaks the redirect loop: the user can act on it.
 */
type GateOutcome =
  | { kind: 'challenge' }
  | { kind: 'already-verified' }
  | { kind: 'no-factor'; factorTypes: string[] }
  | { kind: 'unreadable'; detail: string };

/** Only TOTP can be answered with a 6-digit code from an authenticator app. */
const TOTP = 'totp';

/**
 * How long the mount gate waits before showing the retryable fault.
 *
 * Generous enough not to fire on a slow phone, short enough that a dead network
 * is not mistaken for a working spinner. The user can always reload; what they
 * cannot do is tell a hung request from a slow one.
 */
const CHECK_TIMEOUT_MS = 10_000;

/**
 * Verified factor types, for the "this account has X, not Y" message.
 *
 * Read from a parameter rather than from `factors.all` at the call site, so the
 * `no-factor` branch below can pass the bucket it already read.
 */
function factorTypesOf(factors: { factor_type?: string; status?: string }[]): string[] {
  return [
    ...new Set(
      factors.filter((f) => f.status === 'verified').map((f) => f.factor_type ?? 'unknown')
    ),
  ];
}


export function useMfaGate() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [outcome, setOutcome] = useState<GateOutcome | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryReset, setRecoveryReset] = useState(false);
  const [availableFactors, setAvailableFactors] = useState<
    { id: string; friendly_name?: string }[]
  >([]);
  const [selectedFactorId, setSelectedFactorId] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  // In a ref, not a dep. `createClient()` builds a new object on every render,
  // so putting it in the dependency array re-ran the gate effect on every
  // state change — and since the effect calls `setOutcome`, that is an
  // unbounded render loop. The gate is a mount-time decision about the session,
  // not something a re-render should recompute.
  //
  // `useRef(createClient())` evaluates `createClient()` on *every* render and
  // discards the result — the ref stores the first value but the argument is
  // always called. `useMemo` is the memoisation the comment describes.
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? createClient() : null),
    []
  );

  // Where to go once the session is AAL2. `getSafeNextPath` is the same guard
  // the login page and middleware use, so `?next=` cannot become an open
  // redirect by way of the challenge page.
  const destination = getSafeNextPath(searchParams.get('next'), '/account') ?? '/account';

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    // A hung Supabase call must not leave the user on a spinner forever with no
    // way forward. `getAuthenticatorAssuranceLevel` is a network read, and a
    // dead network produces a promise that never settles rather than a
    // rejection on some paths.
    const settle = setTimeout(() => {
      if (!cancelled) {
        setOutcome({ kind: 'unreadable', detail: 'The check did not complete in time.' });
        setChecking(false);
      }
    }, CHECK_TIMEOUT_MS);

    async function checkAal() {
      if (!supabase) return;
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      clearTimeout(settle);
      if (cancelled) return;
      if (error) {
        setOutcome({ kind: 'unreadable', detail: error.message });
        setChecking(false);
        return;
      }

      // `nextLevel === currentLevel` means there is nothing left to step up to —
      // either already AAL2, or no factor enrolled at all. Both mean: not here.
      if (data.nextLevel === data.currentLevel) {
        setOutcome({ kind: 'already-verified' });
        setChecking(false);
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (factorsError) {
        // Deliberately NOT a redirect to /login. That page bounces a signed-in
        // user straight back to /account, whose gate sends them here again.
        setOutcome({ kind: 'unreadable', detail: factorsError.message });
        setChecking(false);
        return;
      }

      const verified = factors?.all?.filter((f) => f.status === 'verified') ?? [];

      // AAL said `aal2` was reachable, but nothing verified answers a code. An
      // unverified factor can be sitting in the database from an enrollment the
      // author abandoned, and challenging one of those fails with "Invalid TOTP
      // code" forever.
      if (verified.length === 0) {
        setAvailableFactors([]);
        setSelectedFactorId('');
        setOutcome({ kind: 'no-factor', factorTypes: [] });
        setChecking(false);
        return;
      }

      // `factor_type` is load-bearing here. `listFactors().all` mixes totp,
      // phone and webauthn; picking the first verified factor of *any* type and
      // rendering a TOTP box means a phone factor gets an SMS and the typed
      // digits then fail verification permanently, with no explanation. Say what
      // the account actually has instead.
      const totpFactors = verified.filter((f) => f.factor_type === TOTP);
      if (totpFactors.length === 0) {
        setAvailableFactors([]);
        setSelectedFactorId('');
        setOutcome({ kind: 'no-factor', factorTypes: factorTypesOf(factors?.all ?? []) });
        setChecking(false);
        return;
      }

      // Keep the user's choice if it still exists (a factor may have been removed
      // in another tab), otherwise default to the first. The selector below is
      // what makes multiple authenticators an actual option rather than a list
      // of names on the account page.
      setAvailableFactors(
        totpFactors.map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name }))
      );
      setSelectedFactorId((current) =>
        totpFactors.some((factor) => factor.id === current) ? current : totpFactors[0].id
      );
      setOutcome({ kind: 'challenge' });
      setChecking(false);
    }

    /*
     * A rejection here is a dropped connection, not a wrong code — and without
     * a `.catch()` it is an unhandled rejection that the 10-second `settle`
     * timer eventually papers over with the wrong cause ("did not complete in
     * time" when the check *failed*, not timed out). Report the fault, and let
     * the timer's `clearTimeout(settle)` stay where the awaits already put it.
     */
    checkAal().catch(() => {
      if (cancelled) return;
      clearTimeout(settle);
      setOutcome({ kind: 'unreadable', detail: 'Could not reach the verification service.' });
      setChecking(false);
    });
    return () => {
      cancelled = true;
      clearTimeout(settle);
    };
  }, [supabase]);

  /*
   * Two redirects, from a real decision rather than from a throw. `router.replace`
   * so the challenge does not become a history entry the Back button returns to.
   *
   * `no-factor` is deliberately NOT one of them. It used to be:
   *
   *   `router.replace('/account?tab=settings')`
   *
   * which made the `no-factor` shell below unreachable in a browser — the
   * redirect fires in an effect in the same commit that renders it, so jsdom's
   * inert router was the only reason the shell's own test could assert on its
   * text. A redirect is not an instant state change, so on the way out the user
   * saw a page change for no stated reason.
   *
   * Worse, it closed a loop. For an account whose only verified factor is a
   * phone factor: the guard said `step_up_required`, this page said `no-factor`,
   * the redirect sent them to `/account`, whose gate declines to redirect
   * precisely because there is no TOTP factor to answer with — and retrying the
   * write returned them to the guard. Four hops, no message, no way out. The
   * guard now asks the same question this page does (a TOTP factor, or nothing),
   * so the loop is closed at its source; rendering the explanation is what makes
   * the remaining cases honest rather than silent.
   */
  useEffect(() => {
    if (!outcome) return;
    if (outcome.kind === 'already-verified') router.replace(destination);
  }, [outcome, destination, router]);

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await redeemMfaRecoveryCodeAction(recoveryCode);
      if ('error' in result) {
        setError(result.error);
        setRecoveryCode('');
        return;
      }
      // The recovery action removes the verified TOTP factor through the Admin
      // API, which signs out the account's other sessions. Do not pretend this
      // session is AAL2: send the user back through sign-in and enrollment.
      setRecoveryReset(true);
    } catch {
      setError('Could not reach the recovery service. Your code is still on screen — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError('');

    /*
     * `try/finally`, not early returns. Every await below used to end with its
     * own `setLoading(false)`, so any *rejection* — a dropped connection, a
     * closed tab's fetch, an SDK throw rather than an `{ error }` — skipped the
     * reset and left the button `disabled` with an empty error box. One dropped
     * packet and the page could never submit again without a reload, which is
     * verbatim the `ContentEditor.handleSave` bug this repo documents.
     */
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError || !factors?.all) {
        setError(factorsError?.message || 'Could not load security factors. Please try again.');
        return;
      }

      // Re-read and filter by type here too, not only in the mount gate. The
      // challenge is a POST-shaped action against live state, and this is the
      // branch that actually calls `verify()`.
      const liveTotpFactors = factors.all.filter(
        (f) => f.status === 'verified' && f.factor_type === TOTP
      );
      if (liveTotpFactors.length === 0) {
        setAvailableFactors([]);
        setSelectedFactorId('');
        setError('This account has no authenticator app enrolled. Add one in Account → Settings.');
        return;
      }

      // Use the authenticator the user chose. If it was removed between the
      // mount read and this submit, fall back to one that still exists and update
      // the selector rather than challenging a dead factor forever.
      const totpFactor =
        liveTotpFactors.find((f) => f.id === selectedFactorId) ?? liveTotpFactors[0];
      setAvailableFactors(
        liveTotpFactors.map((factor) => ({
          id: factor.id,
          friendly_name: factor.friendly_name,
        }))
      );
      setSelectedFactorId(totpFactor.id);

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        setError(verifyError.message);
        // A mistyped code stays in the box otherwise, so the next attempt
        // re-sends a consumed code with no explanation. Clear it and let the
        // volunteer type fresh.
        setCode('');
      } else {
        // GoTrue writes the upgraded AAL2 session to cookies here, so the gate on
        // the destination reads aal2 === aal2 and lets the page through.
        router.replace(destination);
        router.refresh();
      }
    } catch {
      setError(
        'Could not reach the verification service. Your code is still on screen — try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleRecoveryMode() {
    setUseRecoveryCode((value) => !value);
    setError('');
    setCode('');
    setRecoveryCode('');
  }

  return {
    code,
    loading,
    error,
    checking,
    outcome,
    useRecoveryCode,
    recoveryCode,
    recoveryReset,
    availableFactors,
    selectedFactorId,
    destination,
    setCode,
    setRecoveryCode,
    setSelectedFactorId,
    handleRecoverySubmit,
    handleSubmit,
    toggleRecoveryMode,
  };
}
