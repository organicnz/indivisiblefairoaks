'use client';

import { CheckCircle, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { updatePasswordAction } from './actions';

export default function UpdatePasswordPage() {
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

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Supabase sends the user here after exchanging the reset code via the
  // auth callback. By the time this page loads the session is already set.
  useEffect(() => {
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
    if (!sessionReady) return;
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

  if (!sessionReady || needsStepUp === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (needsStepUp) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 pt-(--header-h) pb-16">
        <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
          <div className="p-4 bg-primary/10 text-primary rounded-2xl mb-6 inline-flex">
            <ShieldCheck size={28} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-secondary uppercase tracking-tight mb-3">
            Confirm it&apos;s you
          </h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            This account has two-factor authentication, so changing the password needs a
            verification code first. It is the same check that protects your account settings.
          </p>
          <button
            type="button"
            onClick={() => router.push('/auth/mfa?next=/account/update-password')}
            className="w-full bg-secondary text-white font-black rounded-full py-5 hover:bg-primary transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-secondary/10"
          >
            Enter verification code
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 pt-(--header-h) pb-16">
        <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle className="w-10 h-10 text-emerald-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-secondary uppercase tracking-tight mb-3">
            Password Updated
          </h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            Your password has been changed successfully. You can now sign in with your new
            credentials.
          </p>
          <button
            type="button"
            onClick={() => router.push('/account')}
            className="w-full bg-secondary text-white font-black rounded-full py-5 hover:bg-primary transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-secondary/10"
          >
            Go to Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 px-5 py-2 bg-secondary/5 rounded-full mb-6 border border-secondary/5">
            <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
            <span className="text-secondary font-black uppercase tracking-[0.4em] text-[10px]">
              Secure Reset
            </span>
          </div>
          <h1 className="text-4xl font-black text-secondary uppercase tracking-tighter leading-none mb-3">
            New <span className="text-primary italic">Password</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[10px]">
            Choose a strong password for your account
          </p>
        </div>

        <div className="bg-white border border-slate-100 rounded-[3rem] shadow-[0_20px_60px_-10px_rgba(15,23,42,0.08)] overflow-hidden">
          <form onSubmit={handleSubmit} className="p-10 space-y-6">
            {/* New Password */}
            <div className="group">
              <label
                htmlFor="new-password"
                className="block text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em] ml-1 mb-3 group-focus-within:text-primary transition-colors"
              >
                New Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors pointer-events-none"
                  size={16}
                />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full pl-12 pr-12 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-primary/20 focus:bg-white focus:border-primary outline-none transition-all font-bold text-secondary text-sm placeholder:text-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="group">
              <label
                htmlFor="confirm-password"
                className="block text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em] ml-1 mb-3 group-focus-within:text-primary transition-colors"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors pointer-events-none"
                  size={16}
                />
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat your password"
                  className="w-full pl-12 pr-12 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-primary/20 focus:bg-white focus:border-primary outline-none transition-all font-bold text-secondary text-sm placeholder:text-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={
                    showConfirm ? 'Hide password confirmation' : 'Show password confirmation'
                  }
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-secondary transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Match indicator */}
              {confirm.length > 0 && (
                <p
                  className={`mt-2 ml-1 text-[10px] font-black uppercase tracking-widest ${password === confirm ? 'text-emerald-500' : 'text-rose-500'}`}
                >
                  {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Error message. `role="alert"` because a rejected password change
                was rendered as a red box with no announcement, and it is the one
                thing on this page a screen-reader user must not miss. */}
            {status === 'error' && (
              <div
                role="alert"
                className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center"
              >
                ❌ {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-secondary text-white font-black rounded-full py-5 hover:bg-primary transition-all uppercase tracking-[0.3em] text-xs shadow-xl shadow-secondary/10 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
            >
              {status === 'loading' ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                'Set New Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
