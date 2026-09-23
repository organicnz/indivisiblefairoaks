'use client';

import {
  ArrowRight,
  Code,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Loader2,
  Lock,
  Shield,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

function getSafeNext(param: string | null): string | null {
  if (!param) return null;
  if (/^\/(?!\/)/.test(param)) return param;
  return null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const targetNext = getSafeNext(searchParams.get('next'));
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

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    const callbackUrl = targetNext
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetNext)}`
      : `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-32 selection:bg-primary selection:text-secondary">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-8 duration-300 ease-out">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-secondary/5 rounded-full mb-8 border border-secondary/5">
            <Shield className="w-3.5 h-3.5 text-secondary" />
            <span className="text-secondary font-black uppercase tracking-[0.4em] text-[10px]">
              {isAdminTarget ? 'Administrative Gateway' : 'Secure Gateway'}
            </span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-secondary uppercase tracking-tighter leading-none mb-6">
            {isSignUp ? 'Join' : 'Welcome'} <br />
            <span className="text-primary italic">{isSignUp ? 'The Crew' : 'Back'}</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[10px] max-w-sm mx-auto">
            {isAdminTarget
              ? 'Authorized access for chapter administrators and organizers'
              : isSignUp
                ? 'Join the community of grassroots organizers'
                : 'Authorized access for returning personnel only'}
          </p>
        </div>

        {/* Admin Gateway Notice Banner */}
        {isAdminTarget && (
          <div className="mb-8 p-4 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-950 text-center animate-in fade-in slide-in-from-top-4 duration-300 ease-out shadow-sm">
            <div className="flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider text-blue-900 mb-1">
              <Shield className="w-4 h-4 text-blue-600" />
              Chapter Administration
            </div>
            <p className="text-xs text-blue-800 font-medium">
              You are accessing an administrative section ({targetNext}). Please authenticate with
              your authorized chapter credentials.
            </p>
          </div>
        )}

        <div className="bg-white border border-slate-100 rounded-[4rem] shadow-[0_40px_100px_-20px_rgba(15,23,42,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 ease-out">
          {/* Method Tabs */}
          <div className="flex p-3 bg-slate-50/50">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('otp');
                setIsSignUp(false);
              }}
              className={`flex-1 py-5 text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-[2rem] flex items-center justify-center gap-3 ${
                authMethod === 'otp'
                  ? 'bg-secondary text-white shadow-xl shadow-secondary/20'
                  : 'text-slate-400 hover:text-secondary'
              }`}
            >
              <Fingerprint size={16} /> Magic Link
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('password')}
              className={`flex-1 py-5 text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-[2rem] flex items-center justify-center gap-3 ${
                authMethod === 'password'
                  ? 'bg-secondary text-white shadow-xl shadow-secondary/20'
                  : 'text-slate-400 hover:text-secondary'
              }`}
            >
              <Lock size={16} /> Password
            </button>
          </div>

          <div className="p-10 md:p-16">
            <form onSubmit={handleAuth} className="space-y-8">
              <div className="space-y-6">
                <div className="group">
                  <label
                    htmlFor="login-email"
                    className="block text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em] ml-1 mb-3 group-focus-within:text-primary transition-colors"
                  >
                    Credential Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="YOUR@EMAIL.ORG"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-primary/20 focus:bg-white focus:border-primary outline-none transition-all font-black text-secondary uppercase tracking-[0.2em] text-xs placeholder:text-slate-300"
                  />
                </div>

                {authMethod === 'password' && (
                  <div className="group animate-in slide-in-from-top-4 duration-500">
                    <div className="flex justify-between items-center ml-1 mb-3">
                      <label
                        htmlFor="login-password"
                        className="block text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em] group-focus-within:text-primary transition-colors"
                      >
                        Access Key
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          className="text-[9px] font-black text-primary uppercase tracking-widest hover:text-secondary transition-colors"
                        >
                          Forgot?
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
                        className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-primary/20 focus:bg-white focus:border-primary outline-none transition-all font-black text-secondary tracking-[0.3em] text-xs placeholder:text-slate-300 pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-secondary transition-colors"
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
                className="w-full bg-secondary text-white font-black rounded-full py-6 hover:bg-primary hover:text-secondary transition-all uppercase tracking-[0.4em] text-xs shadow-2xl shadow-secondary/20 flex items-center justify-center gap-4 group disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span>
                      {authMethod === 'otp'
                        ? 'Initialize Link'
                        : isSignUp
                          ? 'Generate Account'
                          : 'Authenticate'}
                    </span>
                    <ArrowRight
                      size={20}
                      className="group-hover:translate-x-2 transition-transform duration-500"
                    />
                  </>
                )}
              </button>
            </form>

            {message && (
              <div
                className={`mt-10 p-6 rounded-[2rem] border text-[11px] font-bold tracking-wide text-center leading-relaxed animate-in zoom-in-95 duration-500 ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* OAuth Section */}
            <div className="mt-16">
              <div className="flex items-center gap-6 mb-10">
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
                  Satellite Access
                </span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  className="flex items-center justify-center gap-4 py-5 bg-white border border-slate-100 rounded-3xl hover:border-primary hover:bg-slate-50 transition-all text-[10px] font-black text-secondary uppercase tracking-[0.2em] group shadow-sm active:scale-[0.98]"
                >
                  <Globe size={18} className="group-hover:text-primary transition-colors" /> Google
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('github')}
                  className="flex items-center justify-center gap-4 py-5 bg-white border border-slate-100 rounded-3xl hover:border-primary hover:bg-slate-50 transition-all text-[10px] font-black text-secondary uppercase tracking-[0.2em] group shadow-sm active:scale-[0.98]"
                >
                  <Code size={18} className="group-hover:text-primary transition-colors" /> Github
                </button>
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="bg-slate-50/80 p-10 text-center border-t border-slate-100/50">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="group text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] hover:text-secondary transition-all flex items-center justify-center gap-3 mx-auto"
            >
              {isSignUp ? 'Existing Personnel? Sign In' : 'New Recruit? Join The Crew'}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-16 flex items-center justify-center gap-8 opacity-40">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">
              Encryption Active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">
              Supabase v2 Vault
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
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
