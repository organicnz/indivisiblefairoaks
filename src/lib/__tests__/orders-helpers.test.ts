import { describe, expect, it } from 'vitest';
import {
  formatAddress,
  formatDate,
  type ShippingAddress,
  STATUS_STYLES,
  statusStyle,
} from '@/types/orders';

describe('orders helper functions and styles', () => {
  describe('formatAddress', () => {
    it('returns "No address" when address is null or undefined', () => {
      expect(formatAddress(null)).toBe('No address');
      expect(formatAddress(undefined as unknown as null)).toBe('No address');
    });

    it('formats a full standard ShippingAddress', () => {
      const addr: ShippingAddress = {
        line1: '123 Democracy Way',
        line2: 'Suite 400',
        city: 'Fair Oaks',
        state: 'CA',
        postal_code: '95628',
        country: 'USA',
      };
      expect(formatAddress(addr)).toBe('123 Democracy Way, Suite 400, Fair Oaks, 95628, USA');
    });

    it('formats address without line2', () => {
      const addr: ShippingAddress = {
        line1: '456 Sunrise Ave',
        city: 'Carmichael',
        state: 'CA',
        postal_code: '95608',
        country: 'USA',
      };
      expect(formatAddress(addr)).toBe('456 Sunrise Ave, Carmichael, 95608, USA');
    });

    it('supports WooCommerce legacy key names (address_1, address_2, postcode)', () => {
      const wooAddr = {
        address_1: '789 Fair Oaks Blvd',
        address_2: 'Apt B',
        city: 'Fair Oaks',
        postcode: '95628',
        country: 'US',
      };
      expect(formatAddress(wooAddr)).toBe('789 Fair Oaks Blvd, Apt B, Fair Oaks, 95628, US');
    });

    it('handles partially populated address without extra commas', () => {
      const partial = {
        city: 'Sacramento',
        country: 'USA',
      };
      expect(formatAddress(partial)).toBe('Sacramento, USA');
    });
  });

  describe('formatDate', () => {
    it('returns "N/A" for null, undefined, or empty string', () => {
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate('')).toBe('N/A');
      expect(formatDate(undefined as unknown as null)).toBe('N/A');
    });

    it('formats valid ISO date string in en-US locale by default', () => {
      const formatted = formatDate('2026-11-10T19:00:00Z');
      expect(formatted).toMatch(/Nov 10, 2026/);
    });

    it('accepts custom Intl.DateTimeFormatOptions', () => {
      const formatted = formatDate('2026-11-10T19:00:00Z', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
      });
      expect(formatted).toBe('11/10/26');
    });
  });

  describe('statusStyle and STATUS_STYLES', () => {
    const knownStatuses = ['completed', 'cancelled', 'refunded', 'on-hold', 'processing'] as const;

    it.each(knownStatuses)('returns distinct styling for %s', (status) => {
      const style = statusStyle(status);
      expect(style).toBe(STATUS_STYLES[status]);
      expect(style.length).toBeGreaterThan(0);
    });

    it('falls back to processing style for null, empty or unknown status', () => {
      expect(statusStyle(null)).toBe(STATUS_STYLES.processing);
      expect(statusStyle('')).toBe(STATUS_STYLES.processing);
      expect(statusStyle('unknown-status-xyz')).toBe(STATUS_STYLES.processing);
    });

    it.each(knownStatuses)(
      'ensures %s style carries both light and dark mode classes',
      (status) => {
        const style = STATUS_STYLES[status];
        // Assert both light surface and dark surface tokens exist for WCAG accessibility
        expect(style).toContain('bg-');
        expect(style).toContain('text-');
        expect(style).toContain('dark:bg-');
        expect(style).toContain('dark:text-');
      }
    );
  });
});
