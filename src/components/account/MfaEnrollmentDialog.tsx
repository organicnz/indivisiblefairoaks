import { Copy, KeyRound, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';
import { DataPoint } from '@/components/ui/DataPoint';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { groupSecret } from '@/components/account/mfa-settings-helpers';

export function MfaEnrollmentDialog({
  open,
  totpUri,
  totpSecret,
  showManualEntry,
  copyState,
  verifyCode,
  verifying,
  error,
  canVerify,
  onClose,
  onToggleManualEntry,
  onCopySecret,
  onVerifyCodeChange,
  onVerify,
}: {
  open: boolean;
  totpUri: string;
  totpSecret: string;
  showManualEntry: boolean;
  copyState: 'idle' | 'copied' | 'failed';
  verifyCode: string;
  verifying: boolean;
  error: string;
  canVerify: boolean;
  onClose: () => void;
  onToggleManualEntry: () => void;
  onCopySecret: () => void;
  onVerifyCodeChange: (code: string) => void;
  onVerify: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <DataPoint as="span" name="account.mfa.dialog_title">
              Enable 2FA
            </DataPoint>
          </DialogTitle>
          <DialogDescription>
            <DataPoint as="span" name="account.mfa.dialog_desc">
              Secure your account with an authenticator app
            </DataPoint>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          <div className="flex flex-col items-center gap-6 p-6 bg-surface-muted rounded-4xl border border-border">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 min-h-[212px] flex items-center justify-center">
              {totpUri ? (
                <QRCodeSVG value={totpUri} size={180} title="Authenticator enrollment QR code" />
              ) : (
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center font-black uppercase tracking-widest max-w-xs leading-relaxed">
              <DataPoint as="span" name="account.mfa.qr_instruction">
                Scan this QR code with your authenticator app
              </DataPoint>
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
              onClick={onToggleManualEntry}
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
                  <p className="font-mono text-xs text-foreground break-all tracking-wider">
                    {groupSecret(totpSecret)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCopySecret}
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
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest text-left leading-relaxed">
                  Save this key somewhere safe before continuing. If you lose this device you will
                  need it, a second authenticator, or one of the recovery codes issued after
                  enrollment to sign in again.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label
              htmlFor="mfa-code"
              className="block text-[10px] font-black text-foreground uppercase tracking-widest ml-1"
            >
              <DataPoint as="span" name="account.mfa.code_label">
                Verification Code
              </DataPoint>
            </label>
            <div className="flex flex-col gap-4">
              <input
                id="mfa-code"
                type="text"
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => onVerifyCodeChange(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                aria-busy={verifying}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'mfa-enroll-error' : undefined}
                className="w-full px-5 py-4 bg-surface-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-black text-foreground tracking-[0.5em] text-center text-xl"
              />
              {/*
                `aria-busy` on the input and a disabled button while the code is
                in flight. Verification used to happen in silence: the button
                stayed enabled, so a second click issued a second `challenge()`
                against a factor already mid-challenge, and neither outcome was
                announced.
              */}
              <Button
                onClick={onVerify}
                className="w-full"
                disabled={!canVerify || verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                    Verifying
                  </>
                ) : (
                  <DataPoint as="span" name="account.mfa.btn_verify_activate">
                    Verify & Activate
                  </DataPoint>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
