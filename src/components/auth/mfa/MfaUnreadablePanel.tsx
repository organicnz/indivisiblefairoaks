import { ShieldAlert } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { MfaShell } from './MfaShell';

type MfaUnreadablePanelProps = {
  detail: string;
};

export function MfaUnreadablePanel({ detail }: MfaUnreadablePanelProps) {
  return (
      <MfaShell
        heading={
          <DataPoint as="span" name="auth.mfa.unreadable_heading">
            We could not check your security status
          </DataPoint>
        }
        tone="error"
        icon={<ShieldAlert size={32} aria-hidden="true" />}
      >
        <p className="text-muted-foreground mb-8 font-medium leading-relaxed">
          <DataPoint as="span" name="auth.mfa.unreadable_desc">
            Your sign-in worked, but we could not read your authenticator setup. Nothing has been
            changed and nothing is locked.
          </DataPoint>
        </p>
        <p className="text-xs text-muted-foreground font-medium mb-10 break-words">
          {detail}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light text-white font-bold rounded-sm py-5 uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-50"
        >
          <DataPoint as="span" name="auth.mfa.unreadable_btn_retry">
            Try again
          </DataPoint>
        </button>
        <p className="mt-6 text-xs text-muted-foreground font-medium">
          <DataPoint as="span" name="auth.mfa.unreadable_help">
            Still failing? Sign out and back in.
          </DataPoint>{' '}
          <a
            href="/account?tab=settings"
            className="text-primary dark:text-primary-on-dark font-bold underline"
          >
            <DataPoint as="span" name="auth.mfa.unreadable_link_settings">
              Account settings
            </DataPoint>
          </a>
        </p>
      </MfaShell>
  );
}
