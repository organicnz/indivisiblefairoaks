import { cacheLife, cacheTag } from 'next/cache';
import { env } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase-server';

export async function getAllProductSlugs() {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  // Throwaway E2E test bundles only need fixture routes prerendered; dynamic routes
  // render on-demand at runtime. Avoids querying remote catalog and ballooning build time/memory.
  if (env.NEXT_E2E_BUILD === 'true') {
    return [{ slug: 'defend-democracy-yard-sign' }];
  }
  try {
    const supabase = createPublicClient();
    const { data } = await supabase.from('products').select('slug').eq('stock_status', 'instock');
    const slugs = (data ?? []).map((row) => ({ slug: row.slug }));
    return slugs.length > 0 ? slugs : [{ slug: '_sample' }];
  } catch {
    return [{ slug: '_sample' }];
  }
}

export async function getProductMeta(slug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('products', `product-${slug}`);
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('products')
    .select('name, short_description, description, image_url')
    .eq('slug', slug)
    .single();
  return data;
}

export async function getProductDetail(slug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('products', `product-${slug}`);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      product_categories (
        category_id
      ),
      product_variations (*)
    `
    )
    .eq('slug', slug)
    .single();
  return error ? null : data;
}

export async function getRelatedProducts(productId: number, categoryIds: number[]) {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  const supabase = createPublicClient();
  const { data: related } = await supabase
    .from('products')
    .select(
      `
      id, name, slug, price, image_url, stock_status,
      product_categories!inner (category_id)
    `
    )
    .in('product_categories.category_id', categoryIds)
    .neq('id', productId)
    .eq('stock_status', 'instock')
    .limit(4);

  if (!related) return [];

  // Filter duplicates locally if the query returns multiple due to multiple categories
  const uniqueIds = new Set<number>();
  return related.filter((p) => {
    if (!uniqueIds.has(p.id)) {
      uniqueIds.add(p.id);
      return true;
    }
    return false;
  });
}
