import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserSettings } from '@/components/account/UserSettings';
import { cycleThemeMode } from '@/components/layout/theme-store';
import { useSettingsStore } from '@/lib/store/settings';

vi.mock('@/components/layout/theme-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout/theme-store')>();
  return {
    ...actual,
    cycleThemeMode: vi.fn(),
  };
});

vi.mock('@/hooks/useDataPoints', () => ({
  useDataPoints: () => ({ dataPoints: {} }),
}));

vi.mock('@/lib/store/settings', () => ({
  useSettingsStore: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('UserSettings component', () => {
  let container: HTMLDivElement;
  let root: Root;
  const mockUpdateSettings = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();

    (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: {
        marketing_emails: false,
        order_updates: true,
      },
      isLoading: false,
      error: null,
      errorReason: null,
      updateSettings: mockUpdateSettings,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders Appearance & Sensory Luxury card with WebGPU status when available', async () => {
    const originalGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    Object.defineProperty(navigator, 'gpu', {
      value: {
        requestAdapter: vi.fn().mockResolvedValue({}),
      },
      configurable: true,
      writable: true,
    });

    try {
      await act(async () => {
        root.render(<UserSettings />);
      });

      const badge = container.querySelector('[data-testid="gpu-status-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('WebGPU vGPU Hardware Accelerated');
    } finally {
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true,
        writable: true,
      });
    }
  });

  it('renders CSS View Transitions badge when WebGPU is unavailable', async () => {
    const originalGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    Object.defineProperty(navigator, 'gpu', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      await act(async () => {
        root.render(<UserSettings />);
      });

      const badge = container.querySelector('[data-testid="gpu-status-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('CSS View Transitions');
    } finally {
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true,
        writable: true,
      });
    }
  });

  it('renders Accessible Motion Mode badge when prefers-reduced-motion is active', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      await act(async () => {
        root.render(<UserSettings />);
      });

      const badge = container.querySelector('[data-testid="gpu-status-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('Accessible Motion Mode');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('triggers sensory wavefront ripple when clicking the test button', async () => {
    await act(async () => {
      root.render(<UserSettings />);
    });

    const triggerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Trigger Wavefront Ripple')
    );
    expect(triggerBtn).toBeDefined();

    await act(async () => {
      triggerBtn?.click();
    });

    expect(cycleThemeMode).toHaveBeenCalledWith('next', expect.any(Object));
  });

  it('toggles settings via handleToggle switch buttons', async () => {
    await act(async () => {
      root.render(<UserSettings />);
    });

    const switches = container.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(2);

    await act(async () => {
      (switches[0] as HTMLButtonElement).click();
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ marketing_emails: true });
  });
});
