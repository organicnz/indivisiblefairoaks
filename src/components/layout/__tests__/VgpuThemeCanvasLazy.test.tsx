// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitThemeHud } from '@/components/layout/theme-store';
import { VgpuThemeCanvasLazy } from '@/components/layout/VgpuThemeCanvasLazy';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VgpuThemeCanvasLazy', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Reflect.deleteProperty(navigator, 'gpu');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('stays unmounted until a theme transition starts', async () => {
    await act(async () => {
      root.render(<VgpuThemeCanvasLazy />);
    });

    expect(container.querySelector('canvas')).toBeNull();
  });

  it('does not load the canvas without WebGPU support', async () => {
    await act(async () => {
      root.render(<VgpuThemeCanvasLazy />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    expect(container.querySelector('canvas')).toBeNull();
  });

  it('mounts the decorative canvas after the first theme transition', async () => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });

    await act(async () => {
      root.render(<VgpuThemeCanvasLazy />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    await act(async () => {
      await vi.waitFor(
        () => {
          expect(container.querySelector('canvas')).not.toBeNull();
        },
        { timeout: 2000 }
      );
    });
  });
});
