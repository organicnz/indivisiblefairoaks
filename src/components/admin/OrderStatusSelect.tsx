'use client';

import { AlertCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { updateOrderStatus } from '@/app/admin/actions';
import { isMfaStepUpError } from '@/lib/mfa-guard';

const STATUSES = ['processing', 'completed', 'cancelled', 'refunded', 'on-hold'];

const colours: Record<string, string> = {
  processing: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
  refunded: 'bg-surface-muted text-muted-foreground',
  'on-hold': 'bg-blue-100 text-blue-800',
};

export function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  // Controlled, not `defaultValue`. An uncontrolled select that fails to save
  // keeps showing the value the admin just picked, so the UI asserts a status
  // the database never took. This was the only one of the twelve
  // `startTransition(async …)` call sites in `src/` with no `try`/`catch`, so
  // `requireAdminClient`'s MFA rejection became an unhandled promise and the
  // select simply re-enabled — silently, with nothing on screen saying the
  // write did not happen.
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<{ message: string; needsStepUp: boolean } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, next);
      } catch (err) {
        // Put the pill back. `currentStatus` is the last value the server
        // confirmed; the optimistic `next` is a guess until the action returns.
        setStatus(currentStatus);
        setError({
          message: err instanceof Error ? err.message : 'Failed to save',
          needsStepUp: isMfaStepUpError(err),
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={status}
        onChange={handleChange}
        disabled={isPending}
        // No accessible name: the control is a bare status pill, so a screen reader
        // announced "combo box" with no indication of which order it belongs to.
        aria-label={`Order status${isPending ? ', saving' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-busy={isPending}
        className={`min-h-9 text-xs font-black uppercase tracking-wider rounded-full px-3 py-1.5 border-0 cursor-pointer transition-opacity ${colours[status] || colours.processing} ${
          isPending ? 'opacity-50' : ''
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-surface-card text-foreground normal-case">
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-1.5 text-[10px] font-bold text-accent-red"
        >
          {error.needsStepUp ? (
            <>
              <ShieldCheck size={12} aria-hidden="true" className="shrink-0 mt-px" />
              <span>
                Complete the{' '}
                <Link
                  href="/auth/mfa?next=/admin"
                  className="underline underline-offset-2 hover:text-red-700"
                >
                  security check
                </Link>{' '}
                to save changes.
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={12} aria-hidden="true" className="shrink-0 mt-px" />
              <span>{error.message}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
