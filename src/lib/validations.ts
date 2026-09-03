import { z } from 'zod';
import type { Database } from '@/types/supabase';

type ProductRow = Database['public']['Tables']['products']['Row'];

export const productSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  slug: z.string().min(1),
  price: z.number().nonnegative(),
  regular_price: z.number().nullable(),
  sale_price: z.number().nullable(),
  description: z.string().nullable(),
  short_description: z.string().nullable(),
  image_url: z.string().nullable(),
  gallery_urls: z.array(z.string()).nullable(),
  stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).nullable(),
  sku: z.string().nullable(),
  stripe_product_id: z.string().nullable(),
  stripe_price_id: z.string().nullable(),
}) satisfies z.ZodType<Partial<ProductRow>>;

export const profileSchema = z.object({
  id: z.number(),
  user_id: z.string().uuid().nullable(),
  email: z.string().email(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  username: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  settings: z.record(z.string(), z.any()).nullable(),
});

export type Product = z.infer<typeof productSchema>;
export type Profile = z.infer<typeof profileSchema>;
