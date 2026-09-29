'use client';

import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createCoupon, deleteCoupon } from '@/app/admin/actions';

export function CouponCreator() {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [amount, setAmount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSuccess(false);
    const amountNum = Number(amount);
    startTransition(async () => {
      try {
        await createCoupon({
          code,
          discount_type: discountType,
          amount: amountNum,
          expiry_date: expiry === '' ? null : new Date(expiry).toISOString(),
        });
        setSuccess(true);
        setCode('');
        setAmount('');
        setExpiry('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create coupon');
      }
    });
  };

  return (
    <div className="bg-secondary rounded-3xl p-6 mb-8">
      <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-4">
        New Coupon
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Code
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            className="text-sm font-black text-white bg-white/10 border border-white/10 rounded-xl px-3 py-2 w-40 outline-none placeholder:text-white/30 focus:border-primary transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Type
          </span>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
            className="text-sm font-black text-white bg-white/10 border border-white/10 rounded-xl px-3 py-2 w-32 outline-none focus:border-primary cursor-pointer"
          >
            <option value="percent" className="bg-secondary">
              Percent %
            </option>
            <option value="fixed" className="bg-secondary">
              Fixed $
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            {discountType === 'percent' ? 'Percent off' : 'Dollar off'}
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={discountType === 'percent' ? '10' : '5'}
            className="text-sm font-black text-white bg-white/10 border border-white/10 rounded-xl px-3 py-2 w-24 outline-none placeholder:text-white/30 focus:border-primary transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Expires
          </span>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="text-sm font-black text-white bg-white/10 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors [color-scheme:dark]"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || code.trim().length < 3 || amount === ''}
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-primary text-secondary rounded-full px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus size={12} /> Create
        </button>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-400 mt-3">
          <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && <p className="text-[11px] font-bold text-emerald-400 mt-3">Coupon created.</p>}
    </div>
  );
}

export function CouponDelete({ id, code }: { id: number; code: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const remove = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    startTransition(async () => {
      try {
        await deleteCoupon(id);
      } catch {
        // Surface nothing in the list; a refresh will show it still present.
      }
    });
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 ${
        confirming
          ? 'bg-rose-600 text-white'
          : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
      }`}
    >
      <Trash2 size={11} />
      {confirming ? `Delete ${code}?` : 'Delete'}
    </button>
  );
}
