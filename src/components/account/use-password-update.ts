'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useDataPoints } from '@/hooks/useDataPoints';
import { createClient } from '@/lib/supabase';
import { updatePasswordAction } from '@/app/account/update-password/actions';

export function usePasswordUpdate() {
  const { dataPoints } = useDataPoints('account');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  /**
   * `false` = step-up not required, `true` = required and not yet satisfied,
   * `null` = not yet known. `null` is not `false`: rendering the form before the
   * answer arrives would let a user type a new password into a form that is
   * about to be replaced by a challenge, and their input is lost.
   */
  const [needsStepUp, setNeedsStepUp] = useState<boolean | null>(null);

  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? createClient() : null),
    []
  );
  const router = useRouter();

  // Supabase sends the user here after exchanging the reset code via the
  // auth callback. By the time this page loads the session is already set.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        // No session — the link may have expired or already been used
        router.replace('/login?error=reset_link_expired');
      }
    });
  }, [supabase, router]);

  /**
   * Step-up gate for the password change itself — UX, not enforcement.
   *
   * Enforcement lives in `updatePasswordAction`, which runs `assertMfaVerified`
   * on the server before writing. This effect exists so the volunteer is
   * directed to the challenge *before* typing a new password into a form that is
   * about to be replaced — typed input lost to a redirect is the thing being
   * prevented, not the write itself.
   *
   * Only *enrolled* accounts are gated, matching the guard: an account with no
   * verified TOTP factor has nothing to check against and must not be told to
   * find an authenticator it never set up. The `?next=` returns here so the
   * volunteer lands back on this form, not on their dashboard.
   *
   * The AAL read comes first and `listFactors()` second, on purpose. AAL here is
   * the cookie snapshot, which can be stale in both directions — so a stale
   * "aal1" sends the volunteer to the challenge unnecessarily (annoying, safe),
   * while a stale "aal2" shows the form and the server action refuses the write
   * with `step_up_required`, which `handleSubmit` turns into the same prompt.
   * Either order fails safe; only one of them fails *kindly* for the common
   * case, which is why the live factor read is the second question, not the
   * first.
   */
  useEffect(() => {
    if (!sessionReady || !supabase) return;
    let cancelled = false;

    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (aal?.currentLevel === 'aal2' || aal?.nextLevel !== 'aal2') {
        setNeedsStepUp(false);
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      setNeedsStepUp(
        Boolean(factors?.all?.some((f) => f.status === 'verified' && f.factor_type === 'totp'))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionReady, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setStatus('error');
      return;
    }

    if (password !== confirm) {
      setMessage('Passwords do not match.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');

    /*
     * The write goes through the server action, not `supabase.auth.updateUser`
     * directly — that call is a `PUT /auth/v1/user` authorised by the access
     * token alone, and an AAL1 session that never rendered this component could
     * always call it. The `reason` on a refusal is what lets this page tell a
     * step-up request from a fault, instead of showing one string for both.
     */
    try {
      const result = await updatePasswordAction(password);
      if (!('error' in result)) {
        setStatus('success');
        return;
      }
      if (result.reason === 'step_up_required') {
        // The cookie said AAL2 and the server disagreed, or the session lost its
        // step-up between the gate effect and the submit. Show the prompt the
        // gate would have shown rather than an error box for a code request.
        setNeedsStepUp(true);
        return;
      }
      setMessage(result.error);
      setStatus('error');
    } catch {
      setMessage('Could not reach the service. Your new password was not saved — try again.');
      setStatus('error');
    }
  };

  return {
    dataPoints,
    password,
    setPassword,
    confirm,
    setConfirm,
    showPassword,
    setShowPassword,
    showConfirm,
    setShowConfirm,
    status,
    message,
    sessionReady,
    needsStepUp,
    handleSubmit,
    goToAccount: () => router.push('/account'),
    goToChallenge: () => router.push('/auth/mfa?next=/account/update-password'),
  };
}
