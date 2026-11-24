// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSupabaseAuthCookieName } from '@/lib/supabase-auth-cookie';

describe('isSupabaseAuthCookieName', () => {
  it('accepts a Supabase session cookie', () => {
    expect(isSupabaseAuthCookieName('sb-test-project-auth-token')).toBe(true);
  });

  it('accepts chunked Supabase session cookies', () => {
    expect(isSupabaseAuthCookieName('sb-test-project-auth-token.0')).toBe(true);
    expect(isSupabaseAuthCookieName('sb-test-project-auth-token.12')).toBe(true);
  });

  it('ignores unrelated auth cookies', () => {
    expect(isSupabaseAuthCookieName('sb-test-project-code-verifier')).toBe(false);
    expect(isSupabaseAuthCookieName('unrelated')).toBe(false);
  });
});
