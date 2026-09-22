'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { assertMfaVerified } from '@/lib/mfa-guard';
import { getStorageUrl } from '@/lib/supabase';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

const VALID_STATUSES = ['processing', 'completed', 'cancelled', 'refunded', 'on-hold'];
const VALID_STOCK = ['instock', 'outofstock', 'onbackorder'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/media/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split('?')[0];
  return path || null;
}

async function deleteStoredImage(path: string | null) {
  if (!path) return;
  try {
    const adminClient = await requireAdminClient();
    await adminClient.storage.from('media').remove([path]);
  } catch {
    // Best effort — a stale orphaned file is not worth failing the action
  }
}

async function requireAdminClient() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) throw new Error(mfa.error);

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .single();

  if (!profile?.is_admin) throw new Error('Not authorised');
  return adminClient;
}

export async function updateOrderStatus(orderId: number, status: string) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid status');
  }
  const adminClient = await requireAdminClient();
  const { error } = await adminClient.from('orders').update({ status }).eq('id', orderId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/account');
}

export async function bulkUpdateOrderStatus(orderIds: number[], status: string) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid status');
  }
  if (orderIds.length === 0) {
    throw new Error('No orders selected');
  }
  if (orderIds.length > 200) {
    throw new Error('Select at most 200 orders at once');
  }
  const adminClient = await requireAdminClient();
  const { error } = await adminClient.from('orders').update({ status }).in('id', orderIds);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/account');
}

