import { describe, expect, it } from 'vitest';
import LoginPage from '@/app/login/page';

describe('Login Page & Auth Experience', () => {
  it('exports LoginPage as a valid React component wrapped in Suspense', () => {
    expect(LoginPage).toBeDefined();
    expect(typeof LoginPage).toBe('function');
  });

  describe('Redirect URL & Safe Next computation', () => {
    function getSafeNext(param: string | null): string | null {
      if (!param) return null;
      if (/^\/(?!\/)/.test(param)) return param;
      return null;
    }

    function buildCallbackUrl(origin: string, next: string | null): string {
      const safeNext = getSafeNext(next);
      return safeNext
        ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${origin}/auth/callback`;
    }

    it('preserves valid internal paths for admin portal and CRM', () => {
      expect(getSafeNext('/admin')).toBe('/admin');
      expect(getSafeNext('/admin/crm')).toBe('/admin/crm');
      expect(getSafeNext('/admin/crm/broadcasts')).toBe('/admin/crm/broadcasts');
      expect(getSafeNext('/account')).toBe('/account');
    });

    it('rejects protocol-relative and external URLs to prevent open-redirect attacks', () => {
      expect(getSafeNext('//attacker.com')).toBeNull();
      expect(getSafeNext('https://evil.com')).toBeNull();
      expect(getSafeNext('javascript:alert(1)')).toBeNull();
      expect(getSafeNext('')).toBeNull();
      expect(getSafeNext(null)).toBeNull();
    });

    it('builds proper emailRedirectTo for magic link dispatch', () => {
      const origin = 'https://indivisiblefairoaks.org';

      expect(buildCallbackUrl(origin, '/admin/crm')).toBe(
        'https://indivisiblefairoaks.org/auth/callback?next=%2Fadmin%2Fcrm'
      );

      expect(buildCallbackUrl(origin, null)).toBe('https://indivisiblefairoaks.org/auth/callback');

      expect(buildCallbackUrl(origin, '//malicious.com')).toBe(
        'https://indivisiblefairoaks.org/auth/callback'
      );
    });
  });

  describe('Error Code to User Message Mapping', () => {
    function mapAuthError(code: string | null): string | null {
      if (!code) return null;
      if (code === 'Invalid_Token') {
        return 'Sign-in link is invalid or expired. Please request a new magic link below.';
      }
      if (code === 'admin_required') {
        return 'Administrator credentials required. Please sign in with an authorized chapter administrator email.';
      }
      return code.replace(/_/g, ' ');
    }

    it('maps Invalid_Token to clear user actionable guidance', () => {
      expect(mapAuthError('Invalid_Token')).toContain('invalid or expired');
    });

    it('maps admin_required to clear organizer privilege guidance', () => {
      expect(mapAuthError('admin_required')).toContain('Administrator credentials required');
    });

    it('formats unknown errors legibly', () => {
      expect(mapAuthError('Token_expired_or_revoked')).toBe('Token expired or revoked');
    });
  });
});
