'use client';

import { AlertCircle, CheckSquare, Square, X } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState, useTransition } from 'react';
import { bulkUpdateOrderStatus } from '@/app/admin/actions';
import { useDataPoints } from '@/hooks/useDataPoints';

const STATUSES = ['processing', 'completed', 'cancelled', 'refunded', 'on-hold'];

type BulkContext = {
  selected: Set<number>;
  toggleOne: (id: number) => void;
  setAll: (ids: number[], select: boolean) => void;
};

const BulkSelectionContext = createContext<BulkContext | null>(null);

export function BulkOrderProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAll = (ids: number[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  return (
    <BulkSelectionContext.Provider value={{ selected, toggleOne, setAll }}>
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function OrderCheckbox({ orderId }: { orderId: number }) {
  const ctx = useContext(BulkSelectionContext);
  const selected = ctx?.selected.has(orderId) ?? false;

  return (
    <button
      type="button"
      onClick={() => ctx?.toggleOne(orderId)}
      aria-label={selected ? `Deselect order #${orderId}` : `Select order #${orderId}`}
      aria-pressed={selected}
      className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-colors border ${
        selected
          ? 'bg-primary border-primary text-white'
          : 'border-border text-muted-foreground hover:border-primary dark:hover:border-primary-on-dark hover:text-primary dark:hover:text-primary-on-dark bg-surface-card'
      }`}
    >
      <CheckSquare size={14} />
    </button>
  );
}

export function BulkOrderBar({ orderIds }: { orderIds: number[] }) {
  const ctx = useContext(BulkSelectionContext);
  const selected = ctx?.selected ?? new Set<number>();
  const [status, setStatus] = useState('completed');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { dataPoints } = useDataPoints('admin');

  const allSelected = orderIds.length > 0 && orderIds.every((id) => selected.has(id));

  const toggleAll = () => ctx?.setAll(orderIds, !allSelected);

  const apply = () => {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkUpdateOrderStatus([...selected], status);
        ctx?.setAll([...selected], false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update orders');
      }
    });
  };

  const clear = () => ctx?.setAll([...selected], false);

  return (
    <nav
      aria-label="Bulk order actions"
      className={`flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3 transition-all ${
        selected.size > 0
          ? 'bg-secondary text-white border border-white/10 shadow-xs'
          : 'bg-surface-muted border border-border text-foreground'
      }`}
    >
      <button
        type="button"
        onClick={toggleAll}
        disabled={orderIds.length === 0 || isPending}
        aria-label="Select all visible orders"
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-40"
      >
        {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
        {selected.size > 0
          ? `${selected.size} selected`
          : dataPoints['admin.ui.select_all'] || 'Select all'}
      </button>

      {selected.size > 0 && (
        <>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={isPending}
            aria-label="Bulk status"
            className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 border-0 bg-surface-card/10 text-white outline-none cursor-pointer [&>option]:text-foreground disabled:opacity-50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                Mark {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={isPending}
            className="inline-flex items-center text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary-dark text-white rounded-full px-4 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {dataPoints['admin.ui.apply'] || 'Apply'}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors px-2 py-1.5"
          >
            <X size={11} /> {dataPoints['admin.ui.clear'] || 'Clear'}
          </button>
          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-400">
              <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </>
      )}
    </nav>
  );
}
