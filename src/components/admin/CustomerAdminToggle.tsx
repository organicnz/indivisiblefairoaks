'use client';

import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import { markAdminUser } from '@/app/admin/actions';

export function CustomerAdminToggle({
  profileId,
  isAdmin,
}: {
  profileId: string;
  isAdmin: boolean | null;
}) {
  const [admin, setAdmin] = useState(isAdmin ?? false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        await markAdminUser(profileId, !admin);
        setAdmin((v) => !v);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update');
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 ${
          admin
            ? 'bg-primary text-secondary'
            : 'bg-surface-muted text-muted-foreground hover:bg-slate-300 hover:text-foreground'
        }`}
      >
        <ShieldCheck size={11} />
        {admin ? 'Admin access' : 'Promote to admin'}
      </button>
      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-600">
          <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
