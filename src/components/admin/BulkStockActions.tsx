'use client';

import { AlertCircle, CheckSquare, Square, X } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState, useTransition } from 'react';
import { bulkUpdateProductStock } from '@/app/admin/actions';
import { useDataPoints } from '@/hooks/useDataPoints';

const STOCK_STATUSES = ['instock', 'outofstock', 'onbackorder'];

const stockLabel = (value: string, dataPoints: Record<string, string>): string =>
  value === 'instock'
    ? dataPoints['admin.products.stock_in'] || 'In stock'
    : value === 'outofstock'
      ? dataPoints['admin.products.stock_out'] || 'Out of stock'
      : dataPoints['admin.products.stock_backorder'] || 'On backorder';

type StockContext = {
  selected: Set<number>;
  toggleOne: (id: number) => void;
  setAll: (ids: number[], select: boolean) => void;
};

const StockSelectionContext = createContext<StockContext | null>(null);

export function BulkStockProvider({ children }: { children: ReactNode }) {
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
    <StockSelectionContext.Provider value={{ selected, toggleOne, setAll }}>
      {children}
    </StockSelectionContext.Provider>
  );
}

export function ProductCheckbox({ productId }: { productId: number }) {
  const ctx = useContext(StockSelectionContext);
  const selected = ctx?.selected.has(productId) ?? false;

  return (
    <button
      type="button"
      onClick={() => ctx?.toggleOne(productId)}
      aria-label={selected ? `Deselect product #${productId}` : `Select product #${productId}`}
      aria-pressed={selected}
      className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-colors border ${
        selected
          ? 'bg-primary border-primary text-secondary'
          : 'border-border text-muted-foreground hover:border-primary hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark bg-surface-card'
      }`}
    >
      <CheckSquare size={14} />
    </button>
  );
}

export function BulkStockBar({ productIds }: { productIds: number[] }) {
  const ctx = useContext(StockSelectionContext);
  const selected = ctx?.selected ?? new Set<number>();
  const [status, setStatus] = useState('instock');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { dataPoints } = useDataPoints('admin');

  const allSelected = productIds.length > 0 && productIds.every((id) => selected.has(id));

  const toggleAll = () => ctx?.setAll(productIds, !allSelected);

  const apply = () => {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkUpdateProductStock([...selected], status);
        ctx?.setAll([...selected], false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update products');
      }
    });
  };

  const clear = () => ctx?.setAll([...selected], false);

  return (
    <nav
      aria-label="Bulk stock actions"
      className={`flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3 transition-all ${
        selected.size > 0 ? 'bg-secondary text-white' : 'bg-surface-muted'
      }`}
    >
      <button
        type="button"
        onClick={toggleAll}
        disabled={productIds.length === 0 || isPending}
        aria-label="Select all visible products"
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
            aria-label="Bulk stock status"
            className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 border-0 bg-surface-card/10 text-white outline-none cursor-pointer [&>option]:text-foreground disabled:opacity-50"
          >
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {stockLabel(s, dataPoints)}
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
