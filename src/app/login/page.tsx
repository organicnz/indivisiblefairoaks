'use client';

import { ArrowRight, Eye, EyeOff, Fingerprint, Loader2, Lock, Shield } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { getSafeNextPath } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase';

function LoginForm() {
  const { dataPoints } = useDataPoints('login');
  const searchParams = useSearchParams();
  const targetNext = getSafeNextPath(searchParams.get('next'));
  const isAdminTarget = Boolean(targetNext?.startsWith('/admin'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  // Check URL error parameters on mount
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'Invalid_Token') {
      setMessage({
        type: 'error',
        text: '❌ Sign-in link is invalid or expired. Please request a new magic link below.',
      });
    } else if (errorParam === 'admin_required') {
      setMessage({
        type: 'error',
        text: '❌ Administrator credentials required. Please sign in with an authorized chapter administrator email.',
      });
    } else if (errorParam) {
      setMessage({
        type: 'error',
        text: `❌ ${errorParam.replace(/_/g, ' ')}`,
      });
    }
  }, [searchParams]);

  // If already authenticated, redirect to destination
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push(targetNext || '/account');
      }
    });
  }, [supabase, router, targetNext]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const callbackUrl = targetNext
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetNext)}`
      : `${window.location.origin}/auth/callback`;

    try {
      if (authMethod === 'otp') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: callbackUrl,
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: `✅ A secure sign-in link has been sent to ${email}. Click the button in your email to authenticate.`,
        });
      } else {
        if (isSignUp) {
          // Match the reset flow's 8-char minimum for new passwords.
          // Sign-in is deliberately unchecked: existing short passwords
          // must keep working.
          if (password.length < 8) {
            setMessage({ type: 'error', text: '❌ Password must be at least 8 characters.' });
            setLoading(false);
            return;
          }
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: callbackUrl,
            },
          });
          if (error) throw error;
          setMessage({
            type: 'success',
            text: '✅ Account created! Please check your email to verify.',
          });
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          router.push(targetNext || '/account');
          router.refresh();
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setMessage({ type: 'error', text: `❌ ${error.message}` });
      } else {
        setMessage({ type: 'error', text: '❌ An unknown error occurred.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // OAuth is currently unavailable: no provider is enabled on the hosted
  // Supabase project (every /authorize probe reports unsupported/disabled),
  // so signInWithOAuth cannot complete. To re-enable: turn on the Google
  // provider in the Supabase dashboard, verify /authorize, then restore a
  // button below calling supabase.auth.signInWithOAuth({ provider: 'google',
  // options: { redirectTo: callbackUrl } }). Until then there is deliberately
  // no third-party button — a control must do what it says.

  const handleResetPassword = async () => {
    if (!email) {
      setMessage({ type: 'error', text: '❌ Please enter your email address first.' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/update-password`,
    });

    if (error) {
      setMessage({ type: 'error', text: `❌ ${error.message}` });
    } else {
      setMessage({ type: 'success', text: '✅ Password reset link sent to your email.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-32 selection:bg-primary selection:text-secondary">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-8 duration-300 ease-out">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-secondary/5 rounded-full mb-8 border border-secondary/5">
            <Shield className="w-3.5 h-3.5 text-foreground" />
            <span className="text-foreground font-black uppercase tracking-[0.4em] text-[10px]">
              <DataPoint
                initialData={dataPoints}
                name={isAdminTarget ? 'login.gateway.admin' : 'login.gateway.secure'}
              >
                {isAdminTarget ? 'Administrative Gateway' : 'Secure Gateway'}
              </DataPoint>
            </span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-foreground uppercase tracking-tighter leading-none mb-6">
            <DataPoint
              initialData={dataPoints}
              name={isSignUp ? 'login.title.join' : 'login.title.welcome'}
            >
              {isSignUp ? 'Join' : 'Welcome'}
            </DataPoint>{' '}
            <br />
            <span className="text-primary dark:text-primary-on-dark italic">
              <DataPoint
                initialData={dataPoints}
                name={isSignUp ? 'login.title.sub_join' : 'login.title.sub_back'}
              >
                {isSignUp ? 'The Crew' : 'Back'}
              </DataPoint>
            </span>
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.15em] text-[10px] max-w-sm mx-auto">
            <DataPoint
              initialData={dataPoints}
              name={
                isAdminTarget
                  ? 'login.desc.admin'
                  : isSignUp
                    ? 'login.desc.signup'
                    : 'login.desc.login'
              }
            >
              {isAdminTarget
                ? 'Authorized access for chapter administrators and organizers'
                : isSignUp
                  ? 'Join the community of grassroots organizers'
                  : 'Authorized access for returning personnel only'}
            </DataPoint>
          </p>
        </div>

        {/* Admin Gateway Notice Banner */}
        {isAdminTarget && (
          <div className="mb-8 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-950 dark:text-blue-200 text-center animate-in fade-in slide-in-from-top-4 duration-300 ease-out shadow-sm">
            <div className="flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider text-blue-900 dark:text-blue-200 mb-1">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <DataPoint initialData={dataPoints} name="login.notice.admin_title">
                Chapter Administration
              </DataPoint>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
              <DataPoint initialData={dataPoints} name="login.notice.admin_body">
                You are accessing an administrative section ({targetNext}). Please authenticate with
                your authorized chapter credentials.
              </DataPoint>
            </p>
          </div>
        )}

        <div className="bg-surface-card border border-border rounded-[4rem] shadow-[0_40px_100px_-20px_rgba(15,23,42,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 ease-out">
          {/*
            These were two plain buttons with no role and no selected state, so
            the active auth method was conveyed by background colour alone. They
            now form a tablist, matching the pattern already implemented in
            AccountTabs.tsx.
          */}
          <div role="tablist" aria-label="Sign-in method" className="flex p-3 bg-surface-muted/50">
            <button
              type="button"
              role="tab"
              id="auth-tab-otp"
              aria-selected={authMethod === 'otp'}
              aria-controls="auth-panel"
              tabIndex={authMethod === 'otp' ? 0 : -1}
              onClick={() => {
                setAuthMethod('otp');
                setIsSignUp(false);
              }}
              className={`flex-1 min-h-11 py-5 text-xs font-black uppercase tracking-[0.2em] transition-colors duration-300 ease-out rounded-xl flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                authMethod === 'otp'
                  ? 'bg-secondary text-white dark:bg-primary dark:text-white shadow-xl shadow-secondary/20 border border-white/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Fingerprint size={16} aria-hidden="true" />{' '}
              <DataPoint initialData={dataPoints} name="login.tab.otp">
                Magic Link
              </DataPoint>
            </button>
            <button
              type="button"
              role="tab"
              id="auth-tab-password"
              aria-selected={authMethod === 'password'}
              aria-controls="auth-panel"
              tabIndex={authMethod === 'password' ? 0 : -1}
              onClick={() => setAuthMethod('password')}
              className={`flex-1 min-h-11 py-5 text-xs font-black uppercase tracking-[0.2em] transition-colors duration-300 ease-out rounded-xl flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                authMethod === 'password'
                  ? 'bg-secondary text-white dark:bg-primary dark:text-white shadow-xl shadow-secondary/20 border border-white/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Lock size={16} aria-hidden="true" />{' '}
              <DataPoint initialData={dataPoints} name="login.tab.password">
                Password
              </DataPoint>
            </button>
          </div>

          <div
            id="auth-panel"
            role="tabpanel"
            aria-labelledby={authMethod === 'otp' ? 'auth-tab-otp' : 'auth-tab-password'}
            className="p-10 md:p-16"
          >
            <form onSubmit={handleAuth} className="space-y-8">
              <div className="space-y-6">
                <div className="group">
                  <label
                    htmlFor="login-email"
                    className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-1 mb-3 group-focus-within:text-primary dark:text-primary-on-dark transition-colors"
                  >
                    <DataPoint initialData={dataPoints} name="login.form.email_label">
                      Credential Email
                    </DataPoint>
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="YOUR@EMAIL.ORG"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-8 py-5 bg-surface-muted border border-border rounded-3xl focus:ring-4 focus:ring-primary/20 focus:bg-surface-card focus:border-primary outline-none transition-all font-black text-foreground uppercase tracking-[0.2em] text-xs placeholder:text-muted-foreground"
                  />
                </div>

                {authMethod === 'password' && (
                  <div className="group animate-in slide-in-from-top-4 duration-500">
                    <div className="flex justify-between items-center ml-1 mb-3">
                      <label
                        htmlFor="login-password"
                        className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] group-focus-within:text-primary dark:text-primary-on-dark transition-colors"
                      >
                        <DataPoint initialData={dataPoints} name="login.form.password_label">
                          Access Key
                        </DataPoint>
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          className="text-[9px] font-black text-primary dark:text-primary-on-dark uppercase tracking-widest hover:text-foreground transition-colors"
                        >
                          <DataPoint initialData={dataPoints} name="login.form.forgot_btn">
                            Forgot?
                          </DataPoint>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-8 py-5 bg-surface-muted border border-border rounded-3xl focus:ring-4 focus:ring-primary/20 focus:bg-surface-card focus:border-primary outline-none transition-all font-black text-foreground tracking-[0.3em] text-xs placeholder:text-muted-foreground pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-secondary text-white dark:bg-primary-bright dark:hover:bg-primary-light font-black rounded-full py-6 hover:bg-primary transition-all uppercase tracking-[0.4em] text-xs shadow-2xl shadow-secondary/20 border border-white/10 flex items-center justify-center gap-4 group disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span>
                      <DataPoint
                        initialData={dataPoints}
                        name={
                          authMethod === 'otp'
                            ? 'login.btn.otp'
                            : isSignUp
                              ? 'login.btn.signup'
                              : 'login.btn.login'
                        }
                      >
                        {authMethod === 'otp'
                          ? 'Initialize Link'
                          : isSignUp
                            ? 'Generate Account'
                            : 'Authenticate'}
                      </DataPoint>
                    </span>
                    <ArrowRight
                      size={20}
                      className="group-hover:translate-x-2 transition-transform duration-500"
                    />
                  </>
                )}
              </button>
            </form>

            {/* `role="alert"` for failures, `role="status"` for success: without
                one of these the sign-in result was announced to nobody. */}
            {message && (
              <div
                role={message.type === 'success' ? 'status' : 'alert'}
                className={`mt-10 p-6 rounded-xl border text-sm font-medium text-center leading-relaxed motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-out ${
                  message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-accent-red dark:text-rose-400'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* No third-party sign-in is offered: no OAuth provider is enabled
                server-side (see the OAuth note above). Magic link and password
                are the available methods. */}
          </div>

          {/* Footer Action */}
          <div className="bg-surface-muted/80 p-10 text-center border-t border-border/50">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="group text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] hover:text-foreground transition-all flex items-center justify-center gap-3 mx-auto"
            >
              <DataPoint
                initialData={dataPoints}
                name={isSignUp ? 'login.footer.switch_login' : 'login.footer.switch_signup'}
              >
                {isSignUp ? 'Existing Personnel? Sign In' : 'New Recruit? Join The Crew'}
              </DataPoint>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Security Badges — muted ink rather than a container opacity: an
            opacity on the wrapper multiplied the label down to 2.5:1 on white
            and 2.9:1 on the dark page, in both modes. */}
        <div className="mt-16 flex items-center justify-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              <DataPoint initialData={dataPoints} name="login.badge.encryption">
                Encryption Active
              </DataPoint>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              <DataPoint initialData={dataPoints} name="login.badge.vault">
                Supabase v2 Vault
              </DataPoint>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
