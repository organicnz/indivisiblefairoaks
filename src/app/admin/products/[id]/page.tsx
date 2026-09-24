import { ArrowLeft, Calendar, DollarSign, Package, ShoppingBag, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductDetailForm } from '@/components/admin/ProductDetailForm';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { requireAdmin } from '@/lib/admin-auth';
import { getStorageUrl } from '@/lib/supabase';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Material #${id} — Admin · Indivisible Fair Oaks`,
    robots: { index: false, follow: false },
  };
}

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

type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  regular_price: number | null;
  stock_status: string | null;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  created_at: string | null;
  product_categories: { categories: { name: string }[] }[];
  order_items: {
    quantity: number | null;
    unit_price: number | null;
    orders: { id: number; created_at: string | null; status: string | null };
  }[];
};

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const { data } = await adminClient
    .from('products')
    .select(
      `id, name, slug, price, regular_price, stock_status,
       short_description, description, image_url, gallery_urls, created_at,
       product_categories ( categories ( name ) ),
        order_items ( quantity, unit_price, orders ( id, created_at, status ) )`
    )
    .eq('id', productId)
    .single();

  if (!data) notFound();
  const product = data as unknown as Product;

  const categories = product.product_categories
    .flatMap((c) => c.categories ?? [])
    .map((c) => c.name)
    .filter(Boolean);

  const items = product.order_items || [];
  // Cancelled/refunded orders are not sales — exclude from the stats
  const NO_SALE_STATUSES = new Set(['cancelled', 'refunded']);
  const activeItems = items.filter((i) => !NO_SALE_STATUSES.has(i.orders?.status ?? ''));
  const unitsSold = activeItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const revenue = activeItems.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
    0
  );
  const ordersByProduct = new Map<number, (typeof items)[number]>();
  for (const item of activeItems) {
    const order = item.orders;
    if (!ordersByProduct.has(order.id)) ordersByProduct.set(order.id, item);
  }
  const orderCount = ordersByProduct.size;
  const recentOrders = [...ordersByProduct.values()]
    .sort((a, b) =>
      String(b.orders.created_at || '').localeCompare(String(a.orders.created_at || ''))
    )
    .slice(0, 10);

  const rawImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.gallery_urls || []),
  ].filter((u) => typeof u === 'string' && u.trim() !== '');
  const images = [...new Set(rawImages)];
  const onSale =
    product.regular_price !== null && Number(product.regular_price) > Number(product.price);

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-secondary transition-colors mb-6"
      >
        <ArrowLeft size={12} /> Back to Products
      </Link>

      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Package size={14} className="text-secondary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">
              {product.name}
            </h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <Tag size={11} /> /{product.slug} · #{product.id}
              {product.created_at && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(product.created_at).toLocaleDateString('en-NZ', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
            </p>
            {categories.length > 0 && (
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">
                {categories.join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 ${
                stockBadge[product.stock_status || ''] || 'bg-slate-100 text-slate-600'
              }`}
            >
              {stockLabel[product.stock_status || ''] || product.stock_status || 'Unknown'}
            </span>
            <p className="text-xl text-primary font-black">
              ${Number(product.price).toFixed(2)}
              {onSale && (
                <span className="text-[10px] text-slate-400 font-bold ml-1 line-through">
                  ${Number(product.regular_price).toFixed(2)}
                </span>
              )}
            </p>
            {onSale && (
              <span className="text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-primary text-secondary">
                On sale
              </span>
            )}
          </div>
        </div>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Units Sold', value: String(unitsSold), icon: ShoppingBag },
          { label: 'Revenue', value: `$${revenue.toFixed(2)}`, icon: DollarSign },
          { label: 'Orders', value: String(orderCount), icon: Package },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-secondary rounded-3xl p-6">
            <Icon size={16} className="text-primary mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
              {label}
            </p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6">
            Edit product
          </h2>
          <ProductDetailForm
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
              regular_price: product.regular_price,
              stock_status: product.stock_status,
              short_description: product.short_description,
              description: product.description,
            }}
          />
        </section>

        {/* Images */}
        <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6">
            Product image
          </h2>
          <ProductImageUpload productId={product.id} currentImageUrl={product.image_url} />
          {images.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">
                Preview ({images.length})
              </p>
              <div className="grid grid-cols-2 gap-3">
                {images.map((src) => (
                  <Image
                    key={src}
                    src={getStorageUrl(src)}
                    alt={`${product.name} preview`}
                    width={200}
                    height={200}
                    className="w-full aspect-square object-cover rounded-2xl bg-slate-100"
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Recent orders */}
      <section className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm mt-6">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShoppingBag size={12} className="text-primary" />
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
            Recent orders containing this product ({orderCount})
          </h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
              No sales yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {recentOrders.map((item) => (
              <li key={item.orders.id} className="px-8 py-4 flex flex-wrap items-center gap-4">
                <Link
                  href={`/admin/orders/${item.orders.id}`}
                  className="text-sm font-black text-secondary uppercase tracking-wider hover:text-primary transition-colors"
                >
                  #{item.orders.id}
                </Link>
                <span
                  className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 ${
                    item.orders.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.orders.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-800'
                        : item.orders.status === 'refunded'
                          ? 'bg-slate-100 text-slate-600'
                          : item.orders.status === 'on-hold'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.orders.status || 'unknown'}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                  {item.orders.created_at
                    ? new Date(item.orders.created_at).toLocaleDateString('en-NZ', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">Qty: {item.quantity}</span>
                <span className="ml-auto text-sm font-black text-primary">
                  $
                  {(Number(item.unit_price) || 0) * (Number(item.quantity) || 0) === 0
                    ? '0.00'
                    : ((Number(item.unit_price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
