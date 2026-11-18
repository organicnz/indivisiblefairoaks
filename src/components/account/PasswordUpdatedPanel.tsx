import { CheckCircle } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type PasswordUpdatedPanelProps = {
  dataPoints: Record<string, string>;
  onContinue: () => void;
};

export function PasswordUpdatedPanel({ dataPoints, onContinue }: PasswordUpdatedPanelProps) {
  return (
      <div className="civic-page min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-(--header-clearance) pb-16 text-foreground transition-colors duration-300">
        <div className="civic-panel w-full max-w-md p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
            <CheckCircle
              className="w-10 h-10 text-emerald-600 dark:text-emerald-400"
              strokeWidth={2.5}
            />
          </div>
          <h1 className="mb-3 font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
            <DataPoint name="account.password.updated_title" initialData={dataPoints}>
              Password updated
            </DataPoint>
          </h1>
          <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
            <DataPoint name="account.password.updated_desc" initialData={dataPoints}>
              Your password has been changed successfully. You can now sign in with your new
              credentials.
            </DataPoint>
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="w-full bg-primary dark:bg-primary-bright text-white font-bold rounded-sm py-5 hover:bg-primary-light transition-all uppercase tracking-[0.2em] text-sm"
          >
            <DataPoint name="account.password.btn_go_account" as="span" initialData={dataPoints}>
              Go to Account
            </DataPoint>
          </button>
        </div>
      </div>
  );
}
