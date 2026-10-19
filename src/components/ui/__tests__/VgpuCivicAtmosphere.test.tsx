import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VgpuCivicAtmosphere } from '@/components/ui/VgpuCivicAtmosphere';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VgpuCivicAtmosphere component', () => {
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

  it('renders decorative canvas element and ambient fallback layer', async () => {
    await act(async () => {
      root.render(<VgpuCivicAtmosphere />);
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.viewTransitionName).toBe('none');
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('unmounts cleanly without throwing in environments without WebGPU', async () => {
    await act(async () => {
      root.render(<VgpuCivicAtmosphere intensity={0.8} />);
    });

    expect(() => {
      act(() => {
        root.unmount();
      });
    }).not.toThrow();
  });
});
