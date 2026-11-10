// @vitest-environment jsdom-same-realm
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
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]');
    expect(input).not.toBeNull();
    expect(listbox).not.toBeNull();
    expect(input?.getAttribute('role')).toBe('combobox');
    expect(input?.getAttribute('aria-controls')).toBe(listbox?.id);
    expect(input?.getAttribute('aria-expanded')).toBe('true');
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options).toHaveLength(10);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(input?.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(document.activeElement).toBe(input);

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
    const filteredOption = container.querySelector<HTMLElement>('[role="option"]');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(input?.getAttribute('aria-activedescendant')).toBe(filteredOption?.id);
    expect(filteredOption?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      '1 slash command available'
    );
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
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options.length).toBeGreaterThan(1);
    expect(input?.getAttribute('aria-activedescendant')).toBe(options[0]?.id);

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(input?.getAttribute('aria-activedescendant')).toBe(
      options[options.length - 1]?.id
    );

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(input?.getAttribute('aria-activedescendant')).toBe(options[0]?.id);

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(input?.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onExecuteCommand).toHaveBeenCalledWith('h3');
    expect(onClose).toHaveBeenCalled();
  });

  it('clamps the palette inside the viewport at the bottom-right edge', async () => {
    const asRect = (width: number, height: number): DOMRect => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      if (this === container.firstElementChild) return asRect(288, 320);
      return asRect(0, 0);
    });

    try {
      await act(async () => {
        root.render(
          <SlashCommandMenu
            open={true}
            onClose={vi.fn()}
            position={{ top: window.innerHeight - 2, left: window.innerWidth - 2 }}
            onExecuteCommand={vi.fn()}
          />
        );
      });

      const menu = container.firstElementChild as HTMLElement;
      expect(menu.style.left).toBe(`${window.innerWidth - 288 - 8}px`);
      expect(menu.style.top).toBe(`${window.innerHeight - 320 - 8}px`);
      expect(menu.style.maxHeight).toBe('320px');
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('focuses the filter and restores focus to the opener on Escape', async () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open slash commands';
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={onClose}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={vi.fn()}
        />
      );
    });

    const input = container.querySelector('input');
    expect(document.activeElement).toBe(input);

    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('falls back to the editor focus target when the opener is gone', async () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open slash commands';
    document.body.appendChild(trigger);
    trigger.focus();
    const fallback = document.createElement('aside');
    fallback.setAttribute('data-editor-focus-fallback', '');
    fallback.tabIndex = -1;
    document.body.appendChild(fallback);

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={vi.fn()}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={vi.fn()}
        />
      );
    });

    trigger.remove();
    const input = container.querySelector('input');
    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });

  it('dismisses on page scroll but ignores scrolling inside the command list', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={onClose}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={vi.fn()}
        />
      );
    });

    const listbox = container.querySelector('[role="listbox"]');
    await act(async () => {
      listbox?.dispatchEvent(new Event('scroll'));
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses when focus leaves the palette without stealing the next focus', async () => {
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Next control';
    document.body.appendChild(next);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={onClose}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={vi.fn()}
        />
      );
    });

    await act(async () => {
      next.focus();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(next);
    next.remove();
  });

  it('clears the active descendant and announces an empty result', async () => {
    const onExecuteCommand = vi.fn();

    await act(async () => {
      root.render(
        <SlashCommandMenu
          open={true}
          onClose={vi.fn()}
          position={{ top: 100, left: 100 }}
          onExecuteCommand={onExecuteCommand}
        />
      );
    });

    const input = container.querySelector('input');
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      if (input && nativeSetter) {
        nativeSetter.call(input, 'zzzz');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(input?.hasAttribute('aria-activedescendant')).toBe(false);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'No matching slash commands.'
    );

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onExecuteCommand).not.toHaveBeenCalled();
  });
});
