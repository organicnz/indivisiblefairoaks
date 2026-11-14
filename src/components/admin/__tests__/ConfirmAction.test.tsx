// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmAction } from '@/components/admin/ConfirmAction';

/**
 * The contract every destructive admin control now shares: the idle control
 * says what it is, the confirm step says the consequence, and nothing fires
 * until Confirm. Pinned once here so the seven call sites do not each need
 * their own copy of it.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ConfirmAction', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onConfirm = vi.fn();

  const render = (over: Record<string, unknown> = {}) => {
    act(() => {
      root.render(
        <ConfirmAction
          label="Delete page"
          message="Delete “Rally”? This cannot be undone."
          onConfirm={onConfirm}
          idleClassName="idle"
          {...over}
        >
          <span aria-hidden="true">🗑</span>
        </ConfirmAction>
      );
    });
  };

  const click = (el: Element | null | undefined) => {
    act(() => {
      (el as HTMLButtonElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
  };

  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === text);

  beforeEach(() => {
    onConfirm.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the idle control with its accessible name', () => {
    render();
    expect(container.querySelector('button[aria-label="Delete page"]')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows the consequence on first click, and fires only on Confirm', () => {
    render();
    click(button('🗑'));
    expect(container.textContent).toContain('Delete “Rally”? This cannot be undone.');
    expect(onConfirm).not.toHaveBeenCalled();

    click(button('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the confirmation and back to the idle control', () => {
    render();
    const idle = container.querySelector<HTMLButtonElement>('button[aria-label="Delete page"]');
    idle?.focus();

    click(idle);
    expect(document.activeElement?.textContent).toBe('Confirm');

    click(button('Cancel'));
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Delete page"]')
    );
  });

  it('backs out on Cancel without firing', () => {
    render();
    click(button('🗑'));
    click(button('Cancel'));
    expect(container.textContent).not.toContain('This cannot be undone.');
    expect(container.querySelector('button[aria-label="Delete page"]')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels confirmation when Escape key is pressed', () => {
    render();
    click(button('🗑'));
    expect(container.textContent).toContain('Delete “Rally”? This cannot be undone.');

    act(() => {
      container.querySelector('fieldset')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    });

    expect(container.textContent).not.toContain('This cannot be undone.');
    expect(container.querySelector('button[aria-label="Delete page"]')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables the whole step while busy', () => {
    render({ busy: true });
    click(button('🗑'));
    for (const b of container.querySelectorAll('button')) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocks Confirm when the action becomes unavailable, while keeping Cancel usable', () => {
    render();
    click(button('🗑'));
    expect((button('Confirm') as HTMLButtonElement).disabled).toBe(false);

    // A page can become unreadable while the confirmation is open. The same
    // guard that disables the idle control must disable the destructive step,
    // or the dialog becomes a way around it.
    render({ disabled: true });
    const confirm = button('Confirm') as HTMLButtonElement;
    const cancel = button('Cancel') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(cancel.disabled).toBe(false);

    click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
