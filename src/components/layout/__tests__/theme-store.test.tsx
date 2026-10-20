// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cycleThemeMode,
  setThemeMode,
  syncTheme,
  useThemeMode,
} from '@/components/layout/theme-store';
import { THEME_STORAGE_KEY } from '@/lib/theme';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A matchMedia stub that records listeners so a test can fire them. */
function fakeMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const media = {
    matches: prefersDark,
    addEventListener: vi.fn((type: string, listener: (event: { matches: boolean }) => void) => {
      if (type === 'change') listeners.add(listener);
    }),
    removeEventListener: vi.fn(),
    /** Simulate the reader flipping their OS setting. */
    flip(next: boolean) {
      media.matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
  return media;
}

describe('theme store', () => {
  let container: HTMLDivElement;
  let root: Root;
  let media: ReturnType<typeof fakeMatchMedia>;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    media = fakeMatchMedia(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media)
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function render() {
    // Held in a box because the probe assigns it during render, which React
    // runs inside `act`. A `let` would trip the no-non-null-assertion rule on
    // the read; a box makes the null real and checked.
    const captured: { current: ReturnType<typeof useThemeMode> | null } = { current: null };
    function Probe() {
      captured.current = useThemeMode();
      return null;
    }
    act(() => {
      root = createRoot(container);
      root.render(<Probe />);
    });
    return () => {
      if (!captured.current) throw new Error('probe never rendered');
      return captured.current;
    };
  }

  it('starts on system and follows a light OS', () => {
    const get = render();
    expect(get().mode).toBe('system');
    expect(get().effective).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('follows the OS setting live while the mode is system', () => {
    const get = render();
    act(() => {
      media.flip(true);
    });
    expect(get().effective).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores OS changes while a pin is set', () => {
    const get = render();
    act(() => {
      setThemeMode('light');
    });
    act(() => {
      media.flip(true);
    });
    expect(get().mode).toBe('light');
    expect(get().effective).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists a pin and re-applies it on the next mount', () => {
    act(() => {
      setThemeMode('dark');
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    const get = render();
    expect(get().mode).toBe('dark');
    expect(get().effective).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('removes the key when the pin is withdrawn', () => {
    act(() => {
      setThemeMode('dark');
    });
    act(() => {
      setThemeMode('system');
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('cycles system → light → dark → system', () => {
    const get = render();
    const modes: string[] = [];
    act(() => {
      modes.push(cycleThemeMode());
    });
    act(() => {
      modes.push(cycleThemeMode());
    });
    act(() => {
      modes.push(cycleThemeMode());
    });
    expect(modes).toEqual(['light', 'dark', 'system']);
    expect(get().mode).toBe('system');
  });

  it('cycles system ← light ← dark ← system in reverse order', () => {
    const get = render();
    const modes: string[] = [];
    act(() => {
      modes.push(cycleThemeMode('prev'));
    });
    act(() => {
      modes.push(cycleThemeMode('prev'));
    });
    act(() => {
      modes.push(cycleThemeMode('prev'));
    });
    expect(modes).toEqual(['dark', 'light', 'system']);
    expect(get().mode).toBe('system');
  });

  it('adopts a preference written by another tab', () => {
    const get = render();
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });
    expect(get().mode).toBe('dark');
    expect(get().effective).toBe('dark');
  });

  it('reconciles storage against the current state', () => {
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    });
    act(() => {
      syncTheme();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies the resolved palette to the document', () => {
    act(() => {
      setThemeMode('dark');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('synchronizes theme mode across tabs via BroadcastChannel', () => {
    const postMessageSpy = vi.fn();
    const channels: {
      name: string;
      onmessage: ((event: { data: unknown }) => void) | null;
      postMessage: (msg: unknown) => void;
      close: () => void;
    }[] = [];

    class MockBroadcastChannel {
      name: string;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(name: string) {
        this.name = name;
        channels.push(this);
      }
      postMessage(msg: unknown) {
        postMessageSpy(msg);
      }
      close() {}
    }

    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    const get = render();

    // Verify setThemeMode broadcasts to channel
    act(() => {
      setThemeMode('dark');
    });
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'THEME_SYNC',
        mode: 'dark',
        effective: 'dark',
      })
    );

    // Simulate incoming broadcast from another tab
    const listenerChannel = channels.find((c) => typeof c.onmessage === 'function');
    expect(listenerChannel).toBeDefined();

    act(() => {
      listenerChannel?.onmessage?.({
        data: {
          type: 'THEME_SYNC',
          mode: 'light',
          effective: 'light',
          sourceId: 'remote-tab-id-999',
          txId: 9999,
          timestamp: Date.now(),
        },
      });
    });

    expect(get().mode).toBe('light');
    expect(get().effective).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
