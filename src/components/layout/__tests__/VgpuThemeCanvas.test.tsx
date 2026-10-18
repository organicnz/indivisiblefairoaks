import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
