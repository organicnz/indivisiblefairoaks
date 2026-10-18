'use client';

import { AlertCircle, Check, Pencil, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { updateProduct } from '@/app/admin/actions';
import { useDataPoints } from '@/hooks/useDataPoints';

const STOCK_VALUES = ['instock', 'outofstock', 'onbackorder'];

const stockLabel = (value: string, dataPoints: Record<string, string>): string =>
  value === 'instock'
    ? dataPoints['admin.products.stock_in'] || 'In stock'
    : value === 'outofstock'
      ? dataPoints['admin.products.stock_out'] || 'Out of stock'
      : dataPoints['admin.products.stock_backorder'] || 'On backorder';

type ProductRow = {
  id: number;
  name: string;
  price: number;
  regular_price: number | null;
  stock_status: string | null;
};

export function ProductEditor({ product }: { product: ProductRow }) {
  const editId = product.id;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [regularPrice, setRegularPrice] = useState(
    product.regular_price !== null && product.regular_price !== undefined
      ? String(product.regular_price)
      : ''
  );
  const [stock, setStock] = useState(product.stock_status || 'instock');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { dataPoints } = useDataPoints('admin');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
      >
        <Pencil size={11} /> {dataPoints['admin.ui.edit'] || 'Edit'}
      </button>
    );
  }

  const save = () => {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateProduct({
          id: product.id,
          name,
          price: priceNum,
          regular_price: regularPrice === '' ? null : Number(regularPrice),
          stock_status: stock,
        });
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-lg px-2 py-1 w-56"
          aria-label="Product name"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
        >
          <Check size={12} /> {dataPoints['admin.ui.save'] || 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-muted-foreground"
        >
          <X size={12} /> {dataPoints['admin.ui.cancel'] || 'Cancel'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label
          htmlFor={`price-${editId}`}
          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
        >
          {dataPoints['admin.products.price_label'] || 'Price'}
        </label>
        <input
          id={`price-${editId}`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-lg px-2 py-1 w-24"
          inputMode="decimal"
        />
        <label
          htmlFor={`sale-${editId}`}
          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2"
        >
          {dataPoints['admin.products.compare_at_label'] || 'Compare-at'}
        </label>
        <input
          id={`sale-${editId}`}
          value={regularPrice}
          onChange={(e) => setRegularPrice(e.target.value)}
          className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-lg px-2 py-1 w-24"
          inputMode="decimal"
          placeholder="None"
        />
        <select
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 border-0 bg-surface-muted text-foreground outline-none cursor-pointer"
          aria-label="Stock status"
        >
          {STOCK_VALUES.map((value) => (
            <option key={value} value={value}>
              {stockLabel(value, dataPoints)}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-600">
          <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
