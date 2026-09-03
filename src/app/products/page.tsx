import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase-server';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const categorySlug = typeof resolvedParams.category === 'string' ? resolvedParams.category : null;

  // Canonical always points at the unfiltered listing — filtered views are
  // variants of one catalog page, not duplicate content.
  const canonical = categorySlug ? `/products?category=${categorySlug}` : '/products';

  if (categorySlug) {
    const supabase = createPublicClient();
    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('slug', categorySlug)
      .single();

    if (category) {
      const title = `${category.name} | Catch-22 New Zealand`;
      const description = `Shop premium ${category.name.toLowerCase()} from Catch-22. High-performance fishing gear built for New Zealand conditions.`;
      return {
        alternates: { canonical },
        title,
        description,
        openGraph: {
          title,
          description,
          url: `https://catch-22.co.nz/products?category=${categorySlug}`,
          siteName: 'Catch-22',
          locale: 'en_NZ',
          images: [
            {
              url: 'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/thunder-charter.jpg',
              width: 1200,
              height: 630,
              alt: `Catch-22 ${category.name}`,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [
            'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/thunder-charter.jpg',
          ],
        },
      };
    }
  }

  const title = 'All Gear | Catch-22 New Zealand';
  const description =
    'Browse our full collection of premium fishing braid, lures, and apparel. High-performance gear built for New Zealand conditions.';
  return {
    alternates: { canonical: '/products' },
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://catch-22.co.nz/products',
      siteName: 'Catch-22',
      locale: 'en_NZ',
      images: [
        {
          url: 'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/thunder-charter.jpg',
          width: 1200,
          height: 630,
          alt: 'Catch-22 Premium Fishing Gear',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/thunder-charter.jpg',
      ],
    },
  };
}

import { ProductCard } from '@/components/products/ProductCard';

// Deliberate Cache Components opt-out (Block): per-category SEO titles require
// awaiting searchParams in generateMetadata, which forces full dynamic rendering.
// Revisit if Next.js adds streaming metadata support.
export const instant = false;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createPublicClient();

  // Await searchParams in Next 15+
  const resolvedSearchParams = await searchParams;
  const categorySlug =
    typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category : null;

  // Fetch Categories for the Sidebar
  const { data: categories, error: categoriesError } = await createPublicClient()
    .from('categories')
    .select('*')
    .order('name');

  if (categoriesError) {
    // Prerender-phase rejection of the shell fetch — retried at request time.
    if (!(categoriesError instanceof Error) || !/prerender/i.test(categoriesError.message)) {
      console.error('[ProductsPage] Categories query failed:', categoriesError.message);
    }
    // Continue rendering — categories sidebar will be empty but page won't crash
  }

  // Fetch Products (with optional category filtering)
  const { data: products, error } = await (categorySlug
    ? supabase
        .from('products')
        .select(
          `id, name, slug, price, regular_price, sale_price, image_url, stock_status,
          product_categories!inner ( categories!inner (slug) )`
        )
        .eq('product_categories.categories.slug', categorySlug)
        .eq('stock_status', 'instock')
        .order('created_at', { ascending: false })
    : supabase
        .from('products')
        .select('id, name, slug, price, regular_price, sale_price, image_url, stock_status')
        .eq('stock_status', 'instock')
        .order('created_at', { ascending: false }));

  if (error) {
    console.error('Error fetching products:', error);
    return <div className="p-8 text-center text-red-500">Failed to load products.</div>;
  }

  // Map nulls to undefined for ProductCard compatibility
  const formattedProducts = products?.map((p) => ({
    ...p,
    regular_price: p.regular_price ?? undefined,
    sale_price: p.sale_price ?? undefined,
  }));

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--header-h) pb-12">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar / Categories */}
          <div className="w-full md:w-64 shrink-0">
            <h2 className="text-xl font-black text-secondary uppercase tracking-widest mb-6 border-b-2 border-primary pb-2 inline-block">
              Categories
            </h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/products"
                  className={`block px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${!categorySlug ? 'bg-primary text-secondary shadow-md' : 'text-secondary hover:bg-slate-50 hover:text-primary'}`}
                >
                  All Gear
                </Link>
              </li>
              {categories?.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/products?category=${category.slug}`}
                    className={`block px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${categorySlug === category.slug ? 'bg-primary text-secondary shadow-md' : 'text-secondary hover:bg-slate-50 hover:text-primary'}`}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-100 hidden md:block">
              <h3 className="text-sm font-black text-secondary uppercase tracking-widest mb-4">
                Need Help?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4 font-medium">
                Can&apos;t find what you&apos;re looking for? Contact our gear experts for advice.
              </p>
              <Link
                href="/contact"
                className="text-xs font-black text-primary-ink uppercase hover:underline"
              >
                Contact Us &rarr;
              </Link>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex flex-col mb-10">
              <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">
                {categorySlug
                  ? categories?.find((c) => c.slug === categorySlug)?.name || 'Gear'
                  : 'All Catch-22 Gear'}
              </h1>
              <div className="h-1.5 w-24 bg-primary mt-3" />
            </div>

            {products?.length === 0 ? (
              <div className="text-center py-24 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-500 font-bold uppercase tracking-widest">
                  No gear found in this category.
                </p>
                <Link
                  href="/products"
                  className="inline-block mt-4 text-primary-ink font-black uppercase text-sm hover:underline"
                >
                  View all products
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-y-12 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {formattedProducts?.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
