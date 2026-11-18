'use client';

import * as Sentry from '@sentry/nextjs';
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
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { MfaEnrollmentDialog } from '@/components/account/MfaEnrollmentDialog';
import { MfaRecoveryCodesDialog } from '@/components/account/MfaRecoveryCodesDialog';
import { Button } from '@/components/ui/Button';
import { DataPoint } from '@/components/ui/DataPoint';
import { SITE_NAME } from '@/config/site';
import {
  generateMfaRecoveryCodesAction,
  getMfaRecoveryCodeStatusAction,
} from '@/lib/actions/mfa-recovery';
import { unenrollMfaFactorAction } from '@/lib/actions/settings';
import { getTotpEnrollmentUri } from '@/lib/mfa';
import { recoveryCodesText } from '@/lib/mfa-recovery';
import { createClient } from '@/lib/supabase';
import {
  type Factor,
  groupSecret,
  nextFactorLabel,
  totpSecretFromUri,
} from '@/components/account/mfa-settings-helpers';

export function MfaSettings({
  autoEnroll = false,
  returnTo = '/account?tab=settings',
}: {
  autoEnroll?: boolean;
  returnTo?: string;
} = {}) {
  const router = useRouter();
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
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryCopyState, setRecoveryCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );
  const [recoveryDownloadState, setRecoveryDownloadState] = useState<
    'idle' | 'downloaded' | 'failed'
  >('idle');
  const [recoverySaveError, setRecoverySaveError] = useState('');
  const autoEnrollmentStarted = useRef(false);

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

  const verified = (factors as Factor[]).filter(
    (f) => f.status === 'verified' && f.factor_type === 'totp'
  );
  const hasVerifiedTotp = verified.length > 0;

  const {
    data: recoveryStatus,
    error: recoveryStatusError,
    refetch: refetchRecoveryStatus,
  } = useQuery({
    queryKey: ['mfa-recovery-codes'],
    queryFn: async () => {
      const result = await getMfaRecoveryCodeStatusAction();
      if ('error' in result) throw new Error(result.error);
      return result;
    },
    enabled: !isLoading && hasVerifiedTotp,
  });

  useEffect(() => {
    if (!autoEnroll || isLoading || autoEnrollmentStarted.current || hasVerifiedTotp) return;
    autoEnrollmentStarted.current = true;
    void startEnrollment();
  }, [autoEnroll, hasVerifiedTotp, isLoading]);

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
      Sentry.captureException(err);
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

  async function copyTotpSecret() {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  async function verifyEnrollment() {
    setError('');
    setErrorReason(null);
    setSuccess('');
    setVerifying(true);
    // A second authenticator is a backup device, not a new recovery set.
    // Replacing the existing codes here would silently invalidate the sheet
    // the user already saved.
    const addingAdditionalFactor = verified.length > 0;
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

        // The first authenticator leaves the account one lost phone away from
        // a lockout, so issue the recovery set while the session is still AAL2
        // and before any auto-redirect back to the admin surface. Adding a
        // second authenticator keeps the existing set; if the status has not
        // loaded, do not replace a set we cannot see — the panel will refetch
        // and offer Generate if there are none.
        const shouldGenerate =
          !addingAdditionalFactor || recoveryStatus?.total === 0;
        if (shouldGenerate) {
          await generateAndShowRecoveryCodes();
        } else {
          await refetchRecoveryStatus();
        }
      }
    } catch (err) {
      // The verification path used to have no `catch`, so a dropped connection
      // rejected an unhandled promise, `verifying` stayed true, and the button
      // was disabled for the rest of the session — with the panel's own error
      // box empty, so there was nothing to explain it.
      Sentry.captureException(err);
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

  async function generateAndShowRecoveryCodes() {
    setRecoveryError('');
    try {
      const result = await generateMfaRecoveryCodesAction();
      if ('error' in result) {
        setRecoveryError(result.error);
        return;
      }
      setRecoveryCodes(result.codes);
      setRecoveryCopyState('idle');
      setRecoveryDownloadState('idle');
      setRecoverySaveError('');
      await refetchRecoveryStatus();
    } catch {
      setRecoveryError('Could not generate recovery codes. Check your connection and try again.');
    }
  }

  async function issueRecoveryCodes() {
    setRecoveryBusy(true);
    try {
      await generateAndShowRecoveryCodes();
    } finally {
      setRecoveryBusy(false);
    }
  }

  function continueToDestination() {
    if (!autoEnroll) return;
    router.push(returnTo);
    router.refresh();
  }

  function finishRecoveryDialog() {
    setRecoveryCodes([]);
    setRecoveryCopyState('idle');
    setRecoveryDownloadState('idle');
    setRecoverySaveError('');
    continueToDestination();
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodesText(recoveryCodes));
      setRecoveryCopyState('copied');
      setRecoverySaveError('');
    } catch {
      setRecoveryCopyState('failed');
      setRecoverySaveError(
        'Copying was blocked. Select the codes and save them by hand, or download them instead.'
      );
    }
  }

  function downloadRecoveryCodes() {
    try {
      const blob = new Blob([recoveryCodesText(recoveryCodes)], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mfa-recovery-codes.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke after the browser has had a turn to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setRecoveryDownloadState('downloaded');
      setRecoverySaveError('');
    } catch {
      setRecoveryDownloadState('failed');
      setRecoverySaveError(
        'The download could not be started. Use copy or print instead.'
      );
    }
  }

  function printRecoveryCodes() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setRecoverySaveError('The print window was blocked. Use copy or download instead.');
      return;
    }

    try {
      const doc = printWindow.document;
      doc.title = 'Recovery codes';
      const heading = doc.createElement('h1');
      heading.textContent = 'Two-factor recovery codes';
      const instructions = doc.createElement('p');
      instructions.textContent =
        'Keep this sheet somewhere separate from your authenticator. Each code works once and resets your authenticator setup.';
      const codes = doc.createElement('pre');
      codes.style.fontSize = '16px';
      codes.style.lineHeight = '1.8';
      codes.textContent = recoveryCodesText(recoveryCodes);
      doc.body.replaceChildren(heading, instructions, codes);
      printWindow.focus();
      printWindow.print();
      setRecoverySaveError('');
    } catch {
      printWindow.close();
      setRecoverySaveError('The print window could not be prepared. Use copy or download instead.');
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

  const otherTypes = (factors as Factor[]).filter(
    (f) => f.status === 'verified' && f.factor_type !== 'totp'
  );
  const activeFactor = verified[0];

  return (
    <div className="civic-panel mt-12 overflow-hidden p-8">
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`p-3 rounded-2xl ${activeFactor ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-surface-muted text-muted-foreground'}`}
        >
          {activeFactor ? <ShieldCheck size={24} /> : <Shield size={24} />}
        </div>
        <div>
          <h3 className="text-lg font-black text-foreground uppercase tracking-tight">
            <DataPoint as="span" name="account.mfa.title">
              Two-Factor Authentication
            </DataPoint>
          </h3>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
            <DataPoint as="span" name="account.mfa.subtitle">
              Secure your account with TOTP
            </DataPoint>
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
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
                {verified.length === 1 ? (
                  <DataPoint as="span" name="account.mfa.active_single">
                    2FA is currently active
                  </DataPoint>
                ) : (
                  `2FA is active on ${verified.length} authenticators`
                )}
              </p>
            </div>

            <ul className="space-y-2">
              {verified.map((factor) => (
                <li
                  key={factor.id}
                  className="flex items-center justify-between gap-3 bg-white/70 dark:bg-white/5 rounded-xl px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 min-w-0">
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
            <p className="mt-4 text-[11px] font-medium text-emerald-900/80 dark:text-emerald-300/80">
              {verified.length === 1
                ? 'Add a second authenticator — a phone you no longer carry, say — so losing this one does not lock you out. If you lose every authenticator, use a recovery code to reset the setup and enroll again.'
                : 'You can sign in with any of the authenticators above, or use a recovery code if you lose all of them.'}
            </p>
          </div>
        )}

        {otherTypes.length > 0 && (
          <div
            role="status"
            className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3"
          >
            <ShieldAlert
              size={18}
              aria-hidden="true"
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              This account also has a{' '}
              <strong>{[...new Set(otherTypes.map((f) => f.factor_type))].join(', ')}</strong>{' '}
              factor enrolled. This site can only ask for a code from an authenticator app.
            </p>
          </div>
        )}

        {hasVerifiedTotp && (
          <div className="p-4 bg-surface-muted border border-border rounded-2xl">
            <div className="flex items-start gap-3">
              <KeyRound
                size={18}
                aria-hidden="true"
                className="text-primary dark:text-primary-on-dark shrink-0 mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-foreground uppercase tracking-widest">
                  Recovery codes
                </h4>
                <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">
                  Use one code if you lose every authenticator. Each code works once and resets
                  your authenticator setup, so you must enroll a new one afterwards.
                </p>
                <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {recoveryStatusError
                    ? 'Could not check saved recovery codes.'
                    : recoveryStatus
                      ? recoveryStatus.total > 0
                        ? `${recoveryStatus.remaining} of ${recoveryStatus.total} codes unused`
                        : 'No recovery codes generated yet'
                      : 'Checking saved recovery codes...'}
                </p>
                {recoveryError && (
                  <p role="alert" className="mt-2 text-xs font-medium text-accent-red">
                    {recoveryError}
                  </p>
                )}
                <div className="mt-3">
                  {recoveryStatus && recoveryStatus.total > 0 ? (
                    <ConfirmAction
                      label="Replace recovery codes"
                      message="Replacing the set makes every unused recovery code stop working. Continue?"
                      confirmLabel="Replace"
                      danger
                      idleClassName="text-[10px] font-black text-primary dark:text-primary-on-dark uppercase tracking-widest hover:underline inline-flex items-center gap-1.5"
                      onConfirm={() => void issueRecoveryCodes()}
                    >
                      <KeyRound size={12} aria-hidden="true" />
                      Replace recovery codes
                    </ConfirmAction>
                  ) : (
                    <Button
                      onClick={() => void issueRecoveryCodes()}
                      variant="secondary"
                      disabled={recoveryBusy}
                    >
                      {recoveryBusy ? 'Generating...' : 'Generate recovery codes'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeFactor ? (
          <Button onClick={startEnrollment} variant="secondary">
            <Plus size={16} className="mr-2" aria-hidden="true" />
            <DataPoint as="span" name="account.mfa.btn_add_another">
              Add another authenticator
            </DataPoint>
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              <DataPoint as="span" name="account.mfa.desc_disabled">
                Add an extra layer of security to your account. When enabled, you will be asked for
                a verification code from your mobile device when signing in.
              </DataPoint>
            </p>
            <Button onClick={startEnrollment} variant="secondary">
              <DataPoint as="span" name="account.mfa.btn_enable">
                Enable 2FA
              </DataPoint>
            </Button>
          </>
        )}
      </div>

      <MfaRecoveryCodesDialog
        codes={recoveryCodes}
        copyState={recoveryCopyState}
        downloadState={recoveryDownloadState}
        saveError={recoverySaveError}
        onCopy={copyRecoveryCodes}
        onDownload={downloadRecoveryCodes}
        onPrint={printRecoveryCodes}
        onFinish={finishRecoveryDialog}
      />

      <MfaEnrollmentDialog
        open={enrolling}
        totpUri={totpUri}
        totpSecret={totpSecret}
        showManualEntry={showManualEntry}
        copyState={copyState}
        verifyCode={verifyCode}
        verifying={verifying}
        error={error}
        canVerify={Boolean(factorId)}
        onClose={closeDialog}
        onToggleManualEntry={() => setShowManualEntry((value) => !value)}
        onCopySecret={copyTotpSecret}
        onVerifyCodeChange={setVerifyCode}
        onVerify={verifyEnrollment}
      />

      {/* Both MFA outcomes were silent: a failed code produced no announcement
          at all. `role="alert"` interrupts, `role="status"` is polite. */}
      {error && (
        <div
          id="mfa-enroll-error"
          role="alert"
          className="mt-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center gap-3 text-accent-red dark:text-rose-400"
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
          className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-start gap-3 text-emerald-700 dark:text-emerald-400"
        >
          <ShieldCheck size={18} aria-hidden="true" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{success}</p>
            {autoEnroll && recoveryCodes.length === 0 && (
              <Button onClick={continueToDestination} className="mt-3" variant="secondary">
                Continue
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
