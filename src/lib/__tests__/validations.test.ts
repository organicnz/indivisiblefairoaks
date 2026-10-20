// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { productSchema, profileSchema } from '@/lib/validations';

// ─── productSchema ────────────────────────────────────────────────────────────
describe('productSchema', () => {
  const valid = {
    id: 1,
    name: 'Kingfish Rig',
    slug: 'kingfish-rig',
    price: 29.99,
    regular_price: null,
    sale_price: null,
    description: 'A top-tier rig.',
    short_description: 'Great rig.',
    image_url: 'https://example.com/img.jpg',
    gallery_urls: ['https://example.com/a.jpg'],
    stock_status: 'instock' as const,
    sku: 'KFR-001',
    stripe_product_id: 'prod_123',
    stripe_price_id: 'price_123',
  };

  it('parses a fully valid product', () => {
    expect(() => productSchema.parse(valid)).not.toThrow();
  });

  it('accepts null nullable fields', () => {
    const minimal = { ...valid, description: null, image_url: null, gallery_urls: null, sku: null };
    expect(() => productSchema.parse(minimal)).not.toThrow();
  });

  it('rejects negative price', () => {
    expect(() => productSchema.parse({ ...valid, price: -1 })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => productSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects empty slug', () => {
    expect(() => productSchema.parse({ ...valid, slug: '' })).toThrow();
  });

  it('rejects invalid stock_status', () => {
    expect(() => productSchema.parse({ ...valid, stock_status: 'unknown' })).toThrow();
  });

  it('accepts all valid stock_status values', () => {
    for (const status of ['instock', 'outofstock', 'onbackorder'] as const) {
      expect(() => productSchema.parse({ ...valid, stock_status: status })).not.toThrow();
    }
  });

  it('accepts zero price', () => {
    expect(() => productSchema.parse({ ...valid, price: 0 })).not.toThrow();
  });
});

// ─── profileSchema ────────────────────────────────────────────────────────────
describe('profileSchema', () => {
  const valid = {
    id: 1,
    user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'supporter@indivisiblefairoaks.org',
    first_name: 'Mike',
    last_name: 'Fisher',
    username: 'mikef',
    stripe_customer_id: 'cus_abc123',
    settings: { order_updates: true },
  };

  it('parses a fully valid profile', () => {
    expect(() => profileSchema.parse(valid)).not.toThrow();
  });

  it('accepts null nullable fields', () => {
    const minimal = {
      ...valid,
      user_id: null,
      first_name: null,
      last_name: null,
      username: null,
      stripe_customer_id: null,
      settings: null,
    };
    expect(() => profileSchema.parse(minimal)).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => profileSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();
  });

  it('rejects invalid UUID for user_id', () => {
    expect(() => profileSchema.parse({ ...valid, user_id: 'not-a-uuid' })).toThrow();
  });

  it('accepts null user_id', () => {
    expect(() => profileSchema.parse({ ...valid, user_id: null })).not.toThrow();
  });
});
