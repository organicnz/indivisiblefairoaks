'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { SITE_NAME } from '@/config/site';
import { unenrollMfaFactorAction } from '@/lib/actions/settings';
import { getTotpEnrollmentUri } from '@/lib/mfa';
import { createClient } from '@/lib/supabase';

/**
 * Grouped base32 → four-character chunks, for reading a secret aloud or typing
 * it into an app by hand. The canonical encoding omits padding; Supabase returns
 * an unpadded secret, but a hand-typed one is often written in blocks.
 */
function groupSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}

interface Factor {
  id: string;
  status: string;
  factor_type: string;
  friendly_name?: string;
}

export function MfaSettings() {
  const [enrolling, setEnrolling] = useState(false);
  const [totpUri, setTotpUri] = useState('');
  const totpSecret = totpSecretFromUri(totpUri);
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [error, setError] = useState('');
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [verifying, setVerifying] = useState(false);

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
      // A step-up link belongs to a removal refusal, not to an enrollment
      // error. Without this, a failed enroll after a refused removal would
      // show the link under the wrong message.
      setErrorReason(null);
      setSuccess('');
      setVerifyCode('');
      setShowManualEntry(false);
      setCopyState('idle');

      // Clear a stale unverified factor first. Supabase allows only one
      // in-progress enrollment per user, so a second `enroll()` without this
      // fails with "A factor with this type already exists" — and the panel used
      // to report that as a generic enrollment error.
      const existingUnverified = (factors || []).find((f) => f.status === 'unverified');
      if (existingUnverified) {
        const { error: clearError } = await supabase.auth.mfa.unenroll({
          factorId: existingUnverified.id,
        });
        if (clearError) {
          setError(
            'A previous setup was left unfinished and could not be cleared. Try again in a moment.'
          );
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      }

      setEnrolling(true);
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        // From `site.ts`, not a literal. The issuer is the label every user sees
        // in their authenticator app; the hardcoded short form meant the app
        // disagreed with the site's own name, and nothing detected that.
        issuer: SITE_NAME,
        // A friendly name is what distinguishes two factors on this panel. With
        // more than one enrolled, "Default" twice is not a distinction.
        friendlyName: nextFactorLabel(factors || []),
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

  function closeDialog() {
    setEnrolling(false);
    setTotpUri('');
    setVerifyCode('');
    setShowManualEntry(false);
    setCopyState('idle');
    // Abandoning the dialog leaves an unverified factor in the database holding
    // the only way into this account until someone clears it. Clearing it here
    // means "Cancel" means what it says. `startEnrollment` also clears one, so
    // this is belt and braces rather than the only path.
    if (factorId) void supabase.auth.mfa.unenroll({ factorId });
    setFactorId('');
  }

  async function verifyEnrollment() {
    setError('');
    setErrorReason(null);
    setSuccess('');
    setVerifying(true);
    try {
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
        setTotpUri('');
        setFactorId('');
        await queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      }
    } catch (err) {
      // The verification path used to have no `catch`, so a dropped connection
      // rejected an unhandled promise, `verifying` stayed true, and the button
      // was disabled for the rest of the session — with the panel's own error
      // box empty, so there was nothing to explain it.
      console.error('MFA verification error:', err);
      setError('Could not reach the verification service. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }

  /*
   * Removal of a *verified* factor goes through the server action, not
   * `supabase.auth.mfa.unenroll` directly. That call is authorised by the
   * session alone, so an AAL1 session holding only a stolen password could
   * permanently remove the account's 2FA — and unlike a password rotation the
   * victim cannot undo it.
   *
   * Clearing an *unverified* factor stays client-side (`startEnrollment`'s
   * cleanup, the dialog-cancel path): an unverified factor is not a way in, so
   * removing one cannot reduce the account's security.
   */
  async function unenrollFactor(id: string) {
    setError('');
    setErrorReason(null);
    setSuccess('');
    try {
      const result = await unenrollMfaFactorAction(id);
      if ('error' in result) {
        setError(result.error);
        setErrorReason(result.reason ?? null);
      } else {
        setSuccess('Authenticator removed.');
        await queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      }
    } catch {
      setError('Could not reach the service. Nothing was removed — try again.');
      setErrorReason(null);
    }
  }

  if (isLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2
          className="animate-spin text-primary dark:text-primary-on-dark"
          aria-label="Loading 2FA settings"
        />
      </div>
    );

  const verified = (factors as Factor[]).filter(
    (f) => f.status === 'verified' && f.factor_type === 'totp'
  );
  const otherTypes = (factors as Factor[]).filter(
    (f) => f.status === 'verified' && f.factor_type !== 'totp'
  );
  const activeFactor = verified[0];

  return (
    <div className="bg-surface-card border border-border rounded-3xl overflow-hidden shadow-sm p-8 mt-12">
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`p-3 rounded-2xl ${activeFactor ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-muted text-muted-foreground'}`}
        >
          {activeFactor ? <ShieldCheck size={24} /> : <Shield size={24} />}
        </div>
        <div>
          <h3 className="text-lg font-black text-secondary uppercase tracking-tight">
            Two-Factor Authentication
          </h3>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
            Secure your account with TOTP
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/*
          Every enrolled factor gets its own row with its own removal, and the
          count is stated. Two factors is the recovery path: a volunteer who
          loses one phone can still get in with the other. The previous version
          read `factors.find(status === 'verified')` and offered a single
          "Disable 2FA", which made a second factor impossible to add and meant
          losing the only one locked the account out entirely — the only exit was
          a dashboard reset.
        */}
        {verified.length > 0 && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                {verified.length === 1
                  ? '2FA is currently active'
                  : `2FA is active on ${verified.length} authenticators`}
              </p>
            </div>

            <ul className="space-y-2">
              {verified.map((factor) => (
                <li
                  key={factor.id}
                  className="flex items-center justify-between gap-3 bg-white/70 dark:bg-white/5 rounded-xl px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-emerald-900 min-w-0">
                    <ShieldCheck size={14} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{factor.friendly_name || 'Authenticator app'}</span>
                  </span>
                  <ConfirmAction
                    label={`Remove ${factor.friendly_name || 'this authenticator'}`}
                    message={
                      verified.length === 1
                        ? 'Removing your only authenticator locks you out if you lose this device. Continue?'
                        : 'You will still be able to sign in with your other authenticator. Remove this one?'
                    }
                    confirmLabel="Remove"
                    danger
                    idleClassName="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline inline-flex items-center gap-1.5"
                    onConfirm={() => void unenrollFactor(factor.id)}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Remove
                  </ConfirmAction>
                </li>
              ))}
            </ul>

            {/*
              The advice is conditional. With one factor, adding a second is the
              difference between "I lost my phone" and "I am locked out".
            */}
            <p className="mt-4 text-[11px] font-medium text-emerald-900/80">
              {verified.length === 1
                ? 'Add a second authenticator — a phone you no longer carry, say — so losing this one does not lock you out. If it already has, a chapter organiser can remove the lost one for you: ask at a meeting or by email.'
                : 'You can sign in with any of the authenticators above.'}
            </p>
          </div>
        )}

        {otherTypes.length > 0 && (
          <div
            role="status"
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3"
          >
            <ShieldAlert size={18} aria-hidden="true" className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-900">
              This account also has a{' '}
              <strong>{[...new Set(otherTypes.map((f) => f.factor_type))].join(', ')}</strong>{' '}
              factor enrolled. This site can only ask for a code from an authenticator app.
            </p>
          </div>
        )}

        {activeFactor ? (
          <Button onClick={startEnrollment} variant="secondary">
            <Plus size={16} className="mr-2" aria-hidden="true" />
            Add another authenticator
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Add an extra layer of security to your account. When enabled, you will be asked for a
              verification code from your mobile device when signing in.
            </p>
            <Button onClick={startEnrollment} variant="secondary">
              Enable 2FA
            </Button>
          </>
        )}
      </div>

      <Dialog open={enrolling} onOpenChange={(open) => (open ? setEnrolling(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable 2FA</DialogTitle>
            <DialogDescription>Secure your account with an authenticator app</DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">
            <div className="flex flex-col items-center gap-6 p-6 bg-surface-muted rounded-4xl border border-border">
              <div className="bg-surface-card p-4 rounded-2xl shadow-sm border border-border min-h-[212px] flex items-center justify-center">
                {totpUri ? (
                  <QRCodeSVG value={totpUri} size={180} title="Authenticator enrollment QR code" />
                ) : (
                  <Loader2 className="animate-spin text-muted-foreground" size={32} />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-center font-black uppercase tracking-widest max-w-xs leading-relaxed">
                Scan this QR code with your authenticator app
              </p>

              {/*
                Manual entry is not a nicety. A phone camera that will not focus,
                a laptop without a working camera, and a password manager that
                cannot read a QR all land here — and the alternative was being
                locked out with no way to enroll. The secret was available from
                `data.totp.secret` the whole time and was being discarded.
              */}
              <button
                type="button"
                onClick={() => setShowManualEntry((v) => !v)}
                aria-expanded={showManualEntry}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary-on-dark hover:underline"
              >
                <KeyRound size={12} aria-hidden="true" />
                {showManualEntry ? 'Hide' : 'Enter this key manually'}
              </button>

              {showManualEntry && totpSecret && (
                <div className="w-full space-y-3">
                  <div className="rounded-xl bg-surface-card border border-border p-4 text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      Setup key
                    </p>
                    <p className="font-mono text-xs text-secondary break-all tracking-wider">
                      {groupSecret(totpSecret)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(totpSecret);
                        setCopyState('copied');
                      } catch {
                        setCopyState('failed');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary-on-dark hover:underline"
                  >
                    <Copy size={12} aria-hidden="true" />
                    {copyState === 'copied'
                      ? 'Copied'
                      : copyState === 'failed'
                        ? 'Copy blocked — select and copy it by hand'
                        : 'Copy key'}
                  </button>
                  {/*
                    Stated before the code box, not after: this secret is one of
                    the only two ways into the account, and the QR is a
                    screenshot away from being gone.
                  */}
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest text-left leading-relaxed">
                    Save this key somewhere safe before continuing. If you lose this device you will
                    need it, a second authenticator, or a chapter organiser to sign in again.
                  </p>
                </div>
              )}
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
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  aria-busy={verifying}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'mfa-enroll-error' : undefined}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-black text-secondary tracking-[0.5em] text-center text-xl"
                />
                {/*
                  `aria-busy` on the input and a disabled button while the code is
                  in flight. Verification used to happen in silence: the button
                  stayed enabled, so a second click issued a second `challenge()`
                  against a factor already mid-challenge, and neither outcome was
                  announced.
                */}
                <Button
                  onClick={verifyEnrollment}
                  className="w-full"
                  disabled={!factorId || verifying}
                >
                  {verifying ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                      Verifying
                    </>
                  ) : (
                    'Verify & Activate'
                  )}
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
          id="mfa-enroll-error"
          role="alert"
          className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-accent-red"
        >
          <ShieldAlert size={18} aria-hidden="true" className="shrink-0" />
          <div>
            <p className="text-sm font-medium">{error}</p>
            {/*
              The advice under a removal failure is the whole point of the
              `reason` discriminant. A step-up requirement gets the one action
              that fixes it — completing the check — because nothing else can:
              a reload cannot change the assurance level. Anything else keeps
              no advice at all, because the enrollment paths set their own
              errors and a stale link from a previous removal would mislead.
            */}
            {errorReason === 'step_up_required' && (
              <p className="mt-3">
                <Link
                  href="/auth/mfa?next=/account?tab=settings"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-red px-5 py-2.5 text-white text-xs font-bold uppercase tracking-wider transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2"
                >
                  <ShieldCheck size={14} aria-hidden="true" />
                  Complete the security check
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700"
        >
          <ShieldCheck size={18} aria-hidden="true" className="shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Pick a label for a new factor from the ones already enrolled.
 *
 * Derived from existing labels rather than counted, because the labels are what
 * the user chose and a factor the user cannot name is a factor they cannot
 * identify when deciding which to remove.
 */
function nextFactorLabel(existing: Factor[]): string {
  const taken = new Set(
    existing
      .filter((f) => f.friendly_name)
      .map((f) => (f.friendly_name as string).trim().toLowerCase())
  );
  const suggestions = ['Phone', 'Authy', '1Password', 'Backup device'];
  const free = suggestions.find((s) => !taken.has(s.toLowerCase()));
  if (free) return free;
  let n = 2;
  while (taken.has(`authenticator ${n}`)) n += 1;
  return `Authenticator ${n}`;
}

/**
 * The base32 secret out of an `otpauth://` URI.
 *
 * Parsed from the URI rather than carried alongside it, because
 * `getTotpEnrollmentUri` returns only the URI — the secret inside it was
 * available and discarded, which is what the manual-entry path needs.
 */
function totpSecretFromUri(uri: string): string {
  if (!uri) return '';
  const match = /[?&]secret=([^&]+)/i.exec(uri);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}
