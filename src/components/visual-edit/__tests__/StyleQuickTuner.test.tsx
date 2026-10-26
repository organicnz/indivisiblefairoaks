// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StyleQuickTuner } from '@/components/visual-edit/StyleQuickTuner';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StyleQuickTuner', () => {
  let container: HTMLDivElement;
  let root: Root;
  let targetEl: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    targetEl = document.createElement('h2');
    targetEl.textContent = 'Rally Headline';
    document.body.appendChild(targetEl);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders style tuner trigger button', () => {
    act(() => {
      root.render(<StyleQuickTuner element={targetEl} />);
    });

    const trigger = document.querySelector('button[aria-label="Style quick tuner"]');
    expect(trigger).not.toBeNull();
  });

  it('applies font size classes to target element', () => {
    act(() => {
      root.render(<StyleQuickTuner element={targetEl} defaultOpen={true} />);
    });

    const xlBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'XL'
    );
    expect(xlBtn).toBeDefined();

    act(() => {
      xlBtn?.click();
    });

    expect(targetEl.classList.contains('text-xl')).toBe(true);
  });

  it('applies text alignment classes to target element', () => {
    act(() => {
      root.render(<StyleQuickTuner element={targetEl} defaultOpen={true} />);
    });

    const centerBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Align center"]'
    );
    expect(centerBtn).not.toBeNull();

    act(() => {
      centerBtn?.click();
    });

    expect(targetEl.classList.contains('text-center')).toBe(true);
  });

  it('triggers onOpenVisualComposer when launcher button is clicked', () => {
    const onOpen = vi.fn();
    act(() => {
      root.render(
        <StyleQuickTuner element={targetEl} defaultOpen={true} onOpenVisualComposer={onOpen} />
      );
    });

    const studioBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open Visual Composer Studio')
    );
    expect(studioBtn).toBeDefined();

    act(() => {
      studioBtn?.click();
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
