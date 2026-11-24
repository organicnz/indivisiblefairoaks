import { LogoutButton } from '@/components/account/LogoutButton';
import { MfaSettingsLazy } from '@/components/account/MfaSettingsLazy';
import { UserSettings } from '@/components/account/UserSettings';
import { DataPoint } from '@/components/ui/DataPoint';

type AccountPanelProps = {
  email: string | undefined;
  autoEnroll: boolean;
  returnTo: string;
  dataPoints: Record<string, string>;
};

export function AccountPanel({ email, autoEnroll, returnTo, dataPoints }: AccountPanelProps) {
  return (
    <div className="max-w-2xl space-y-12">
      <UserSettings />
      <MfaSettingsLazy autoEnroll={autoEnroll} returnTo={returnTo} />
      <div className="pt-8 border-t border-border">
        <h3 className="civic-meta text-foreground mb-1">
          <DataPoint name="account.session.title" initialData={dataPoints}>
            Session Control
          </DataPoint>
        </h3>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-6">
          <DataPoint name="account.session.signed_in_as" as="span" initialData={dataPoints}>
            Signed in as
          </DataPoint>{' '}
          <span className="text-foreground font-medium">{email}</span>
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
