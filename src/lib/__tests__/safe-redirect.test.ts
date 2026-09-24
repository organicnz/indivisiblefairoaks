import { describe, expect, it } from 'vitest';
import { getSafeNextPath } from '@/lib/safe-redirect';

describe('getSafeNextPath', () => {
  it('preserves internal paths, queries, and fragments', () => {
    expect(getSafeNextPath('/account?tab=settings#orders')).toBe('/account?tab=settings#orders');
  });

  it('rejects external and protocol-relative URLs', () => {
    expect(getSafeNextPath('https://evil.example')).toBeNull();
    expect(getSafeNextPath('//evil.example')).toBeNull();
  });

  it('rejects backslash and encoded backslash variants', () => {
    expect(getSafeNextPath('/\\evil.example')).toBeNull();
    expect(getSafeNextPath('/%5C%5Cevil.example')).toBeNull();
    expect(getSafeNextPath('/%2F%2Fevil.example')).toBeNull();
  });

  it('rejects malformed and control-character paths', () => {
    expect(getSafeNextPath('/%E0%A4%A')).toBeNull();
    expect(getSafeNextPath('/account%00admin')).toBeNull();
  });

  it('uses the supplied fallback for rejected values', () => {
    expect(getSafeNextPath('https://evil.example', '/account')).toBe('/account');
  });
});
