import { ShieldCheck } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type PasswordStepUpPanelProps = {
  dataPoints: Record<string, string>;
  onContinue: () => void;
};

export function PasswordStepUpPanel({ dataPoints, onContinue }: PasswordStepUpPanelProps) {
  return (
      <div className="civic-page min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-(--header-clearance) pb-16 text-foreground transition-colors duration-300">
        <div className="civic-panel w-full max-w-md p-10 text-center">
          <div className="p-4 bg-primary/10 text-primary dark:text-primary-on-dark rounded-sm mb-6 inline-flex">
            <ShieldCheck size={28} aria-hidden="true" />
          </div>
          <h1 className="mb-3 font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
            <DataPoint name="account.security.confirm_title" initialData={dataPoints}>
              Confirm it&apos;s you
            </DataPoint>
          </h1>
          <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
            <DataPoint name="account.security.confirm_desc" initialData={dataPoints}>
              This account has two-factor authentication, so changing the password needs a
              verification code first. It is the same check that protects your account settings.
            </DataPoint>
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="w-full bg-primary dark:bg-primary-bright text-white font-bold rounded-sm py-5 hover:bg-primary-light transition-all uppercase tracking-[0.2em] text-sm"
          >
            <DataPoint name="account.security.confirm_btn" as="span" initialData={dataPoints}>
              Enter verification code
            </DataPoint>
          </button>
        </div>
      </div>
  );
}
