import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeHud } from '@/components/layout/ThemeHud';
import { cycleThemeMode, emitThemeHud } from '@/components/layout/theme-store';

vi.mock('@/components/layout/theme-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout/theme-store')>();
  return {
    ...actual,
    cycleThemeMode: vi.fn(actual.cycleThemeMode),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemeHud component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('renders nothing initially when no event has occurred', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('displays the HUD when a theme event is emitted and auto-hides after delay', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    const hud = container.querySelector('[role="status"]');
    expect(hud).not.toBeNull();
    expect(hud?.textContent).toContain('Dark');
    expect(hud?.textContent).toContain('Shift+T');

    // Fast-forward timers by 2300ms
    await act(async () => {
      vi.advanceTimersByTime(2300);
    });

    // Opacity changes to 0
    expect(hud?.className).toContain('opacity-0');
  });

  it('displays system mode with resolved effective palette', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('system', 'dark');
    });

    const hud = container.querySelector('[role="status"]');
    expect(hud).not.toBeNull();
    expect(hud?.textContent).toContain('System (Dark)');
  });

  it('handles Shift+T global keyboard shortcut to cycle theme', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    // Fire Shift+T on document
    const event = new KeyboardEvent('keydown', {
      key: 't',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(cycleThemeMode).toHaveBeenCalledTimes(1);
  });

  it('ignores Shift+T when user is typing inside an input', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: 't',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      input.dispatchEvent(event);
    });

    expect(cycleThemeMode).not.toHaveBeenCalled();
    input.remove();
  });

  it('handles Cmd/Ctrl+Shift+L shortcut to cycle theme', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      shiftKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(cycleThemeMode).toHaveBeenCalledTimes(1);
  });
});
