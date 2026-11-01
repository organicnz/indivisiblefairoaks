import { ArrowLeft, Calendar, Package, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductDetailForm } from '@/components/admin/ProductDetailForm';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { formatPrice } from '@/config/commerce';
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
  instock: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  outofstock: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  onbackorder: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
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
};

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
       product_categories ( categories ( name ) )`
    )
    .eq('id', productId)
    .single();

  if (!data) notFound();
  const product = data as unknown as Product;

  const categories = product.product_categories
    .flatMap((c) => c.categories ?? [])
    .map((c) => c.name)
    .filter(Boolean);

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
        className="inline-flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={12} /> Back to Products
      </Link>

      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Package size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
              {product.name}
            </h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <Tag size={11} /> /{product.slug} · #{product.id}
              {product.created_at && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} />
                  {formatDate(product.created_at)}
                </span>
              )}
            </p>
            {categories.length > 0 && (
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-1">
                {categories.join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 ${
                stockBadge[product.stock_status || ''] || 'bg-surface-muted text-muted-foreground'
              }`}
            >
              {stockLabel[product.stock_status || ''] || product.stock_status || 'Unknown'}
            </span>
            <p className="text-xl text-primary dark:text-primary-on-dark font-black">
              {formatPrice(product.price)}
              {onSale && (
                <span className="text-[10px] text-muted-foreground font-bold ml-1 line-through">
                  {formatPrice(product.regular_price)}
                </span>
              )}
            </p>
            {onSale && (
              <span className="text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-primary text-white">
                On sale
              </span>
            )}
          </div>
        </div>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-6">
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
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-6">
            Product image
          </h2>
          <ProductImageUpload productId={product.id} currentImageUrl={product.image_url} />
          {images.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-3">
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
                    className="w-full aspect-square object-cover rounded-2xl bg-surface-muted"
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
