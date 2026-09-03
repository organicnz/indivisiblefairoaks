import { Package, Plus, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BulkStockBar,
  BulkStockProvider,
  ProductCheckbox,
} from '@/components/admin/BulkStockActions';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { requireAdmin } from '@/lib/admin-auth';
import { getStorageUrl } from '@/lib/supabase';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata = {
  title: 'Products — Admin · Catch-22',
  robots: { index: false, follow: false },
};

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  price: number;
  regular_price: number | null;
  stock_status: string | null;
  image_url: string | null;
  categories: { categories: { name: string }[] }[];
};

const STOCK_FILTERS = ['all', 'instock', 'outofstock', 'onbackorder'];

const stockBadge: Record<string, string> = {
  instock: 'bg-emerald-100 text-emerald-800',
  outofstock: 'bg-rose-100 text-rose-800',
  onbackorder: 'bg-amber-100 text-amber-800',
};

const stockLabel: Record<string, string> = {
  instock: 'In stock',
  outofstock: 'Out of stock',
  onbackorder: 'On backorder',
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ stock?: string; q?: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const { stock, q } = await searchParams;

  const stockFilter = STOCK_FILTERS.includes(stock || 'all') ? stock || 'all' : 'all';
  const query = (q || '').trim().toLowerCase();

  const { data: products } = await adminClient
    .from('products')
    .select(
      `id, name, slug, price, regular_price, stock_status, image_url,
       product_categories ( categories ( name ) )`
    )
    .order('name');

  const rows = ((products || []) as unknown as ProductRow[]).filter(
    (p) => stockFilter === 'all' || p.stock_status === stockFilter
  );

  const filtered = query
    ? rows.filter((p) => p.name.toLowerCase().includes(query) || String(p.id).includes(query))
    : rows;

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Package size={14} className="text-secondary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">Products</h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            {filtered.length} of {rows.length} products
          </p>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-secondary rounded-full px-4 py-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={12} /> Add product
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <nav className="flex items-center gap-2 overflow-x-auto" aria-label="Stock filter">
          {STOCK_FILTERS.map((s) => (
            <Link
              key={s}
              href={s === 'all' ? '/admin/products' : `/admin/products?stock=${s}`}
              className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                stockFilter === s
                  ? 'bg-primary text-secondary'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-secondary'
              }`}
            >
              {s === 'all' ? 'All' : stockLabel[s] || s}
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 ml-auto">
          <Search size={13} className="text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products…"
            className="bg-transparent text-sm font-bold text-secondary outline-none focus:ring-2 focus:ring-primary rounded-md placeholder:text-slate-400 w-56"
          />
        </form>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-50 p-16 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
              {rows.length === 0 ? 'No products found.' : 'No products match the filter.'}
            </p>
          </div>
        ) : (
          <BulkStockProvider>
            <BulkStockBar productIds={filtered.map((p) => p.id)} />
            {filtered.map((p) => {
              const onSale = p.regular_price !== null && Number(p.regular_price) > Number(p.price);
              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm"
                >
                  <div className="px-8 py-5 flex flex-wrap items-center gap-6">
                    <ProductCheckbox productId={p.id} />
                    {p.image_url ? (
                      <Image
                        src={getStorageUrl(p.image_url)}
                        alt={p.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 shrink-0" />
                    )}

                    <div className="flex-1 min-w-64">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-sm font-black text-secondary uppercase tracking-wider hover:text-primary transition-colors"
                        >
                          {p.name}
                        </Link>
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 ${
                            stockBadge[p.stock_status || ''] || 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {stockLabel[p.stock_status || ''] || p.stock_status || 'unknown'}
                        </span>
                        {onSale && (
                          <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-primary text-secondary">
                            On sale
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">
                        {p.categories
                          .flatMap((c) => c.categories ?? [])
                          .map((c) => c.name)
                          .filter(Boolean)
                          .join(' · ') || 'Uncategorised'}{' '}
                        · #{p.id}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg text-primary font-black">
                        ${Number(p.price).toFixed(2)}
                        {onSale && (
                          <span className="text-[10px] text-slate-400 font-bold ml-1 line-through">
                            ${Number(p.regular_price).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>

                    <ProductEditor
                      product={{
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        regular_price: p.regular_price,
                        stock_status: p.stock_status,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </BulkStockProvider>
        )}
      </div>
    </div>
  );
}
