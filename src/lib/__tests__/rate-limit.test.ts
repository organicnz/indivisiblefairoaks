import { afterEach, describe, expect, it } from 'vitest';
import { clientKey, rateLimit } from '@/lib/rate-limit';

describe('rateLimit()', () => {
  afterEach(() => {
    // Real time between tests keeps keys distinct; no shared-state leakage.
  });

  it('allows up to the limit then blocks with retry hint', () => {
    const now = 1_000_000;
    const clock = () => now;

    for (let i = 0; i < 10; i++) {
      expect(rateLimit('k1', 10, 60_000, clock).ok).toBe(true);
    }
    const blocked = rateLimit('k1', 10, 60_000, clock);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('unblocks after the window slides past old hits', () => {
    let now = 2_000_000;
    const clock = () => now;
    const key = 'k2-window';

    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 1000, clock).ok).toBe(true);
    expect(rateLimit(key, 3, 1000, clock).ok).toBe(false);

    now += 1001;
    expect(rateLimit(key, 3, 1000, clock).ok).toBe(true);
  });

  it('isolates keys from each other', () => {
    const now = 3_000_000;
    const clock = () => now;
    for (let i = 0; i < 5; i++) expect(rateLimit('a', 5, 60_000, clock).ok).toBe(true);
    expect(rateLimit('b', 5, 60_000, clock).ok).toBe(true);
  });
});

describe('clientKey()', () => {
  it('prefers the first x-forwarded-for hop', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 70.41.3.2' });
    expect(clientKey(headers, 'checkout')).toBe('checkout:203.0.113.9');
  });

  it('falls back to x-real-ip then unknown', () => {
    expect(clientKey(new Headers({ 'x-real-ip': '1.2.3.4' }), 'c')).toBe('c:1.2.3.4');
    expect(clientKey(new Headers(), 'c')).toBe('c:unknown');
  });
});
