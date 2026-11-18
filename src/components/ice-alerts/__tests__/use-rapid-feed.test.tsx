// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRapidFeed } from '@/components/ice-alerts/use-rapid-feed';

const fetchWithTimeout = vi.hoisted(() => vi.fn());

vi.mock('@/lib/service-fetch', () => ({
  fetchWithTimeout,
  ServiceTimeoutError: class ServiceTimeoutError extends Error {
    constructor(timeoutMs: number) {
      super(`Service request timed out after ${timeoutMs}ms`);
      this.name = 'ServiceTimeoutError';
    }
  },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FEED = {
  generatedAt: '2026-11-15T06:00:00.000Z',
  community: {
    status: 'ok',
    sourceName: 'Stop ICE Alerts Network',
    sourceUrl: 'https://stopice.net/',
    checkedAt: '2026-11-15T06:00:00.000Z',
    latestAt: '2026-11-15T03:00:00.000Z',
    itemCount: 1,
    note: 'ok',
  },
  official: {
    status: 'ok',
    sourceName: 'ICE Newsroom',
    sourceUrl: 'https://www.ice.gov/newsroom',
    checkedAt: '2026-11-15T06:00:00.000Z',
    latestAt: '2026-11-09T20:57:26.000Z',
    itemCount: 0,
    note: 'ok',
  },
  alerts: [],
  officialReleases: [],
  publicCases: [],
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function Probe() {
  const { feed, status, error, refresh } = useRapidFeed();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="feed">{feed?.generatedAt ?? 'none'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}

describe('useRapidFeed', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    fetchWithTimeout.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the last successful feed when a refresh fails', async () => {
    fetchWithTimeout.mockResolvedValueOnce(response(FEED));

    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('ready');
    expect(container.querySelector('[data-testid="feed"]')?.textContent).toBe(FEED.generatedAt);
    expect(container.querySelector('[data-testid="error"]')?.textContent).toBe('');

    fetchWithTimeout.mockResolvedValueOnce(response({ error: 'unavailable' }, 400));

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('ready');
    expect(container.querySelector('[data-testid="feed"]')?.textContent).toBe(FEED.generatedAt);
    expect(container.querySelector('[data-testid="error"]')?.textContent).toContain(
      'Feed returned 400'
    );
  });
});
