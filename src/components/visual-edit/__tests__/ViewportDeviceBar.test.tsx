// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewportDeviceBar } from '@/components/visual-edit/ViewportDeviceBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ViewportDeviceBar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders nothing when viewportMode is desktop', async () => {
    await act(async () => {
      root.render(
        <ViewportDeviceBar
          viewportMode="desktop"
          deviceOrientation="portrait"
          onRotate={vi.fn()}
          onReset={vi.fn()}
        />
      );
    });

    expect(container.textContent).toBe('');
  });

  it('renders mobile device info in portrait mode', async () => {
    const onRotate = vi.fn();
    const onReset = vi.fn();

    await act(async () => {
      root.render(
        <ViewportDeviceBar
          viewportMode="mobile"
          deviceOrientation="portrait"
          onRotate={onRotate}
          onReset={onReset}
        />
      );
    });

    expect(container.textContent).toContain('iPhone 15 Pro');
    expect(container.textContent).toContain('390 × 844 px');
    expect(container.textContent).toContain('portrait');

    const rotateBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Rotate device orientation"]'
    );
    expect(rotateBtn).not.toBeNull();
    await act(async () => {
      rotateBtn?.click();
    });
    expect(onRotate).toHaveBeenCalledTimes(1);

    const resetBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Exit responsive simulation mode"]'
    );
    expect(resetBtn).not.toBeNull();
    await act(async () => {
      resetBtn?.click();
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders tablet device info in landscape mode', async () => {
    await act(async () => {
      root.render(
        <ViewportDeviceBar
          viewportMode="tablet"
          deviceOrientation="landscape"
          onRotate={vi.fn()}
          onReset={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('iPad Mini');
    expect(container.textContent).toContain('1024 × 768 px');
    expect(container.textContent).toContain('landscape');
  });
});
