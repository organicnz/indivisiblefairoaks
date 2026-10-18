import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const mockSetMode = vi.fn();
const mockCycle = vi.fn();
let mockMode = 'system' as 'system' | 'light' | 'dark';

vi.mock('@/components/layout/theme-store', () => ({
  useThemeMode: () => ({
    mode: mockMode,
    setMode: mockSetMode,
    cycle: mockCycle,
    effective: mockMode === 'system' ? 'light' : mockMode,
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemeToggle component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockMode = 'system';
    mockSetMode.mockClear();
    mockCycle.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders icon variant and cycles theme mode on click', async () => {
    await act(async () => {
      root.render(<ThemeToggle variant="icon" />);
    });

    const button = container.querySelector<HTMLButtonElement>('button[data-theme-mode="system"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toContain('Color theme:');

    await act(async () => {
      button?.click();
    });

    expect(mockCycle).toHaveBeenCalledTimes(1);
  });

  it('renders block variant in drawer with direct mode buttons', async () => {
    await act(async () => {
      root.render(<ThemeToggle variant="block" />);
    });

    const cycleButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label*="Color theme:"]'
    );
    expect(cycleButton).not.toBeNull();

    await act(async () => {
      cycleButton?.click();
    });
    expect(mockCycle).toHaveBeenCalledTimes(1);

    // Direct mode buttons in fieldset
    const lightButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.textContent?.trim().toLowerCase() === 'light'
    );
    expect(lightButton).not.toBeUndefined();

    await act(async () => {
      lightButton?.click();
    });
    expect(mockSetMode).toHaveBeenCalledWith('light');
  });

  it('renders segmented variant for direct mode selection', async () => {
    await act(async () => {
      root.render(<ThemeToggle variant="segmented" />);
    });

    const darkButton = container.querySelector<HTMLButtonElement>('button[data-theme-mode="dark"]');
    expect(darkButton).not.toBeNull();

    await act(async () => {
      darkButton?.click();
    });
    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });

  it('navigates through segmented theme options with arrow keys', async () => {
    await act(async () => {
      root.render(<ThemeToggle variant="segmented" />);
    });

    const systemButton = container.querySelector<HTMLButtonElement>(
      'button[data-theme-mode="system"]'
    );
    expect(systemButton).not.toBeNull();

    // Press ArrowRight from 'system' (index 0) -> should target 'light' (index 1)
    await act(async () => {
      systemButton?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      );
    });

    expect(mockSetMode).toHaveBeenCalledWith('light', expect.any(Object));

    // Press ArrowLeft from 'system' (index 0) -> should wrap to 'dark' (index 2)
    await act(async () => {
      systemButton?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
      );
    });

    expect(mockSetMode).toHaveBeenCalledWith('dark', expect.any(Object));
  });
});
