'use client';

import { AlertCircle, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createProduct } from '@/app/admin/actions';

const STOCK = [
  { value: 'instock', label: 'In stock' },
  { value: 'outofstock', label: 'Out of stock' },
  { value: 'onbackorder', label: 'On backorder' },
];

export function ProductCreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [stock, setStock] = useState('instock');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const create = () => {
    if (price.trim() === '') {
      setError('Price is required');
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number');
      return;
    }
    const regularNum = regularPrice === '' ? null : Number(regularPrice);
    if (regularNum !== null && (!Number.isFinite(regularNum) || regularNum < 0)) {
      setError('Compare-at price must be a non-negative number');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const id = await createProduct({
          name,
          price: priceNum,
          regular_price: regularNum,
          stock_status: stock,
          short_description: shortDescription,
          description,
        });
        router.push(`/admin/products/${id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create product');
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Price
          </span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Compare-at (optional)
          </span>
          <input
            value={regularPrice}
            onChange={(e) => setRegularPrice(e.target.value)}
            inputMode="decimal"
            placeholder="None"
            className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Stock status
        </span>
        <select
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="text-sm font-black text-foreground bg-surface-muted border border-border rounded-xl px-3 py-2 outline-none focus:border-primary cursor-pointer max-w-xs"
        >
          {STOCK.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Short description (storefront card)
        </span>
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="text-sm font-bold text-foreground bg-surface-muted border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors resize-y"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Description (full product page)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
          className="text-sm font-bold text-foreground bg-surface-muted border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors resize-y font-mono"
        />
      </label>

      <p className="text-[10px] text-muted-foreground font-bold">
        The slug is generated automatically from the name. You can add the product image afterwards
        on its detail page.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={create}
          disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-secondary rounded-full px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Check size={12} /> {isPending ? 'Creating…' : 'Create product'}
        </button>
        {error && (
          <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-600">
            <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
