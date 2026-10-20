'use client';

import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { getSafeNextPath } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase';

/**
 * Why the page decided not to show a code box.
 *
 * The two "bounce" outcomes were both `router.push('/login')` / `push('/account')`
 * with no message, which is how a `listFactors` failure turned into four silent
 * hops: /auth/mfa → /login → (middleware sees a session) → /account → (gate
 * fires again) → /auth/mfa. Nothing named the cause and nothing could be
 * retried. Naming the outcome is what breaks the loop — the user can act on it.
 */
type GateOutcome =
  | { kind: 'challenge' }
  | { kind: 'already-verified' }
  | { kind: 'no-factor'; factorTypes: string[] }
  | { kind: 'no-session' }
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

/**
 * Exported named as well as through the default wrapper so the gate and submit
 * paths are testable without a Suspense boundary — the component itself is the
 * unit under test, the wrapper is three lines of plumbing.
 */
export function MfaChallengePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [outcome, setOutcome] = useState<GateOutcome | null>(null);
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
  const supabase = useMemo(() => createClient(), []);

  // Where to go once the session is AAL2. `getSafeNextPath` is the same guard
  // the login page and middleware use, so `?next=` cannot become an open
  // redirect by way of the challenge page.
  const destination = getSafeNextPath(searchParams.get('next'), '/account') ?? '/account';

  useEffect(() => {
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
        setOutcome({ kind: 'no-factor', factorTypes: [] });
        setChecking(false);
        return;
      }

      // `factor_type` is load-bearing here. `listFactors().all` mixes totp,
      // phone and webauthn; picking the first verified factor of *any* type and
      // rendering a TOTP box means a phone factor gets an SMS and the typed
      // digits then fail verification permanently, with no explanation. Say what
      // the account actually has instead.
      if (!verified.some((f) => f.factor_type === TOTP)) {
        setOutcome({ kind: 'no-factor', factorTypes: factorTypesOf(factors?.all ?? []) });
        setChecking(false);
        return;
      }

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
    if (outcome.kind === 'no-session') router.replace('/login');
  }, [outcome, destination, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      const totpFactor = factors.all.find((f) => f.status === 'verified' && f.factor_type === TOTP);
      if (!totpFactor) {
        setError('This account has no authenticator app enrolled. Add one in Account → Settings.');
        return;
      }

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

  // `already-verified` and `no-session` have nothing to render: the redirect
  // effect above is already navigating. Falling through to the form instead is
  // how a user who is *already* AAL2 could be shown a code box for a step-up
  // they do not need — the redirect is a navigation, not an instant state
  // change, so the form would be interactive on the way out.
  if (checking || !outcome || outcome.kind === 'already-verified' || outcome.kind === 'no-session')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2
          className="animate-spin text-primary dark:text-primary-on-dark"
          aria-label="Checking your security status"
        />
      </div>
    );

  if (outcome.kind === 'unreadable') {
    return (
      <Shell
        heading={
          <DataPoint as="span" name="auth.mfa.unreadable_heading">
            We could not check your security status
          </DataPoint>
        }
        tone="error"
        icon={<ShieldAlert size={32} aria-hidden="true" />}
      >
        <p className="text-muted-foreground mb-8 font-medium leading-relaxed">
          <DataPoint as="span" name="auth.mfa.unreadable_desc">
            Your sign-in worked, but we could not read your authenticator setup. Nothing has been
            changed and nothing is locked.
          </DataPoint>
        </p>
        <p className="text-xs text-muted-foreground font-medium mb-10 break-words">
          {outcome.detail}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light text-white font-black rounded-full py-5 uppercase tracking-[0.2em] text-sm transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
        >
          <DataPoint as="span" name="auth.mfa.unreadable_btn_retry">
            Try again
          </DataPoint>
        </button>
        <p className="mt-6 text-xs text-muted-foreground font-medium">
          <DataPoint as="span" name="auth.mfa.unreadable_help">
            Still failing? Sign out and back in.
          </DataPoint>{' '}
          <a
            href="/account?tab=settings"
            className="text-primary dark:text-primary-on-dark font-bold underline"
          >
            <DataPoint as="span" name="auth.mfa.unreadable_link_settings">
              Account settings
            </DataPoint>
          </a>
        </p>
      </Shell>
    );
  }

  if (outcome.kind === 'no-factor') {
    return (
      <Shell
        heading={
          <DataPoint as="span" name="auth.mfa.no_factor_heading">
            No authenticator app is set up
          </DataPoint>
        }
        tone="error"
        icon={<ShieldAlert size={32} aria-hidden="true" />}
      >
        <p className="text-muted-foreground mb-8 font-medium leading-relaxed">
          <DataPoint as="span" name="auth.mfa.no_factor_desc">
            This account cannot ask for a verification code, so there is nothing to enter here.
          </DataPoint>
        </p>
        <p className="text-sm text-muted-foreground font-medium mb-10">
          {outcome.factorTypes.length > 0 ? (
            <>
              This account has a{' '}
              <strong className="text-foreground">
                {outcome.factorTypes.join(', ').toUpperCase()}
              </strong>{' '}
              factor enrolled. This site can only complete the check with an authenticator app (a
              code from Google Authenticator, 1Password, Authy and similar).
            </>
          ) : (
            <>
              Set one up in{' '}
              <strong className="text-foreground">
                Account → Settings → Two-Factor Authentication
              </strong>
              .
            </>
          )}
        </p>
        <a
          href="/account?tab=settings"
          className="inline-flex w-full items-center justify-center bg-primary dark:bg-primary-bright text-white font-black rounded-full py-5 uppercase tracking-[0.2em] text-sm transition-all hover:bg-primary-dark dark:hover:bg-primary-light"
        >
          <DataPoint as="span" name="auth.mfa.no_factor_btn_settings">
            Go to account settings
          </DataPoint>
        </a>
      </Shell>
    );
  }

  return (
    <Shell
      heading={
        <DataPoint as="span" name="auth.mfa.challenge_heading">
          Security Check
        </DataPoint>
      }
      tone="normal"
      icon={<ShieldCheck size={32} aria-hidden="true" />}
    >
      <p className="text-muted-foreground mb-10 font-medium leading-relaxed">
        <DataPoint as="span" name="auth.mfa.challenge_desc">
          Please enter the verification code from your authenticator app to continue.
        </DataPoint>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="text-left">
          <label
            htmlFor="code"
            className="block text-[10px] font-black text-foreground uppercase tracking-widest mb-2 ml-1"
          >
            <DataPoint as="span" name="auth.mfa.challenge_code_label">
              6-Digit Code
            </DataPoint>
          </label>
          <input
            type="text"
            id="code"
            placeholder="000000"
            value={code}
            /*
             * Strip everything that is not a digit, before the length cap.
             * A pasted `"123 456"` used to truncate to `"123 45"` at
             * `maxLength={6}` and fail with GoTrue's raw message; the space
             * also made `code.length < 6` on the button disagree with what
             * the user saw. Authenticator codes are six digits and nothing
             * else, so there is nothing to preserve by being lenient here.
             */
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoFocus
            // `numeric` is what makes iOS and Android show a numeric keypad.
            // Without it the keyboard is alphabetical and the code arrives wrong.
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'mfa-error' : undefined}
            className="w-full px-5 py-4 bg-surface-muted dark:bg-slate-800/80 border border-border rounded-2xl focus:ring-2 focus:ring-primary dark:focus:ring-primary-bright outline-none text-center font-black text-foreground tracking-[0.5em] text-lg"
          />
        </div>
        <button
          type="submit"
          disabled={loading || code.length < 6}
          aria-busy={loading}
          className="w-full bg-primary dark:bg-primary-bright text-white font-black rounded-full py-5 hover:bg-primary-dark dark:hover:bg-primary-light transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20 disabled:opacity-50"
        >
          {loading ? (
            <DataPoint as="span" name="auth.mfa.challenge_btn_verifying">
              Verifying...
            </DataPoint>
          ) : (
            <DataPoint as="span" name="auth.mfa.challenge_btn_verify">
              Verify & Continue
            </DataPoint>
          )}
        </button>
        {/*
          Static, not a countdown. A live timer needs an interval that survives
          tab throttling and a code that is consumed on submit — both real states,
          neither worth a component for. The failure it prevents is the common
          one: a mistyped code sits in the box for a minute, the next attempt
          sends a consumed code, and GoTrue answers with "invalid" for a code the
          user never typed.
        */}
        <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-medium">
          <DataPoint as="span" name="auth.mfa.challenge_code_hint">
            Codes change every 30 seconds — type the one showing now.
          </DataPoint>
        </p>
      </form>

      {/*
        `role="alert"` plus `aria-describedby` on the input. The error was
        rendered but never associated, so a screen reader heard "code" and then
        nothing about why the code was rejected.
      */}
      {error && (
        <div
          id="mfa-error"
          role="alert"
          className="mt-8 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-left"
        >
          <ShieldAlert size={18} aria-hidden="true" className="shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest break-words">{error}</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  heading,
  icon,
  tone,
  children,
}: {
  heading: React.ReactNode;
  icon: React.ReactNode;
  tone: 'normal' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden min-h-[80vh] bg-background flex items-center justify-center px-4 pt-(--header-h) pb-16 text-foreground transition-colors duration-300">
      <VgpuCivicConstellation className="pointer-events-none opacity-25" />
      <div className="relative z-10 max-w-md w-full bg-surface-card p-10 rounded-3xl shadow-raised text-center border border-border backdrop-blur-md">
        <div className="flex flex-col items-center mb-8">
          <div
            className={`p-4 rounded-2xl mb-4 ${tone === 'error' ? 'bg-rose-50 dark:bg-rose-950/50 text-accent-red' : 'bg-primary/10 text-primary dark:text-primary-on-dark'}`}
          >
            {icon}
          </div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight mb-2">
            {heading}
          </h1>
          <div
            className={`h-1.5 w-16 ${tone === 'error' ? 'bg-accent-red' : 'bg-primary dark:bg-primary-bright'}`}
          />
        </div>
        {children}
      </div>
    </div>
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
        <div className="min-h-screen flex items-center justify-center">
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
