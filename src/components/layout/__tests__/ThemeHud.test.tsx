// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeHud } from '@/components/layout/ThemeHud';
import { cycleThemeMode, emitThemeHud, setThemeMode } from '@/components/layout/theme-store';

vi.mock('@/components/layout/theme-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout/theme-store')>();
  return {
    ...actual,
    cycleThemeMode: vi.fn(actual.cycleThemeMode),
    setThemeMode: vi.fn(actual.setThemeMode),
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

    expect(cycleThemeMode).toHaveBeenCalledWith('next');
  });

  it('handles Shift+Alt+T global keyboard shortcut to cycle theme backwards', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    const event = new KeyboardEvent('keydown', {
      key: 't',
      shiftKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(cycleThemeMode).toHaveBeenCalledWith('prev');
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

  it('dismisses immediately when the user clicks the dismiss button', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('light', 'light');
    });

    const button = container.querySelector('button[aria-label="Dismiss theme notification"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const hud = container.querySelector('[role="status"]');
    expect(hud?.className).toContain('opacity-0');
  });

  it('pauses auto-dismiss on mouse enter and resumes on mouse leave', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    const hud = container.querySelector('[role="status"]');
    expect(hud).not.toBeNull();

    // Mouse enters before delay expires
    await act(async () => {
      hud?.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })
      );
    });

    // Advance beyond normal auto-dismiss timeout (2300ms)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Still visible because hovered
    expect(hud?.className).toContain('opacity-100');

    // Mouse leaves
    await act(async () => {
      hud?.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })
      );
    });

    // Advance by leave timeout (1500ms)
    await act(async () => {
      vi.advanceTimersByTime(1550);
    });

    // Now hidden
    expect(hud?.className).toContain('opacity-0');
  });

  it('dismisses immediately when the user presses Escape', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    const hud = container.querySelector('[role="status"]');
    expect(hud?.className).toContain('opacity-100');

    // Press Escape
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(hud?.className).toContain('opacity-0');
  });

  it('switches theme to system/light/dark when user presses 1, 2, or 3 while HUD is visible', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    // Press '2' for light
    const event2 = new KeyboardEvent('keydown', {
      key: '2',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(event2);
    });

    expect(setThemeMode).toHaveBeenCalledWith('light');

    // Press '1' for system
    const event1 = new KeyboardEvent('keydown', {
      key: '1',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(event1);
    });

    expect(setThemeMode).toHaveBeenCalledWith('system');
  });

  it('switches theme when user presses Alt+1, Alt+2, or Alt+3 globally', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    const alt3 = new KeyboardEvent('keydown', {
      key: '3',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(alt3);
    });

    expect(setThemeMode).toHaveBeenCalledWith('dark');
  });

  it('switches theme when user presses Option+1/2/3 using macOS physical key codes', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    // On macOS, Option+2 produces '™' with code 'Digit2'
    const opt2 = new KeyboardEvent('keydown', {
      key: '™',
      code: 'Digit2',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(opt2);
    });

    expect(setThemeMode).toHaveBeenCalledWith('light');

    // On macOS, Option+1 produces '¡' with code 'Digit1'
    const opt1 = new KeyboardEvent('keydown', {
      key: '¡',
      code: 'Digit1',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(opt1);
    });

    expect(setThemeMode).toHaveBeenCalledWith('system');
  });

  it('cycles theme backward when user presses Shift+Option+T on macOS', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    // On macOS, Shift+Option+T produces 'ˇ' with code 'KeyT'
    const shiftOptT = new KeyboardEvent('keydown', {
      key: 'ˇ',
      code: 'KeyT',
      shiftKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(shiftOptT);
    });

    expect(cycleThemeMode).toHaveBeenCalledWith('prev');
  });

  it('allows clicking segmented mode buttons directly from the HUD', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('system', 'light');
    });

    const darkBtn = container.querySelector('button[data-theme-mode="dark"]');
    expect(darkBtn).not.toBeNull();

    await act(async () => {
      darkBtn?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 400 })
      );
    });

    expect(setThemeMode).toHaveBeenCalledWith('dark', { x: 200, y: 400 });

    const lightBtn = container.querySelector('button[data-theme-mode="light"]');
    expect(lightBtn).not.toBeNull();

    await act(async () => {
      lightBtn?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 })
      );
    });

    expect(setThemeMode).toHaveBeenCalledWith('light', { x: 100, y: 300 });
  });

  it('navigates with ArrowRight/ArrowLeft and Home/End while HUD is visible', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('system', 'light');
    });

    // ArrowRight -> next
    const arrowRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(arrowRight);
    });
    expect(cycleThemeMode).toHaveBeenCalledWith('next');

    // ArrowLeft -> prev
    const arrowLeft = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(arrowLeft);
    });
    expect(cycleThemeMode).toHaveBeenCalledWith('prev');

    // Home -> system
    const home = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(home);
    });
    expect(setThemeMode).toHaveBeenCalledWith('system');

    // End -> dark
    const end = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(end);
    });
    expect(setThemeMode).toHaveBeenCalledWith('dark');

    // T while HUD visible -> next
    const tKey = new KeyboardEvent('keydown', {
      key: 't',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(tKey);
    });
    expect(cycleThemeMode).toHaveBeenCalledWith('next');
  });

  it('handles Cmd/Ctrl+Shift+D shortcut to cycle theme', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
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

  it('handles Ctrl+Alt+1 to set theme to system', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    const ctrlAlt1 = new KeyboardEvent('keydown', {
      key: '1',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      window.dispatchEvent(ctrlAlt1);
    });

    expect(setThemeMode).toHaveBeenCalledWith('system');
  });

  it('pauses auto-dismiss on keyboard focus and resumes on blur', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('dark', 'dark');
    });

    const hud = container.querySelector('[role="status"]');
    expect(hud).not.toBeNull();

    const button = container.querySelector('button[data-theme-mode="system"]') as HTMLButtonElement;
    expect(button).not.toBeNull();

    // Focus occurs inside the HUD
    await act(async () => {
      button.focus();
    });

    // Advance beyond normal auto-dismiss timeout (2300ms)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Still visible because focused
    expect(hud?.className).toContain('opacity-100');

    // Blur to outside element
    await act(async () => {
      button.blur();
    });

    // Advance by blur timeout (1500ms)
    await act(async () => {
      vi.advanceTimersByTime(1550);
    });

    // Now hidden
    expect(hud?.className).toContain('opacity-0');
  });

  it('navigates segmented buttons with keyboard arrows and Home/End keys', async () => {
    await act(async () => {
      root.render(<ThemeHud />);
    });

    await act(async () => {
      emitThemeHud('system', 'dark');
    });

    const systemBtn = container.querySelector(
      'button[data-theme-mode="system"]'
    ) as HTMLButtonElement;
    const lightBtn = container.querySelector(
      'button[data-theme-mode="light"]'
    ) as HTMLButtonElement;
    const darkBtn = container.querySelector('button[data-theme-mode="dark"]') as HTMLButtonElement;
    expect(systemBtn).not.toBeNull();
    expect(lightBtn).not.toBeNull();
    expect(darkBtn).not.toBeNull();

    // Focus systemBtn and press ArrowRight
    systemBtn.focus();
    const arrowRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      systemBtn.dispatchEvent(arrowRight);
    });

    expect(setThemeMode).toHaveBeenCalledWith('light', expect.any(Object));
    expect(document.activeElement).toBe(lightBtn);

    // Press ArrowRight on lightBtn -> darkBtn
    await act(async () => {
      lightBtn.dispatchEvent(arrowRight);
    });
    expect(setThemeMode).toHaveBeenCalledWith('dark', expect.any(Object));
    expect(document.activeElement).toBe(darkBtn);

    // Press Home on darkBtn -> systemBtn
    const homeKey = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      darkBtn.dispatchEvent(homeKey);
    });
    expect(setThemeMode).toHaveBeenCalledWith('system', expect.any(Object));
    expect(document.activeElement).toBe(systemBtn);
  });
});
