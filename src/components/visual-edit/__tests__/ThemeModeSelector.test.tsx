// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeModeSelector } from '@/components/visual-edit/composer/ui/ThemeModeSelector';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemeModeSelector', () => {
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

  it('renders all four theme mode pills and native select element', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ThemeModeSelector
          id="test-theme-mode-select"
          label="Test Theme Override"
          value="inherit"
          onChange={onChange}
        />
      );
    });

    // Check title and short label badge
    expect(container.textContent).toContain('Test Theme Override');
    expect(container.textContent).toContain('Inherit');

    // Check all pill buttons
    expect(container.textContent).toContain('System');
    expect(container.textContent).toContain('Light');
    expect(container.textContent).toContain('Dark');

    // Check accessible native select
    const select = container.querySelector<HTMLSelectElement>('#test-theme-mode-select');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('inherit');
  });

  it('calls onChange with correct mode when clicking pill button', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<ThemeModeSelector id="test-theme-select" value="inherit" onChange={onChange} />);
    });

    const darkPill = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Dark')
    );
    expect(darkPill).not.toBeNull();

    await act(async () => {
      darkPill?.click();
    });

    expect(onChange).toHaveBeenCalledWith('dark');

    const systemPill = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('System')
    );
    expect(systemPill).not.toBeNull();

    await act(async () => {
      systemPill?.click();
    });

    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('updates when native select fires change event', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<ThemeModeSelector id="custom-select-id" value="inherit" onChange={onChange} />);
    });

    const select = container.querySelector<HTMLSelectElement>('#custom-select-id');
    expect(select).not.toBeNull();

    if (select) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(select, 'light');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith('light');
    }
  });
});
