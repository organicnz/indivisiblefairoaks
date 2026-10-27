// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorSwatchPicker } from '@/components/visual-edit/composer/ui/ColorSwatchPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ColorSwatchPicker', () => {
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

  it('renders all color swatch buttons', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ColorSwatchPicker label="Test Swatches" value="bg-transparent" onChange={onChange} />
      );
    });

    expect(container.textContent).toContain('Test Swatches');
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });

  it('calls onChange with swatch class value when clicked', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<ColorSwatchPicker value="bg-transparent" onChange={onChange} />);
    });

    const goldButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Select Civic Gold"]'
    );
    expect(goldButton).not.toBeNull();

    await act(async () => {
      goldButton?.click();
    });

    expect(onChange).toHaveBeenCalledWith('bg-amber-500/10 text-amber-500');
  });
});
