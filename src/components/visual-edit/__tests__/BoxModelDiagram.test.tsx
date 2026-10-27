// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import { BoxModelDiagram } from '@/components/visual-edit/composer/ui/BoxModelDiagram';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BoxModelDiagram', () => {
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

  it('renders interactive 4-sided CSS box model diagram and quick presets', async () => {
    const setStyles = vi.fn();
    const setIsSidesLinked = vi.fn();
    const cycleMargin = vi.fn().mockReturnValue('my-4');
    const cyclePadding = vi.fn().mockReturnValue('p-6');

    await act(async () => {
      root.render(
        <BoxModelDiagram
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          isSidesLinked={true}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={cycleMargin}
          cyclePaddingValue={cyclePadding}
          currentBlock={{ id: 'b1', type: 'heading', level: 1, html: 'Hello' }}
        />
      );
    });

    expect(container.textContent).toContain('Interactive CSS Box Model');
    expect(container.textContent).toContain('Linked');
    expect(container.textContent).toContain('Default');
    expect(container.textContent).toContain('Card');
    expect(container.textContent).toContain('Spacious');
    expect(container.textContent).toContain('heading');
  });

  it('toggles link state when clicking link button', async () => {
    const setStyles = vi.fn();
    const setIsSidesLinked = vi.fn();

    await act(async () => {
      root.render(
        <BoxModelDiagram
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          isSidesLinked={true}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={(v) => v}
          cyclePaddingValue={(v) => v}
        />
      );
    });

    const linkBtn = container.querySelector('button[title*="Sides Linked"]');
    expect(linkBtn).not.toBeNull();

    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setIsSidesLinked).toHaveBeenCalled();
  });

  it('applies quick preset when clicking preset pill', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      if (typeof update === 'function') {
        currentStyles = update(currentStyles);
      } else {
        currentStyles = update;
      }
    });

    await act(async () => {
      root.render(
        <BoxModelDiagram
          styles={currentStyles}
          setStyles={setStyles}
          isSidesLinked={true}
          setIsSidesLinked={vi.fn()}
          cycleMarginValue={(v) => v}
          cyclePaddingValue={(v) => v}
        />
      );
    });

    const cardPresetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Card'
    );
    expect(cardPresetBtn).not.toBeNull();

    await act(async () => {
      cardPresetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalledWith(
      expect.objectContaining({
        margin: expect.objectContaining({ top: 'my-4' }),
        padding: expect.objectContaining({ top: 'p-6' }),
      })
    );
  });

  it('cycles margin top when clicking top margin pill', async () => {
    const setStyles = vi.fn();
    const cycleMargin = vi.fn().mockReturnValue('my-6');

    await act(async () => {
      root.render(
        <BoxModelDiagram
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          isSidesLinked={true}
          setIsSidesLinked={vi.fn()}
          cycleMarginValue={cycleMargin}
          cyclePaddingValue={(v) => v}
        />
      );
    });

    const topMarginPill = container.querySelector('button[title="Click to cycle top margin"]');
    expect(topMarginPill).not.toBeNull();

    await act(async () => {
      topMarginPill?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cycleMargin).toHaveBeenCalledWith(DEFAULT_VC_STYLES.margin.top, 'vertical');
    expect(setStyles).toHaveBeenCalled();
  });

  it('cycles padding left when clicking left padding pill', async () => {
    const setStyles = vi.fn();
    const cyclePadding = vi.fn().mockReturnValue('px-4');

    await act(async () => {
      root.render(
        <BoxModelDiagram
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          isSidesLinked={false}
          setIsSidesLinked={vi.fn()}
          cycleMarginValue={(v) => v}
          cyclePaddingValue={cyclePadding}
        />
      );
    });

    const leftPaddingPill = container.querySelector('button[title="Click to cycle left padding"]');
    expect(leftPaddingPill).not.toBeNull();

    await act(async () => {
      leftPaddingPill?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cyclePadding).toHaveBeenCalledWith(DEFAULT_VC_STYLES.padding.left, 'horizontal');
    expect(setStyles).toHaveBeenCalled();
  });
});
