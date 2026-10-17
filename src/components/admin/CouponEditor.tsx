'use client';

import { AlertCircle, Edit3 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { updateCoupon } from '@/app/admin/actions';

export function CouponEditor({
  id,
  code,
  discountType,
  amount,
  expiryDate,
}: {
  id: number;
  code: string;
  discountType: string | null;
  amount: number | null;
  expiryDate: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<'percent' | 'fixed'>(
    discountType === 'fixed' ? 'fixed' : 'percent'
  );
  const [amountValue, setAmountValue] = useState(String(amount ?? ''));
  const [expiry, setExpiry] = useState(expiryDate ? expiryDate.slice(0, 10) : '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateCoupon(id, {
          discount_type: type,
          amount: Number(amountValue),
          expiry_date: expiry === '' ? null : new Date(`${expiry}T23:59:59`).toISOString(),
        });
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update coupon');
      }
    });
  };

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
        >
          <Edit3 size={11} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-muted rounded-2xl p-4 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Edit {code}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
          className="text-xs font-black bg-surface-card border border-border rounded-xl px-2.5 py-2 outline-none focus:border-primary cursor-pointer"
        >
          <option value="percent">Percent %</option>
          <option value="fixed">Fixed $</option>
        </select>
        <input
          value={amountValue}
          onChange={(e) => setAmountValue(e.target.value)}
          inputMode="decimal"
          placeholder="10"
          className="text-xs font-black bg-surface-card border border-border rounded-xl px-2.5 py-2 w-20 outline-none focus:border-primary"
        />
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="text-xs font-black bg-surface-card border border-border rounded-xl px-2.5 py-2 outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex items-center text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary-dark text-white rounded-full px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={isPending}
          className="inline-flex items-center text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-500">
          <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
