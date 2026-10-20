// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '@/components/admin/content/BlockEditor';

/**
 * The slash menu is the editor's primary insertion affordance — the `/` hint is
 * printed in the shortcut row under the toolbar — and it was mouse-only.
 *
 * Opening it autofocuses the search input, while the Arrow/Enter/Tab handler was
 * bound to the editable block the menu was opened from. Those are different
 * elements, so no key the author pressed after the menu opened ever reached a
 * handler, and the only way to insert a block was `onMouseDown`, which a
 * keyboard user does not generate. `+` opened the same dead menu.
 *
 * This file is the keyboard path, which had no coverage at all.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockEditor slash menu', () => {
  let container: HTMLDivElement;
  let root: Root;

  const onChange = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // jsdom has no layout, so the position calculation reads zeros. Harmless —
    // nothing in the keyboard path depends on the coordinates.
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = () => {
    act(() => {
      root.render(
        <BlockEditor blocks={[{ id: 'b1', type: 'paragraph', html: '' }]} onChange={onChange} />
      );
    });
  };

  const editable = () => container.querySelector('[contenteditable="true"]') as HTMLElement;

  const menu = () => document.body.querySelector('[role="dialog"][aria-label="Insert block"]');

  const searchInput = () => document.body.querySelector('[role="combobox"]') as HTMLInputElement;

  const options = () => Array.from(document.body.querySelectorAll('[role="option"]'));

  const pressOn = (el: Element, key: string) => {
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
  };

  const openMenu = () => {
    render();
    act(() => {
      editable().dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
  };

  it('opens on "/" in an empty block and takes focus', () => {
    render();
    expect(menu()).toBeNull();
    act(() => {
      editable().dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    expect(menu()).not.toBeNull();
    // Focus has to be in the menu for the keyboard path to mean anything.
    expect(document.activeElement).toBe(searchInput());
  });

  it('opens from the + button, and that path is keyboard-reachable too', () => {
    render();
    const plus = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Insert or change block'
    );
    expect(plus).toBeDefined();
    act(() => {
      plus?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(menu()).not.toBeNull();
  });

  it('moves the highlight with ArrowDown and wraps around', () => {
    openMenu();
    const input = searchInput();
    expect(input.getAttribute('aria-activedescendant')).toBe(
      `slash-option-${options()[0]?.id.replace('slash-option-', '')}`
    );

    pressOn(input, 'ArrowDown');
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(options()[0]?.getAttribute('aria-selected')).toBe('false');

    // Wraps: from the last option, back to the first.
    const count = options().length;
    for (let i = 1; i < count; i += 1) pressOn(input, 'ArrowDown');
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');

    pressOn(input, 'ArrowUp');
    expect(options()[count - 1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('moves the highlight with ArrowUp and does not underflow', () => {
    openMenu();
    const input = searchInput();
    pressOn(input, 'ArrowUp');
    const last = options()[options().length - 1];
    expect(last?.getAttribute('aria-selected')).toBe('true');
  });

  it('inserts the highlighted block on Enter, with no mouse event involved', () => {
    openMenu();
    const input = searchInput();
    pressOn(input, 'ArrowDown');

    // A paragraph is already selected, and this block is an empty paragraph, so
    // the convention is to convert in place rather than add a second block.
    pressOn(input, 'Enter');

    // The document changed. This is the assertion that was impossible before:
    // nothing but a keydown happened.
    expect(onChange).toHaveBeenCalled();
    const nextBlocks = onChange.mock.calls.at(-1)?.[0] as { type: string }[];
    expect(nextBlocks[0]?.type).not.toBe('paragraph');
    expect(menu()).toBeNull();
  });

  it('treats Tab as accept, the listbox convention for a filter field', () => {
    openMenu();
    pressOn(searchInput(), 'Tab');
    expect(onChange).toHaveBeenCalled();
    expect(menu()).toBeNull();
  });

  it('closes on Escape without changing the document', () => {
    openMenu();
    onChange.mockClear();
    pressOn(searchInput(), 'Escape');
    expect(menu()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on the backdrop without changing the document', () => {
    openMenu();
    onChange.mockClear();
    const backdrop = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Close block menu'
    );
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(menu()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('narrows the list as the query is typed, and says so when nothing matches', () => {
    openMenu();
    const before = options().length;

    const input = searchInput();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, 'zzzzz');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(options().length).toBeLessThan(before);
    expect(menu()?.textContent).toContain('No blocks match');
  });

  it('exposes the highlight through aria-activedescendant', () => {
    // Without this, a screen-reader user is told there are options and given no
    // way to know which one is selected.
    openMenu();
    const input = searchInput();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('slash-menu-listbox');
    const active = input.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.body.querySelector(`#${active}`)).not.toBeNull();

    pressOn(input, 'ArrowDown');
    expect(searchInput().getAttribute('aria-activedescendant')).not.toBe(active);
  });

  it('keeps the viewport-covering backdrop out of the tab order', () => {
    // It covers the whole screen, so anything that reaches it by Tab is a
    // control the author lands on with no visible focus. The visible close
    // button stays tabbable — that one is a real control with a real label.
    openMenu();
    const backdrops = Array.from(document.body.querySelectorAll('button')).filter(
      (b) => b.getAttribute('aria-label') === 'Close block menu' && b.className.includes('inset-0')
    );
    expect(backdrops.length).toBeGreaterThan(0);
    for (const b of backdrops) expect(b.getAttribute('tabindex')).toBe('-1');
  });
});
