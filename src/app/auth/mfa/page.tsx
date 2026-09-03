'use client';

import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function MfaChallengePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAal() {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        router.push('/login');
        return;
      }

      if (data.nextLevel === data.currentLevel) {
        router.push('/account');
      } else if (data.nextLevel === 'aal1') {
        router.push('/account');
      }
      setChecking(false);
    }
    checkAal();
    // supabase and router are stable refs — intentionally omitted to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError || !factors?.all) {
      setError(factorsError?.message || 'Could not load security factors. Please try again.');
      setLoading(false);
      return;
    }

    const totpFactor = factors.all.find((f) => f.status === 'verified');
    if (!totpFactor) {
      router.push('/account');
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });

    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
    } else {
      router.push('/account');
    }
  }

  if (checking)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-[80vh] bg-white flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-primary/10 text-primary rounded-2xl mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-secondary uppercase tracking-tight mb-2">
            Security Check
          </h1>
          <div className="h-1.5 w-16 bg-primary" />
        </div>

        <p className="text-slate-600 mb-10 font-medium leading-relaxed">
          Please enter the verification code from your authenticator app to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-left">
            <label
              htmlFor="code"
              className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2 ml-1"
            >
              6-Digit Code
            </label>
            <input
              type="text"
              id="code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-center font-black text-secondary tracking-[0.5em] text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-secondary text-white font-black rounded-full py-5 hover:bg-primary transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-secondary/10 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-left">
            <ShieldAlert size={18} />
            <p className="text-xs font-black uppercase tracking-widest">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
