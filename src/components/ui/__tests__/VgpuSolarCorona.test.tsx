// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VgpuSolarCorona } from '@/components/ui/VgpuSolarCorona';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VgpuSolarCorona component', () => {
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

  it('renders decorative canvas element and corona layer with viewTransition decoupling', async () => {
    await act(async () => {
      root.render(<VgpuSolarCorona />);
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.viewTransitionName).toBe('none');
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('unmounts cleanly without throwing in environments without WebGPU', async () => {
    await act(async () => {
      root.render(<VgpuSolarCorona intensity={0.9} />);
    });

    expect(() => {
      act(() => {
        root.unmount();
      });
    }).not.toThrow();
  });

  it('respects prefers-reduced-motion without throwing in static rendering mode', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    await act(async () => {
      root.render(<VgpuSolarCorona />);
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    window.matchMedia = originalMatchMedia;
  });
});
