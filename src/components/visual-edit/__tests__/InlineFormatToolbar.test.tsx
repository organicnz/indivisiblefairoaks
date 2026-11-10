// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyInlineFormatCommand,
  InlineFormatToolbar,
} from '@/components/visual-edit/InlineFormatToolbar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InlineFormatToolbar keyboard access', () => {
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
  });

  const renderToolbar = async (onCommand = vi.fn()) => {
    await act(async () => {
      root.render(
        <InlineFormatToolbar
          variant="pill"
          commands={['bold', 'italic', 'underline']}
          onCommand={onCommand}
        />
      );
    });
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    return { buttons, onCommand };
  };

  const press = async (key: string) => {
    await act(async () => {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    });
  };

  it('uses one tab stop and moves with Arrow, Home, and End keys', async () => {
    const { buttons } = await renderToolbar();
    expect(buttons).toHaveLength(3);
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'Text formatting'
    );
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);

    await act(async () => {
      buttons[0]?.focus();
    });
    await press('ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0, -1]);

    await press('End');
    expect(document.activeElement).toBe(buttons[2]);
    await press('Home');
    expect(document.activeElement).toBe(buttons[0]);
    await press('ArrowLeft');
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('activates pill commands with Enter and Space', async () => {
    const { buttons, onCommand } = await renderToolbar();
    await act(async () => {
      buttons[0]?.focus();
    });

    await press('Enter');
    await press(' ');

    expect(onCommand).toHaveBeenCalledTimes(2);
    expect(onCommand).toHaveBeenNthCalledWith(1, 'bold');
    expect(onCommand).toHaveBeenNthCalledWith(2, 'bold');
  });
});

describe('applyInlineFormatCommand link handling', () => {
  it('delegates link to the caller-provided dialog', () => {
    const onLinkRequest = vi.fn();

    applyInlineFormatCommand('link', onLinkRequest);

    expect(onLinkRequest).toHaveBeenCalledTimes(1);
  });

  it('delegates editLink to the caller-provided dialog', () => {
    const onLinkRequest = vi.fn();

    applyInlineFormatCommand('editLink', onLinkRequest);

    expect(onLinkRequest).toHaveBeenCalledTimes(1);
  });

  it('does nothing instead of opening a blocking prompt without a handler', () => {
    const promptSpy = vi.spyOn(window, 'prompt');

    expect(() => applyInlineFormatCommand('link')).not.toThrow();
    expect(() => applyInlineFormatCommand('editLink')).not.toThrow();
    expect(promptSpy).not.toHaveBeenCalled();
  });
});
