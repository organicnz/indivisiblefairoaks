// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalDialog } from '@/components/visual-edit/ModalDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ModalDialog focus containment', () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;
  const onDismiss = vi.fn();

  beforeEach(() => {
    onDismiss.mockReset();
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open confirmation';
    document.body.append(trigger);
    trigger.focus();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    trigger.remove();
    document.body.innerHTML = '';
  });

  const renderDialog = async () => {
    await act(async () => {
      root.render(
        <ModalDialog
          testId="test-confirm-dialog"
          labelledBy="test-confirm-title"
          onDismiss={onDismiss}
        >
          <h3 id="test-confirm-title">Delete this?</h3>
          <button type="button">Cancel</button>
          <button type="button">Delete</button>
        </ModalDialog>
      );
    });
    const dialog = document.querySelector<HTMLElement>('[data-testid="test-confirm-dialog"]');
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  };

  const buttons = (dialog: HTMLElement) =>
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));

  const press = async (target: HTMLElement, init: KeyboardEventInit) => {
    let event: KeyboardEvent | undefined;
    await act(async () => {
      event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
    });
    if (!event) throw new Error('expected a keyboard event');
    return event;
  };

  it('moves focus to the first action and restores the opener when it closes', async () => {
    const dialog = await renderDialog();
    const [cancel] = buttons(dialog);
    expect(document.activeElement).toBe(cancel);

    await act(async () => {
      root.render(<span />);
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to the editor surface when the opener is detached', async () => {
    const fallback = document.createElement('aside');
    fallback.setAttribute('data-editor-focus-fallback', '');
    fallback.tabIndex = -1;
    document.body.append(fallback);

    await renderDialog();
    trigger.remove();

    await act(async () => {
      root.render(<span />);
    });

    expect(document.activeElement).toBe(fallback);
  });

  it('falls back to the editor surface when no opener was focused', async () => {
    const fallback = document.createElement('aside');
    fallback.setAttribute('data-editor-focus-fallback', '');
    fallback.tabIndex = -1;
    document.body.append(fallback);

    trigger.blur();
    expect(document.activeElement).toBe(document.body);

    await renderDialog();

    await act(async () => {
      root.render(<span />);
    });

    expect(document.activeElement).toBe(fallback);
  });

  it('wraps Tab from the last action to the first', async () => {
    const dialog = await renderDialog();
    const [cancel, confirm] = buttons(dialog);
    confirm.focus();

    const event = await press(confirm, { key: 'Tab' });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);
  });

  it('wraps Shift+Tab from the first action to the last', async () => {
    const dialog = await renderDialog();
    const [cancel, confirm] = buttons(dialog);
    cancel.focus();

    const event = await press(cancel, { key: 'Tab', shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);
  });

  it('dismisses on Escape and claims the key', async () => {
    const dialog = await renderDialog();
    const [cancel] = buttons(dialog);

    const event = await press(cancel, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dismisses only when the backdrop itself is clicked', async () => {
    const dialog = await renderDialog();
    const panel = dialog.querySelector('h3');
    expect(panel).not.toBeNull();

    await act(async () => {
      panel?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
