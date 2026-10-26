// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlashCommandMenu } from '@/components/visual-edit/SlashCommandMenu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SlashCommandMenu', () => {
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

  it('renders nothing when closed', async () => {
    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={false}
          onClose={vi.fn()}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={vi.fn()}
        />
      );
    });

    expect(container.textContent).toBe('');
  });

  it('renders commands list and filters by keyword query', async () => {
    const onExecuteCommand = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={onClose}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={onExecuteCommand}
        />
      );
    });

    expect(container.textContent).toContain('Heading 2');
    expect(container.textContent).toContain('Paragraph Text');
    expect(container.textContent).toContain('Callout Box');

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      if (input && nativeSetter) {
        nativeSetter.call(input, 'quote');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(container.textContent).toContain('Quote Block');
    expect(container.textContent).not.toContain('Paragraph Text');
  });

  it('executes command when clicking menu item and closes menu', async () => {
    const onExecuteCommand = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={onClose}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={onExecuteCommand}
        />
      );
    });

    const h2Button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Heading 2')
    );
    expect(h2Button).toBeDefined();

    await act(async () => {
      h2Button?.click();
    });

    expect(onExecuteCommand).toHaveBeenCalledWith('h2');
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates with keyboard ArrowDown and executes on Enter', async () => {
    const onExecuteCommand = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={onClose}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={onExecuteCommand}
        />
      );
    });

    const input = container.querySelector('input');

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onExecuteCommand).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
