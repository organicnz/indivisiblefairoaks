'use client';

import { ShieldCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import { markAdminUser } from '@/app/admin/actions';

export function CustomerAdminToggle({
  profileId,
  isAdmin,
}: {
  profileId: number;
  isAdmin: boolean;
}) {
  const [admin, setAdmin] = useState(isAdmin);
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
            : 'bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-secondary'
        }`}
      >
        <ShieldCheck size={11} />
        {admin ? 'Admin access' : 'Promote to admin'}
      </button>
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
    </div>
  );
}
