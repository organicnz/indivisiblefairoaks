'use client';

import { useTransition } from 'react';
import { updateOrderStatus } from '@/app/admin/actions';

const STATUSES = ['processing', 'completed', 'cancelled', 'refunded', 'on-hold'];

const colours: Record<string, string> = {
  processing: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
  refunded: 'bg-slate-100 text-slate-600',
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    startTransition(async () => {
      await updateOrderStatus(orderId, next);
    });
  };

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      // No accessible name: the control is a bare status pill, so a screen reader
      // announced "combo box" with no indication of which order it belongs to.
      aria-label={`Order status${isPending ? ', saving' : ''}`}
      aria-busy={isPending}
      className={`min-h-9 text-xs font-black uppercase tracking-wider rounded-full px-3 py-1.5 border-0 cursor-pointer transition-opacity ${colours[currentStatus] || colours.processing} ${
        isPending ? 'opacity-50' : ''
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-secondary normal-case">
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
