import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VgpuThemeCanvas } from '@/components/layout/VgpuThemeCanvas';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VgpuThemeCanvas component', () => {
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
    document.body.innerHTML = '';
  });

  it('renders decorative canvas element with tabindex="-1", aria-hidden="true", and pointer-events-none', async () => {
    await act(async () => {
      root.render(<VgpuThemeCanvas />);
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('tabindex')).toBe('-1');
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    expect(canvas?.className).toContain('pointer-events-none');
    expect(canvas?.className).toContain('opacity-0');
  });

  it('unmounts cleanly without throwing in non-WebGPU environments', async () => {
    await act(async () => {
      root.render(<VgpuThemeCanvas />);
    });

    expect(() => {
      act(() => {
        root.unmount();
      });
    }).not.toThrow();
  });

  it('respects prefers-reduced-motion without throwing or mounting WebGPU pipelines', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      await act(async () => {
        root.render(<VgpuThemeCanvas />);
      });

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.className).toContain('opacity-0');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('registers and cleans up pointermove and pointerleave listeners with hardware velocity tracking', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const originalGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    Object.defineProperty(navigator, 'gpu', {
      value: {},
      configurable: true,
      writable: true,
    });

    try {
      await act(async () => {
        root.render(<VgpuThemeCanvas />);
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function), {
        passive: true,
      });
      expect(addEventListenerSpy).toHaveBeenCalledWith('pointerleave', expect.any(Function), {
        passive: true,
      });

      const moveEvent = new MouseEvent('pointermove', {
        clientX: 400,
        clientY: 300,
      });
      window.dispatchEvent(moveEvent);

      const leaveEvent = new MouseEvent('pointerleave');
      window.dispatchEvent(leaveEvent);

      act(() => {
        root.unmount();
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerleave', expect.any(Function));
    } finally {
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true,
        writable: true,
      });
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    }
  });

  it('activates canvas opacity when theme change event is emitted', async () => {
    const { emitThemeHud } = await import('@/components/layout/theme-store');

    const originalGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    Object.defineProperty(navigator, 'gpu', {
      value: {},
      configurable: true,
      writable: true,
    });

    try {
      await act(async () => {
        root.render(<VgpuThemeCanvas />);
      });

      const canvas = container.querySelector('canvas');
      expect(canvas?.className).toContain('opacity-0');

      await act(async () => {
        emitThemeHud('dark', 'dark', { x: 500, y: 300 });
      });

      expect(canvas?.className).toContain('opacity-100');
    } finally {
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true,
        writable: true,
      });
    }
  });
});
