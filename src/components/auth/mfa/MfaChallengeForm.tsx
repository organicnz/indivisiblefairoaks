import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { MfaShell } from './MfaShell';

type FactorOption = {
  id: string;
  friendly_name?: string;
};

type MfaChallengeFormProps = {
  useRecoveryCode: boolean;
  code: string;
  recoveryCode: string;
  loading: boolean;
  error: string;
  availableFactors: FactorOption[];
  selectedFactorId: string;
  onCodeChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
  onFactorChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onRecoverySubmit: (event: React.FormEvent) => void;
  onToggleMode: () => void;
};

export function MfaChallengeForm({
  useRecoveryCode,
  code,
  recoveryCode,
  loading,
  error,
  availableFactors,
  selectedFactorId,
  onCodeChange,
  onRecoveryCodeChange,
  onFactorChange,
  onSubmit,
  onRecoverySubmit,
  onToggleMode,
}: MfaChallengeFormProps) {
  return (
    <MfaShell
      heading={
        <DataPoint as="span" name="auth.mfa.challenge_heading">
          Security Check
        </DataPoint>
      }
      tone="normal"
      icon={<ShieldCheck size={32} aria-hidden="true" />}
    >
      <p className="text-muted-foreground mb-10 font-medium leading-relaxed">
        {useRecoveryCode ? (
          'Enter one of the recovery codes you saved when you enabled two-factor authentication.'
        ) : (
          <DataPoint as="span" name="auth.mfa.challenge_desc">
            Please enter the verification code from your authenticator app to continue.
          </DataPoint>
        )}
      </p>

      <form
        onSubmit={useRecoveryCode ? onRecoverySubmit : onSubmit}
        className="space-y-6"
      >
        {!useRecoveryCode && availableFactors.length > 1 && (
          <div className="text-left">
            <label
              htmlFor="mfa-factor"
              className="block text-[10px] font-bold text-foreground uppercase tracking-widest mb-2 ml-1"
            >
              Authenticator
            </label>
            <select
              id="mfa-factor"
              value={selectedFactorId}
              onChange={(event) => onFactorChange(event.target.value)}
              className="w-full rounded-sm border border-border bg-surface-muted px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800/80 dark:focus:ring-primary-bright"
            >
              {availableFactors.map((factor, index) => (
                <option key={factor.id} value={factor.id}>
                  {factor.friendly_name || `Authenticator ${index + 1}`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground font-medium">
              Choose the device you have with you, or use a recovery code below.
            </p>
          </div>
        )}

        <div className="text-left">
          <label
            htmlFor={useRecoveryCode ? 'recovery-code' : 'code'}
            className="block text-[10px] font-bold text-foreground uppercase tracking-widest mb-2 ml-1"
          >
            {useRecoveryCode ? (
              'Recovery Code'
            ) : (
              <DataPoint as="span" name="auth.mfa.challenge_code_label">
                6-Digit Code
              </DataPoint>
            )}
          </label>
          <input
            type="text"
            id={useRecoveryCode ? 'recovery-code' : 'code'}
            placeholder={useRecoveryCode ? 'XXXX-XXXX-XXXX-XXXX' : '000000'}
            value={useRecoveryCode ? recoveryCode : code}
            /*
             * Strip everything that is not a digit, before the length cap.
             * A pasted `"123 456"` used to truncate to `"123 45"` at
             * `maxLength={6}` and fail with GoTrue's raw message; the space
             * also made `code.length < 6` on the button disagree with what
             * the user saw. Authenticator codes are six digits and nothing
             * else, so there is nothing to preserve by being lenient here.
             */
            onChange={(e) =>
              useRecoveryCode
                ? onRecoveryCodeChange(e.target.value.slice(0, 19))
                : onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            required
            autoFocus
            // `numeric` is what makes iOS and Android show a numeric keypad.
            // Without it the keyboard is alphabetical and the code arrives wrong.
            inputMode={useRecoveryCode ? 'text' : 'numeric'}
            autoComplete={useRecoveryCode ? 'off' : 'one-time-code'}
            pattern={useRecoveryCode ? undefined : '[0-9]*'}
            maxLength={useRecoveryCode ? 19 : 6}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'mfa-error' : undefined}
            className="w-full px-5 py-4 bg-surface-muted dark:bg-slate-800/80 border border-border rounded-sm focus:ring-2 focus:ring-primary dark:focus:ring-primary-bright outline-none text-center font-bold text-foreground tracking-[0.25em] text-lg"
          />
        </div>
        <button
          type="submit"
          disabled={
            loading || (useRecoveryCode ? recoveryCode.trim().length === 0 : code.length < 6)
          }
          aria-busy={loading}
          className="w-full bg-primary dark:bg-primary-bright text-white font-bold rounded-sm py-5 hover:bg-primary-dark dark:hover:bg-primary-light transition-all uppercase tracking-[0.2em] text-sm disabled:opacity-50"
        >
          {loading ? (
            <DataPoint as="span" name="auth.mfa.challenge_btn_verifying">
              Verifying...
            </DataPoint>
          ) : useRecoveryCode ? (
            'Recover account'
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
        {!useRecoveryCode && (
          <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-medium">
            <DataPoint as="span" name="auth.mfa.challenge_code_hint">
              Codes change every 30 seconds — type the one showing now.
            </DataPoint>
          </p>
        )}
      </form>

      <button
        type="button"
        onClick={onToggleMode}
        className="mt-6 text-xs font-bold uppercase tracking-widest text-primary dark:text-primary-on-dark underline"
      >
        {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
      </button>

      {/*
        `role="alert"` plus `aria-describedby` on the input. The error was
        rendered but never associated, so a screen reader heard "code" and then
        nothing about why the code was rejected.
      */}
      {error && (
        <div
          id="mfa-error"
          role="alert"
          className="mt-8 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-sm flex items-center gap-3 text-rose-600 dark:text-rose-400 text-left"
        >
          <ShieldAlert size={18} aria-hidden="true" className="shrink-0" />
          <p className="text-xs font-bold uppercase tracking-widest break-words">{error}</p>
        </div>
      )}
    </MfaShell>
  );
}
