// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RovingToolbar } from '@/components/visual-edit/RovingToolbar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RovingToolbar', () => {
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

  const renderToolbar = async (disabledLabel?: string) => {
    await act(async () => {
      root.render(
        <RovingToolbar label="Test actions">
          {['One', 'Two', 'Three'].map((label) => (
            <button key={label} type="button" disabled={label === disabledLabel}>
              {label}
            </button>
          ))}
        </RovingToolbar>
      );
    });
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]');
    const buttons = Array.from(toolbar?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    return { toolbar, buttons };
  };

  const press = async (key: string) => {
    await act(async () => {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    });
  };

  it('keeps one tab stop and moves with arrow, Home, and End keys', async () => {
    const { toolbar, buttons } = await renderToolbar();
    expect(toolbar?.getAttribute('aria-label')).toBe('Test actions');
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

  it('skips disabled controls when roving', async () => {
    const { buttons } = await renderToolbar('Two');
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);

    await act(async () => {
      buttons[0]?.focus();
    });
    await press('ArrowRight');
    expect(document.activeElement).toBe(buttons[2]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, 0]);
  });
});
