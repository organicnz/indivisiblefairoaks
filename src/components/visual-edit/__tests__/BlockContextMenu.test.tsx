// @vitest-environment jsdom-same-realm
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockContextMenu } from '@/components/visual-edit/BlockContextMenu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buttonWithText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text)
  );
}

describe('BlockContextMenu', () => {
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
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function renderMenu(
    overrides: Partial<Parameters<typeof BlockContextMenu>[0]> = {}
  ) {
    const props: Parameters<typeof BlockContextMenu>[0] = {
      blockIndex: 1,
      blockCount: 3,
      x: 10,
      y: 20,
      position: null,
      menuRef: createRef<HTMLDivElement>(),
      onKeyDown: vi.fn(),
      onCustomize: vi.fn(),
      onRowSettings: vi.fn(),
      onEditContent: vi.fn(),
      onDuplicate: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onAddBelow: vi.fn(),
      onDelete: vi.fn(),
      ...overrides,
    };

    act(() => root.render(<BlockContextMenu {...props} />));
    return { props, menu: container.querySelector<HTMLElement>('[role="menu"]') };
  }

  it('renders the block identity and forwards menu actions', () => {
    const { props, menu } = renderMenu();

    expect(menu?.getAttribute('aria-label')).toBe('Block Context Menu');
    expect(menu?.textContent).toContain('Block #2');
    expect(menu?.textContent).toContain('Customize Block');
    expect(menu?.textContent).toContain('Row & Section Settings');

    act(() => buttonWithText(container, 'Customize Block')?.click());
    act(() => buttonWithText(container, 'Row & Section Settings')?.click());
    act(() => buttonWithText(container, 'Edit Content')?.click());
    act(() => buttonWithText(container, 'Duplicate Block')?.click());
    act(() => buttonWithText(container, 'Add Block Below')?.click());

    expect(props.onCustomize).toHaveBeenCalledOnce();
    expect(props.onRowSettings).toHaveBeenCalledOnce();
    expect(props.onEditContent).toHaveBeenCalledOnce();
    expect(props.onDuplicate).toHaveBeenCalledOnce();
    expect(props.onAddBelow).toHaveBeenCalledOnce();
  });

  it('hides move controls at the edges of the document', () => {
    const first = renderMenu({ blockIndex: 0 });
    expect(first.menu?.textContent).not.toContain('Move Up');
    expect(first.menu?.textContent).toContain('Move Down');

    act(() => root.unmount());
    root = createRoot(container);
    const last = renderMenu({ blockIndex: 2 });
    expect(last.menu?.textContent).toContain('Move Up');
    expect(last.menu?.textContent).not.toContain('Move Down');
  });

  it('keeps keyboard handling and viewport clamping at the parent boundary', () => {
    const onKeyDown = vi.fn();
    const { menu } = renderMenu({
      position: { top: 8, left: 16, maxHeight: 500 },
      onKeyDown,
    });

    expect(menu?.style.top).toBe('8px');
    expect(menu?.style.left).toBe('16px');
    expect(menu?.style.maxHeight).toBe('500px');

    act(() => {
      menu?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
    });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });
});
