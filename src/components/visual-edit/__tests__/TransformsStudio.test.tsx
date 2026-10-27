// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import { TransformsStudio } from '@/components/visual-edit/composer/TransformsStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TransformsStudio', () => {
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

  it('renders transforms and 3D tilt controls', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <TransformsStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          transformRotateSelectId="test-rotate-select"
        />
      );
    });

    expect(container.textContent).toContain('Transforms & 3D Tilt');
    expect(container.textContent).toContain('3D Motion');
    expect(container.textContent).toContain('Rotation Angle');
    expect(container.textContent).toContain('Scale Size');
    expect(container.textContent).toContain('Skew Slant');
    expect(container.textContent).toContain('Translate X');
    expect(container.textContent).toContain('Translate Y');
    expect(container.textContent).toContain('Transform Origin');

    const rotateSelect = container.querySelector('#test-rotate-select') as HTMLSelectElement | null;
    expect(rotateSelect).not.toBeNull();
  });

  it('updates rotate and scale on select change', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <TransformsStudio
          styles={currentStyles}
          setStyles={setStyles}
          transformRotateSelectId="rotate-sel"
        />
      );
    });

    const rotateSelect = container.querySelector('#rotate-sel') as HTMLSelectElement;
    await act(async () => {
      rotateSelect.value = 'rotate-2';
      rotateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalledTimes(1);
    expect(setStyles.mock.calls[0][0].transform.rotate).toBe('rotate-2');
  });
});
