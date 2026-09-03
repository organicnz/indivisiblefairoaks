'use client';

import { Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { updateProduct } from '@/app/admin/actions';

const STOCK = [
  { value: 'instock', label: 'In stock' },
  { value: 'outofstock', label: 'Out of stock' },
  { value: 'onbackorder', label: 'On backorder' },
];

type ProductFields = {
  id: number;
  name: string;
  price: number;
  regular_price: number | null;
  stock_status: string | null;
  short_description: string | null;
  description: string | null;
};

export function ProductDetailForm({ product }: { product: ProductFields }) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [regularPrice, setRegularPrice] = useState(
    product.regular_price !== null && product.regular_price !== undefined
      ? String(product.regular_price)
      : ''
  );
  const [stock, setStock] = useState(product.stock_status || 'instock');
  const [shortDescription, setShortDescription] = useState(product.short_description || '');
  const [description, setDescription] = useState(product.description || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
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
    setSuccess(false);
    startTransition(async () => {
      try {
        await updateProduct({
          id: product.id,
          name,
          price: priceNum,
          regular_price: regularNum,
          stock_status: stock,
          short_description: shortDescription,
          description,
        });
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  const dirty =
    name !== product.name ||
    price !== String(product.price) ||
    regularPrice !==
      (product.regular_price !== null && product.regular_price !== undefined
        ? String(product.regular_price)
        : '') ||
    stock !== (product.stock_status || 'instock') ||
    shortDescription !== (product.short_description || '') ||
    description !== (product.description || '');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-black text-secondary bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Price
          </span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className="text-sm font-black text-secondary bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Compare-at (optional)
          </span>
          <input
            value={regularPrice}
            onChange={(e) => setRegularPrice(e.target.value)}
            inputMode="decimal"
            placeholder="None"
            className="text-sm font-black text-secondary bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Stock status
        </span>
        <select
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="text-sm font-black text-secondary bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary cursor-pointer max-w-xs"
        >
          {STOCK.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Short description (storefront card)
        </span>
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="text-sm font-bold text-secondary bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors resize-y"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Description (full product page)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
          className="text-sm font-bold text-secondary bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors resize-y font-mono"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-secondary rounded-full px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Check size={12} /> Save changes
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setName(product.name);
              setPrice(String(product.price));
              setRegularPrice(
                product.regular_price !== null && product.regular_price !== undefined
                  ? String(product.regular_price)
                  : ''
              );
              setStock(product.stock_status || 'instock');
              setShortDescription(product.short_description || '');
              setDescription(product.description || '');
              setError(null);
              setSuccess(false);
            }}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-secondary transition-colors"
          >
            <X size={12} /> Reset
          </button>
        )}
        {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
        {success && !dirty && <p className="text-[11px] font-bold text-emerald-600">Saved.</p>}
      </div>
    </div>
  );
}
