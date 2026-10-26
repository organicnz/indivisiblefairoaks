// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemePreviewToggle } from '@/components/visual-edit/composer/ui/ThemePreviewToggle';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemePreviewToggle', () => {
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
    vi.restoreAllMocks();
  });

  it('renders all three theme buttons (System, Light, Dark)', async () => {
    const onSelectMode = vi.fn();
    await act(async () => {
      root.render(<ThemePreviewToggle currentMode="system" onSelectMode={onSelectMode} />);
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(container.textContent).toContain('System');
    expect(container.textContent).toContain('Light');
    expect(container.textContent).toContain('Dark');
  });

  it('renders compact labels when compact is true', async () => {
    const onSelectMode = vi.fn();
    await act(async () => {
      root.render(<ThemePreviewToggle currentMode="light" onSelectMode={onSelectMode} compact />);
    });

    expect(container.textContent).toContain('Sys');
    expect(container.textContent).toContain('Light');
    expect(container.textContent).toContain('Dark');
  });

  it('calls onSelectMode when a theme button is clicked', async () => {
    const onSelectMode = vi.fn();
    await act(async () => {
      root.render(<ThemePreviewToggle currentMode="system" onSelectMode={onSelectMode} />);
    });

    const darkButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Preview in Dark mode"]'
    );
    expect(darkButton).not.toBeNull();

    await act(async () => {
      darkButton?.click();
    });

    expect(onSelectMode).toHaveBeenCalledWith('dark');
  });
});
