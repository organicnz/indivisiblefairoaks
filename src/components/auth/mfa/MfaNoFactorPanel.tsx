import { ShieldAlert } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { MfaShell } from './MfaShell';

type MfaNoFactorPanelProps = {
  factorTypes: string[];
};

export function MfaNoFactorPanel({ factorTypes }: MfaNoFactorPanelProps) {
  return (
      <MfaShell
        heading={
          <DataPoint as="span" name="auth.mfa.no_factor_heading">
            No authenticator app is set up
          </DataPoint>
        }
        tone="error"
        icon={<ShieldAlert size={32} aria-hidden="true" />}
      >
        <p className="text-muted-foreground mb-8 font-medium leading-relaxed">
          <DataPoint as="span" name="auth.mfa.no_factor_desc">
            This account cannot ask for a verification code, so there is nothing to enter here.
          </DataPoint>
        </p>
        <p className="text-sm text-muted-foreground font-medium mb-10">
          {factorTypes.length > 0 ? (
            <>
              This account has a{' '}
              <strong className="text-foreground">
                {factorTypes.join(', ').toUpperCase()}
              </strong>{' '}
              factor enrolled. This site can only complete the check with an authenticator app (a
              code from Google Authenticator, 1Password, Authy and similar).
            </>
          ) : (
            <>
              Set one up in{' '}
              <strong className="text-foreground">
                Account → Settings → Two-Factor Authentication
              </strong>
              .
            </>
          )}
        </p>
        <a
          href="/account?tab=settings"
          className="inline-flex w-full items-center justify-center bg-primary dark:bg-primary-bright text-white font-bold rounded-sm py-5 uppercase tracking-[0.2em] text-sm transition-all hover:bg-primary-dark dark:hover:bg-primary-light"
        >
          <DataPoint as="span" name="auth.mfa.no_factor_btn_settings">
            Go to account settings
          </DataPoint>
        </a>
      </MfaShell>
  );
}
