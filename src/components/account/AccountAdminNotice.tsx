import { AlertTriangle } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type AccountAdminNoticeProps = {
  email: string | undefined;
  dataPoints: Record<string, string>;
};

export function AccountAdminNotice({ email, dataPoints }: AccountAdminNoticeProps) {
  return (
          <div className="mb-8 flex items-start gap-4 rounded-sm border border-amber-200 bg-amber-50 p-5 text-amber-950 animate-in fade-in dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="mb-1 font-display text-sm font-semibold tracking-[-0.01em] text-amber-900 dark:text-amber-200">
                <DataPoint name="account.admin_required.title" initialData={dataPoints}>
                  Administrator privileges required
                </DataPoint>
              </h3>
              <DataPoint
                name="account.admin_required.desc"
                as="p"
                initialData={dataPoints}
                className="text-xs text-amber-800 dark:text-amber-300"
              >
                The administrative panel is strictly restricted to verified chapter organizers. If
                you are a chapter lead, please ensure you are signed in with your authorized
                administrator email.
              </DataPoint>
              {/*
                The sentence above is CMS copy and has to read for every visitor,
                so it says "ensure you are signed in". This reader already is —
                which made the notice a dead end: it named no account and no next
                step. The app knows both, so it says them, outside the editable
                copy so a copy edit cannot remove the diagnosis.
              */}
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                You are signed in as{' '}
                <span className="font-semibold">{email ?? 'this account'}</span>, and this
                account does not have administrator access. Ask a chapter lead to grant it, or sign
                out and sign in with an administrator account.
              </p>
            </div>
          </div>
  );
}
