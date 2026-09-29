'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { getTotpEnrollmentUri } from '@/lib/mfa';
import { createClient } from '@/lib/supabase';

export function MfaSettings() {
  const [enrolling, setEnrolling] = useState(false);
  const [totpUri, setTotpUri] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: factors = [], isLoading } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.all || [];
    },
  });

  async function startEnrollment() {
    try {
      setError('');

      // Check if an unverified factor already exists and remove it to avoid conflicts
      const existingUnverified = (factors || []).find((f) => f.status === 'unverified');
      if (existingUnverified) {
        await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id });
      }

      setEnrolling(true);
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Indivisible Fair Oaks',
        friendlyName: 'Default',
      });

      if (error) {
        setError(error.message);
        setEnrolling(false);
      } else if (data) {
        const uri = getTotpEnrollmentUri(data.totp);
        if (!uri) {
          setError('The authenticator enrollment URI was missing. Please try again.');
          setEnrolling(false);
          return;
        }
        setFactorId(data.id);
        setTotpUri(uri);
      }
    } catch (err) {
      console.error('MFA Enrollment error:', err);
      setError('An unexpected error occurred. Please try again.');
      setEnrolling(false);
    }
  }

  async function verifyEnrollment() {
    setError('');
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) {
      setError(error.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: data.id,
      code: verifyCode,
    });

    if (verifyError) {
      setError(verifyError.message);
    } else {
      setSuccess('2FA enabled successfully!');
      setEnrolling(false);
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
    }
  }

  async function unenrollFactor(id: string) {
    if (!confirm('Are you sure you want to disable 2FA?')) return;

    setError('');
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('2FA disabled.');
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
    }
  }

  if (isLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const activeFactor = factors.find((f) => f.status === 'verified');

  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm p-8 mt-12">
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`p-3 rounded-2xl ${activeFactor ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}
        >
          {activeFactor ? <ShieldCheck size={24} /> : <Shield size={24} />}
        </div>
        <div>
          <h3 className="text-lg font-black text-secondary uppercase tracking-tight">
            Two-Factor Authentication
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            Secure your account with TOTP
          </p>
        </div>
      </div>

      {activeFactor ? (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                2FA is currently active
              </p>
            </div>
            <button
              type="button"
              onClick={() => unenrollFactor(activeFactor.id)}
              className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Add an extra layer of security to your account. When enabled, you will be asked for a
            verification code from your mobile device when signing in.
          </p>
          <Button onClick={startEnrollment} variant="secondary">
            Enable 2FA
          </Button>
        </div>
      )}

      <Dialog open={enrolling} onOpenChange={setEnrolling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable 2FA</DialogTitle>
            <DialogDescription>Secure your account with TOTP</DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">
            <div className="flex flex-col items-center gap-6 p-6 bg-slate-50 rounded-4xl border border-slate-100">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-h-[212px] flex items-center justify-center">
                {totpUri ? (
                  <QRCodeSVG value={totpUri} size={180} title="Authenticator enrollment QR code" />
                ) : (
                  <Loader2 className="animate-spin text-slate-300" size={32} />
                )}
              </div>
              <p className="text-[10px] text-slate-400 text-center font-black uppercase tracking-widest max-w-xs leading-relaxed">
                Scan this QR code with your authenticator app
              </p>
            </div>

            <div className="space-y-4">
              <label
                htmlFor="mfa-code"
                className="block text-[10px] font-black text-secondary uppercase tracking-widest ml-1"
              >
                Verification Code
              </label>
              <div className="flex flex-col gap-4">
                <input
                  id="mfa-code"
                  type="text"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-black text-secondary tracking-[0.5em] text-center text-xl"
                />
                <Button onClick={verifyEnrollment} className="w-full">
                  Verify & Activate
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Both MFA outcomes were silent: a failed code produced no announcement
          at all. `role="alert"` interrupts, `role="status"` is polite. */}
      {error && (
        <div
          role="alert"
          className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-accent-red"
        >
          <ShieldAlert size={18} aria-hidden="true" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700"
        >
          <ShieldCheck size={18} aria-hidden="true" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}
    </div>
  );
}
