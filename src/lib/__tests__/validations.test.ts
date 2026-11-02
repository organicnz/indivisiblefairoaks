// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { profileSchema } from '@/lib/validations';

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
