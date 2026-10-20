// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getTotpEnrollmentUri } from '@/lib/mfa';

describe('getTotpEnrollmentUri', () => {
  it('returns a valid TOTP enrollment URI', () => {
    expect(getTotpEnrollmentUri({ uri: 'otpauth://totp/Indivisible:test?secret=ABC' })).toBe(
      'otpauth://totp/Indivisible:test?secret=ABC'
    );
  });

  it('trims surrounding whitespace without changing the URI payload', () => {
    expect(getTotpEnrollmentUri({ uri: '  otpauth://totp/Indivisible:test?secret=ABC  ' })).toBe(
      'otpauth://totp/Indivisible:test?secret=ABC'
    );
  });

  it.each([
    null,
    undefined,
    {},
    { uri: '' },
    { uri: 'otpauth://hotp/test?secret=ABC' },
    { uri: 'data:image/svg+xml,<svg></svg>' },
  ])('rejects a non-TOTP or missing URI: %j', (data) => {
    expect(getTotpEnrollmentUri(data)).toBe('');
  });
});
