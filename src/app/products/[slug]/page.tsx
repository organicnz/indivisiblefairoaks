import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AddToCartButton } from '@/components/checkout/AddToCartButton';
import { ProductSlider } from '@/components/products/ProductSlider';
import { WishlistButton } from '@/components/products/WishlistButton';
import { DataPoint } from '@/components/ui/DataPoint';
import { CURRENCY_CODE, SHIPPING_RATES } from '@/config/commerce';
import { ROBOTS, SITE_NAME, siteUrl } from '@/config/site';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import {
  getAllProductSlugs,
  getProductDetail,
  getProductMeta,
  getRelatedProducts,
} from '@/lib/queries/products';
import { htmlToExcerpt, sanitizeWPContent } from '@/lib/sanitize';
import { getStorageUrl } from '@/lib/supabase';
import { serializeJsonLd } from '@/lib/utils';
import type { Json } from '@/types/supabase';

export async function generateStaticParams() {
  return getAllProductSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const product = await getProductMeta(slug);

  if (!product) {
    // A delisted or mistyped slug must not return an indexable page.
    return { title: 'Product Not Found', robots: ROBOTS.noindex };
  }

  return pageMetadata({
    title: product.name,
    description: htmlToExcerpt(product.short_description || product.description || ''),
    path: `/products/${slug}`,
    images: product.image_url ? [{ url: getStorageUrl(product.image_url) }] : undefined,
  });
}

export default async function ProductDetails({ params }: { params: Promise<{ slug: string }> }) {
  // Pre-check: validate the slug exists before committing the PPR static shell.
  // If we let notFound() fire inside the Suspense boundary the initial HTTP
  // response is already 200 (PPR shell committed). Checking here ensures the
  // 404 status propagates correctly in the initial response.
  const slug = (await params).slug;
  await connection();
  const product = await getProductDetail(slug);
  if (!product) {
    notFound();
  }
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetailsBody params={params} />
    </Suspense>
  );
}

function ProductSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--header-h) pb-12 sm:py-20 animate-pulse">
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          <div className="aspect-square rounded-3xl bg-surface-muted" />
          <div className="mt-8 lg:mt-0 space-y-6">
            <div className="h-10 w-3/4 bg-surface-muted rounded" />
            <div className="h-6 w-1/4 bg-surface-muted rounded" />
            <div className="space-y-3 pt-4">
              {['90%', '81%', '72%', '63%', '45%'].map((width) => (
                <div key={width} className="h-4 bg-surface-muted rounded" style={{ width }} />
              ))}
            </div>
            <div className="h-14 w-56 bg-surface-muted rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function ProductDetailsBody({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [product, dataPoints] = await Promise.all([
    getProductDetail(slug),
    getDataPoints('products'),
  ]);

  if (!product) {
    return notFound();
  }

  const productUrl = siteUrl(`/products/${slug}`);
  const price = Number(product.sale_price ?? product.price ?? 0);
  const inStock = product.stock_status === 'instock';
  const productImage = product.image_url ? [getStorageUrl(product.image_url)] : undefined;
  const description =
    sanitizeWPContent(
      (product.short_description || product.description || '').replace(/<[^>]*>?/gm, ' ')
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300) || undefined;

  // Google Merchant Center rejects listings whose Offer omits shipping and return
  // policy, and product snippets require `brand`. Both were absent, so no product
  // page could surface a price in the SERP.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.name,
    description,
    image: productImage,
    url: productUrl,
    sku: String(product.id),
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      // Read from the single commerce source of truth. This previously read 'USD'
      // while Stripe charged 'nzd' — a mismatch that is grounds for a Merchant
      // Center disapproval and was simply wrong for a California chapter.
      priceCurrency: CURRENCY_CODE,
      price: price.toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      eligibleRegion: { '@type': 'Country', name: 'US' },
      seller: { '@id': `${siteUrl('/')}#organization` },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: String(SHIPPING_RATES[0].amount / 100),
          currency: CURRENCY_CODE,
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 2,
            maxValue: 5,
            unitCode: 'DAY',
          },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Materials',
        item: siteUrl('/products'),
      },
      { '@type': 'ListItem', position: 3, name: product.name, item: productUrl },
    ],
  };

  // Fetch related products from the same category
  interface RelatedProduct {
    id: number;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
    stock_status: string | null;
    product_categories: { category_id: number }[];
  }

  const categoryIds =
    (product.product_categories as { category_id: number }[])?.map((pc) => pc.category_id) || [];

  const relatedProducts: RelatedProduct[] =
    categoryIds.length > 0 ? await getRelatedProducts(product.id, categoryIds) : [];

  return (
    <div className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        // Structured data, not WP content: sanitizeWPContent intentionally not applied
        dangerouslySetInnerHTML={{ __html: serializeJsonLd([jsonLd, breadcrumbLd]) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--header-h) pb-12 sm:py-20">
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          {/* Image gallery */}
          <div className="flex flex-col">
            <div className="aspect-square rounded-3xl overflow-hidden bg-surface-muted relative border border-border shadow-inner">
              {product.image_url ? (
                <Image
                  src={getStorageUrl(product.image_url)}
                  alt={product.name}
                  fill
                  // The container is a `lg:col-span-6` square, so the image is
                  // half the viewport on desktop and full width on mobile. Without
                  // this, `fill` assumes 100vw and the LCP image is served at
                  // roughly twice the width it is displayed at.
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="bg-surface-muted flex items-center justify-center h-full rounded-3xl">
                  <span className="text-muted-foreground font-black uppercase text-xs tracking-widest">
                    <DataPoint name="wishlist.item.no_image" initialData={dataPoints}>
                      No Image
                    </DataPoint>
                  </span>
                </div>
              )}
            </div>

            {/* Gallery placeholder if more images existed */}
            {product.gallery_urls &&
              Array.isArray(product.gallery_urls) &&
              product.gallery_urls.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
                  {(product.gallery_urls as string[]).slice(0, 4).map((url: string) => (
                    <div
                      key={url}
                      className="aspect-square relative rounded-xl overflow-hidden bg-surface-muted border border-border"
                    >
                      <Image
                        src={getStorageUrl(url)}
                        alt={`${product.name} gallery image`}
                        fill
                        sizes="(max-width: 1024px) 22vw, 12vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0 flex flex-col">
            <div className="mb-6">
              <nav className="flex mb-4" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <li>
                    <Link
                      href="/products"
                      className="hover:text-primary dark:hover:text-primary-on-dark transition-colors"
                    >
                      <DataPoint name="product.nav.gear" initialData={dataPoints}>
                        Gear
                      </DataPoint>
                    </Link>
                  </li>
                  <li>
                    <span className="mx-1">/</span>
                  </li>
                  <li className="text-primary dark:text-primary-on-dark truncate">
                    {product.name}
                  </li>
                </ol>
              </nav>
              <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-tight mb-4">
                {product.name}
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-black text-primary dark:text-primary-on-dark">
                    ${product.price.toFixed(2)}
                  </p>
                  {product.sale_price &&
                    product.regular_price &&
                    (product.regular_price as number) > product.price && (
                      <p className="text-lg font-bold text-muted-foreground line-through decoration-primary/40 decoration-2">
                        ${(product.regular_price as number).toFixed(2)}
                      </p>
                    )}
                </div>
                {product.stock_status === 'instock' ? (
                  <span className="bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border">
                    <DataPoint name="product.stock.in_stock" initialData={dataPoints}>
                      In Stock
                    </DataPoint>
                  </span>
                ) : (
                  <span className="bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border">
                    <DataPoint name="product.stock.out_of_stock" initialData={dataPoints}>
                      Out of Stock
                    </DataPoint>
                  </span>
                )}
              </div>
            </div>

            <div className="prose prose-slate max-w-none">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-4 border-b border-border pb-2">
                <DataPoint name="product.details.description_heading" initialData={dataPoints}>
                  Description
                </DataPoint>
              </h3>
              <div
                className="text-base text-slate-600 dark:text-ink-on-dark leading-relaxed space-y-4"
                dangerouslySetInnerHTML={{
                  __html: sanitizeWPContent(product.description || product.short_description || ''),
                }}
              />
            </div>

            <div className="mt-10 pt-10 border-t border-border flex flex-col gap-4">
              <AddToCartButton
                product={{
                  ...product,
                  stock_status: product.stock_status || 'instock',
                }}
                variations={
                  (
                    product.product_variations as unknown as {
                      id: number;
                      price: number | null;
                      attributes: Json | null;
                      stock_status: string | null;
                    }[]
                  )?.map((v) => ({
                    id: v.id,
                    price: v.price || 0,
                    attributes: (v.attributes as Record<string, string>) || {},
                    stock_status: v.stock_status,
                  })) || []
                }
              />
              <WishlistButton product={product} showText={true} />
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-muted rounded-2xl border border-border flex flex-col items-center text-center">
                <span className="text-[10px] font-black text-foreground uppercase tracking-widest mb-1">
                  <DataPoint name="product.shipping.title" initialData={dataPoints}>
                    Shipping &amp; Pickup
                  </DataPoint>
                </span>
                <span className="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-bold uppercase tracking-tight">
                  <DataPoint name="product.shipping.desc" initialData={dataPoints}>
                    Local Pickup &amp; Fast Shipping
                  </DataPoint>
                </span>
              </div>
              <div className="p-4 bg-surface-muted rounded-2xl border border-border flex flex-col items-center text-center">
                <span className="text-[10px] font-black text-foreground uppercase tracking-widest mb-1">
                  <DataPoint name="product.impact.title" initialData={dataPoints}>
                    Grassroots Impact
                  </DataPoint>
                </span>
                <span className="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-bold uppercase tracking-tight">
                  <DataPoint name="product.impact.desc" initialData={dataPoints}>
                    100% Funds Community Actions
                  </DataPoint>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-32 pb-16 border-t border-border pt-24">
            <div className="flex flex-col items-center mb-16">
              <h2 className="text-4xl font-black tracking-tighter text-foreground uppercase">
                <DataPoint name="product.related.headline" initialData={dataPoints}>
                  You might also like
                </DataPoint>
              </h2>
              <div className="h-2 w-24 bg-primary mt-4 rounded-full" />
            </div>
            <ProductSlider products={relatedProducts} />
          </div>
        )}
      </div>
    </div>
  );
}