export async function updateFulfillment(
  orderId: number,
  payload: { tracking_number?: string | null; admin_notes?: string | null }
) {
  if (payload.tracking_number !== undefined && (payload.tracking_number || '').length > 200) {
    throw new Error('Tracking number is too long (max 200 chars)');
  }
  if (payload.admin_notes !== undefined && (payload.admin_notes || '').length > 2000) {
    throw new Error('Admin notes are too long (max 2000 chars)');
  }
  const adminClient = await requireAdminClient();
  const update: { tracking_number?: string | null; admin_notes?: string | null } = {};
  if (payload.tracking_number !== undefined) {
    update.tracking_number = payload.tracking_number === '' ? null : payload.tracking_number;
  }
  if (payload.admin_notes !== undefined) {
    update.admin_notes = payload.admin_notes === '' ? null : payload.admin_notes;
  }
  const { error } = await adminClient.from('orders').update(update).eq('id', orderId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function updateProduct(payload: {
  id: number;
  name?: string;
  price?: number;
  regular_price?: number | null;
  stock_status?: string;
  short_description?: string;
  description?: string;
}) {
  const { id, ...fields } = payload;
  if (fields.price !== undefined && (!Number.isFinite(fields.price) || fields.price < 0)) {
    throw new Error('Price must be a non-negative number');
  }
  if (fields.regular_price !== undefined && fields.regular_price !== null) {
    if (!Number.isFinite(fields.regular_price) || fields.regular_price < 0) {
      throw new Error('Compare-at price must be a non-negative number');
    }
  }
  if (fields.short_description !== undefined && fields.short_description.length > 2000) {
    throw new Error('Short description is too long (max 2000 chars)');
  }
  if (fields.description !== undefined && fields.description.length > 50000) {
    throw new Error('Description is too long (max 50000 chars)');
  }
  if (fields.stock_status !== undefined && !VALID_STOCK.includes(fields.stock_status)) {
    throw new Error('Invalid stock status');
  }
  if (fields.name !== undefined && fields.name.trim().length === 0) {
    throw new Error('Name cannot be empty');
  }

  const adminClient = await requireAdminClient();
  // Fetch slug before update so we can invalidate the per-slug cache entry.
  const { data: existing } = await adminClient
    .from('products')
    .select('slug')
    .eq('id', id)
    .single();
  const { error } = await adminClient
    .from('products')
    .update({ ...fields, name: fields.name?.trim() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  updateTag('products');
  if (existing?.slug) updateTag(`product-${existing.slug}`);
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${id}`);
  revalidatePath('/products');
  if (existing?.slug) revalidatePath(`/products/${existing.slug}`);
}

export async function bulkUpdateProductStock(productIds: number[], stockStatus: string) {
  if (!VALID_STOCK.includes(stockStatus)) {
    throw new Error('Invalid stock status');
  }
  if (productIds.length === 0) {
    throw new Error('No products selected');
  }
  if (productIds.length > 200) {
    throw new Error('Select at most 200 products at once');
  }
  const adminClient = await requireAdminClient();
  const { error } = await adminClient
    .from('products')
    .update({ stock_status: stockStatus })
    .in('id', productIds);
  if (error) throw new Error(error.message);
  updateTag('products');
  revalidatePath('/admin/products');
  revalidatePath('/products');
}

export async function createProduct(payload: {
  name: string;
  price: number;
  regular_price?: number | null;
  stock_status?: string;
  short_description?: string;
  description?: string;
}): Promise<number> {
  const name = payload.name.trim();
  if (!name) throw new Error('Name cannot be empty');
  if (name.length > 255) throw new Error('Name is too long (max 255 chars)');
  if (!Number.isFinite(payload.price) || payload.price < 0) {
    throw new Error('Price must be a non-negative number');
  }
  if (payload.regular_price !== undefined && payload.regular_price !== null) {
    if (!Number.isFinite(payload.regular_price) || payload.regular_price < 0) {
      throw new Error('Compare-at price must be a non-negative number');
    }
  }
  if (payload.short_description && payload.short_description.length > 2000) {
    throw new Error('Short description is too long (max 2000 chars)');
  }
  if (payload.description && payload.description.length > 50000) {
    throw new Error('Description is too long (max 50000 chars)');
  }
  const stockStatus = payload.stock_status || 'instock';
  if (!VALID_STOCK.includes(stockStatus)) throw new Error('Invalid stock status');

  const adminClient = await requireAdminClient();

  const baseSlug = slugify(name) || 'product';
  const { data: existing } = await adminClient
    .from('products')
    .select('slug')
    .like('slug', `${baseSlug}%`);
  const taken = new Set((existing || []).map((r) => r.slug));
  let slug = baseSlug;
  let n = 2;
  while (taken.has(slug)) slug = `${baseSlug}-${n++}`;

  const { data, error } = await adminClient
    .from('products')
    .insert({
      name,
      slug,
      price: payload.price,
      regular_price: payload.regular_price ?? null,
      stock_status: stockStatus,
      short_description: payload.short_description?.trim() || null,
      description: payload.description?.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  updateTag('products');
  revalidatePath('/admin/products');
  revalidatePath('/products');
  return data.id;
}

export async function uploadProductImage(formData: FormData): Promise<{ url: string }> {
  const file = formData.get('file');
  const productId = Number(formData.get('productId'));
  if (!(file instanceof File)) throw new Error('No file provided');
  // Raster allowlist only: SVG is active content and executes on the
  // storefront/storage origin (stored XSS). Reject it explicitly.
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('File must be JPEG, PNG, WebP, or GIF (SVG not allowed)');
  }
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Image must be 5MB or smaller');
  if (!Number.isInteger(productId) || productId <= 0) throw new Error('Invalid product');

  const adminClient = await requireAdminClient();
  const { data: product } = await adminClient
    .from('products')
    .select('image_url, slug')
    .eq('id', productId)
    .single();
  if (!product) throw new Error('Product not found');

  const extMap: Record<string, string> = {
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
  };
  const ext = extMap[file.type.split('/')[1]] || 'png';
  const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'image';
  const path = `products/${productId}/${Date.now()}-${base.slice(0, 40)}.${ext}`;

  const { error: uploadError } = await adminClient.storage
    .from('media')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const url = getStorageUrl(path);
  const { error } = await adminClient
    .from('products')
    .update({ image_url: url })
    .eq('id', productId);
  if (error) throw new Error(error.message);

  await deleteStoredImage(storagePathFromUrl(product.image_url));
  updateTag('products');
  if (product.slug) updateTag(`product-${product.slug}`);
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/products');
  if (product.slug) revalidatePath(`/products/${product.slug}`);
  return { url };
}

export async function removeProductImage(productId: number) {
  if (!Number.isInteger(productId) || productId <= 0) throw new Error('Invalid product');
  const adminClient = await requireAdminClient();
  const { data: product } = await adminClient
    .from('products')
    .select('image_url, slug')
    .eq('id', productId)
    .single();
  if (!product) throw new Error('Product not found');

  const { error } = await adminClient
    .from('products')
    .update({ image_url: null })
    .eq('id', productId);
  if (error) throw new Error(error.message);

  await deleteStoredImage(storagePathFromUrl(product.image_url));
  updateTag('products');
  if (product.slug) updateTag(`product-${product.slug}`);
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/products');
  if (product.slug) revalidatePath(`/products/${product.slug}`);
}

export async function createCoupon(payload: {
  code: string;
  discount_type: 'percent' | 'fixed';
  amount: number;
  expiry_date?: string | null;
}) {
  const code = payload.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,50}$/.test(code)) {
    throw new Error('Code must be 3-50 chars of A-Z, 0-9 or -');
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (payload.discount_type === 'percent' && payload.amount > 99) {
    throw new Error('Percent discounts must be between 1 and 99');
  }
  if (payload.expiry_date && Number.isNaN(new Date(payload.expiry_date).getTime())) {
    throw new Error('Invalid expiry date');
  }

  const adminClient = await requireAdminClient();
  const { data: existing } = await adminClient
    .from('coupons')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (existing) throw new Error(`Coupon ${code} already exists`);

  const { error } = await adminClient.from('coupons').insert({
    code,
    discount_type: payload.discount_type,
    amount: payload.amount,
    expiry_date: payload.expiry_date || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/coupons');
}

export async function updateCoupon(
  id: number,
  payload: {
    code?: string;
    discount_type?: 'percent' | 'fixed';
    amount?: number;
    expiry_date?: string | null;
  }
) {
  if (payload.amount !== undefined && (!Number.isFinite(payload.amount) || payload.amount <= 0)) {
    throw new Error('Amount must be a positive number');
  }
  if (payload.discount_type === 'percent' && payload.amount !== undefined && payload.amount > 99) {
    throw new Error('Percent discounts must be between 1 and 99');
  }
  if (
    payload.expiry_date !== undefined &&
    payload.expiry_date !== null &&
    Number.isNaN(new Date(payload.expiry_date).getTime())
  ) {
    throw new Error('Invalid expiry date');
  }

  const adminClient = await requireAdminClient();
  const update: {
    code?: string;
    discount_type?: 'percent' | 'fixed';
    amount?: number;
    expiry_date?: string | null;
  } = { ...payload };
  if (payload.code) update.code = payload.code.trim().toUpperCase();
  const { error } = await adminClient.from('coupons').update(update).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/coupons');
}

export async function deleteCoupon(id: number) {
  const adminClient = await requireAdminClient();
  const { error } = await adminClient.from('coupons').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/coupons');
}

export async function markAdminUser(profileId: string, isAdmin: boolean) {
  const adminClient = await requireAdminClient();
  const { error } = await adminClient
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/customers');
}
