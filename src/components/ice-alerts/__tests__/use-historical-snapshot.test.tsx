// @vitest-environment jsdom-same-realm
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatmapSnapshot } from '@/components/ice-alerts/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SNAPSHOT = {
  meta: {
    generatedAt: '2026-11-21T00:00:00.000Z',
  },
  cities: [],
} as unknown as HeatmapSnapshot;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function requireValue<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(`${label} is not available`);
  return value;
}

describe('useHistoricalSnapshot', () => {
  let container: HTMLDivElement;
  let root: Root;
  let React: typeof import('react');
  let createRoot: typeof import('react-dom/client').createRoot;
  let useHistoricalSnapshot: typeof import('../use-historical-snapshot').useHistoricalSnapshot;
  let state: ReturnType<typeof useHistoricalSnapshot> | null;

  beforeEach(async () => {
    vi.resetModules();

    // Import React, the renderer and the hook from the same fresh module graph.
    // The hook keeps its snapshot cache in module scope, so each test needs its
    // own copy; importing React separately would leave the renderer and hook on
    // different React instances.
    React = await import('react');
    ({ createRoot } = await import('react-dom/client'));
    ({ useHistoricalSnapshot } = await import('../use-historical-snapshot'));

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    state = null;
  });

  afterEach(() => {
    React.act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function Harness() {
    state = useHistoricalSnapshot();
    return null;
  }

  async function mount() {
    await React.act(async () => {
      root.render(React.createElement(Harness));
    });
  }

  function hookState() {
    return requireValue(state, 'hook state');
  }

  it('loads a snapshot and then serves it from the module cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(SNAPSHOT));
    vi.stubGlobal('fetch', fetchMock);

    await mount();
    expect(state?.snapshot).toBeNull();
    expect(state?.status).toBe('idle');

    let loaded: HeatmapSnapshot | null = null;
    await React.act(async () => {
      loaded = await hookState().load();
    });

    expect(loaded).toEqual(SNAPSHOT);
    expect(state?.snapshot).toEqual(SNAPSHOT);
    expect(state?.status).toBe('idle');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/ice-heatmap', {
      headers: { accept: 'application/json' },
    });

    await React.act(async () => {
      loaded = await hookState().load();
    });

    expect(loaded).toEqual(SNAPSHOT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports an HTTP failure without storing a snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: 'down' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    await mount();
    let loaded: HeatmapSnapshot | null = SNAPSHOT;
    await React.act(async () => {
      loaded = await hookState().load();
    });

    expect(loaded).toBeNull();
    expect(state?.snapshot).toBeNull();
    expect(state?.status).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a malformed response as a failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ cities: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await mount();
    await React.act(async () => {
      await hookState().load();
    });

    expect(state?.snapshot).toBeNull();
    expect(state?.status).toBe('error');
  });

  it('retries a failed fetch on the same mounted hook without a page reload', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(response(SNAPSHOT));
    vi.stubGlobal('fetch', fetchMock);

    await mount();
    await React.act(async () => {
      await hookState().load();
    });

    expect(state?.snapshot).toBeNull();
    expect(state?.status).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    let loaded: HeatmapSnapshot | null = null;
    await React.act(async () => {
      loaded = await hookState().load();
    });

    expect(loaded).toEqual(SNAPSHOT);
    expect(state?.snapshot).toEqual(SNAPSHOT);
    expect(state?.status).toBe('idle');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.isConnected).toBe(true);
  });

  it('shares one in-flight request between two hook consumers', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const consumers: {
      first: ReturnType<typeof useHistoricalSnapshot> | null;
      second: ReturnType<typeof useHistoricalSnapshot> | null;
    } = { first: null, second: null };

    function SharedHarness() {
      consumers.first = useHistoricalSnapshot();
      consumers.second = useHistoricalSnapshot();
      return null;
    }

    await React.act(async () => {
      root.render(React.createElement(SharedHarness));
    });

    const first = requireValue(consumers.first, 'first consumer');
    const second = requireValue(consumers.second, 'second consumer');

    await React.act(async () => {
      const firstLoad = first.load();
      const secondLoad = second.load();
      resolveFetch?.(response(SNAPSHOT));
      await Promise.all([firstLoad, secondLoad]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requireValue(consumers.first, 'first consumer').snapshot).toEqual(SNAPSHOT);
    expect(requireValue(consumers.second, 'second consumer').snapshot).toEqual(SNAPSHOT);
  });
});
