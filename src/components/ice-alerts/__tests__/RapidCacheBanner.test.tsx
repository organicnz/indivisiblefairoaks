// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RapidCacheBanner } from '@/components/ice-alerts/RapidCacheBanner';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RapidCacheBanner', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('labels cached data as non-live and offers a real retry', async () => {
    const onRefresh = vi.fn();

    await act(async () => {
      root.render(
        <RapidCacheBanner
          cachedAt={Date.now() - 60_000}
          now={Date.now()}
          isRefreshing={false}
          onRefresh={onRefresh}
        />
      );
    });

    expect(container.textContent).toContain('Cached snapshot');
    expect(container.textContent).toContain('not a live check');
    expect(container.textContent).toContain('surge conditions are paused');

    const button = container.querySelector('button');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
