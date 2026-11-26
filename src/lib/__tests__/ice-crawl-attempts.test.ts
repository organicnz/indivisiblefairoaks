// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { IceCrawlStore } from '@/lib/ice-crawl-store';
import { recordIceCrawlDiscoveryAttempt } from '@/lib/ice-crawl-store';
import { iceDiscoveryAttemptsExhausted } from '@/lib/ice-crawl-types';

function storeWithAttemptResult(result: {
  data: Array<{ status: string; attempt_count: number }> | null;
  error: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { rpc } as unknown as IceCrawlStore;
}

describe('discovery attempt ceiling', () => {
  it('keeps a candidate retryable below the ceiling', async () => {
    const store = storeWithAttemptResult({
      data: [{ status: 'pending', attempt_count: 5 }],
      error: null,
    });

    await expect(
      recordIceCrawlDiscoveryAttempt(store, 'row-1', 'auto retry: HTTP 503')
    ).resolves.toEqual({ outcome: 'retry', attemptCount: 5 });
  });

  it('reports exhaustion at the ceiling', async () => {
    const store = storeWithAttemptResult({
      data: [{ status: 'pending', attempt_count: 6 }],
      error: null,
    });

    await expect(
      recordIceCrawlDiscoveryAttempt(store, 'row-2', 'auto retry: HTTP 503')
    ).resolves.toEqual({ outcome: 'exhausted', attemptCount: 6 });
  });

  it('treats only the ceiling and above as exhausted', () => {
    expect(iceDiscoveryAttemptsExhausted(0)).toBe(false);
    expect(iceDiscoveryAttemptsExhausted(5)).toBe(false);
    expect(iceDiscoveryAttemptsExhausted(6)).toBe(true);
    expect(iceDiscoveryAttemptsExhausted(null)).toBe(false);
  });
});
