// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeAwareToaster } from '@/components/layout/ThemeAwareToaster';

/*
 * The toaster's layout is a hit-testing contract with the visual editor, not
 * decoration. Sonner's layer defaults to z-index 999999999, above the editor
 * dock (9998) and inspector (10010); a toast at bottom-right therefore sits on
 * top of the per-block "Visual Composer" buttons and swallows the click. The
 * unit suite cannot click through the real layer (sonner is mocked elsewhere),
 * so this pins the two props that keep the editor reachable.
 */
const sonnerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const visualMode = vi.hoisted(() => ({ enabled: false }));

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => {
    sonnerProps.current = props;
    return null;
  },
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/about' }));

vi.mock('@/components/layout/theme-store', () => ({
  useThemeMode: () => ({ mode: 'light', effective: 'light', setMode: vi.fn(), cycle: vi.fn() }),
}));

vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: () => ({ enabled: visualMode.enabled, toggle: () => {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemeAwareToaster', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    visualMode.enabled = false;
    sonnerProps.current = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('stays bottom-right and at sonner’s own layer outside visual editing', async () => {
    await act(async () => {
      root.render(<ThemeAwareToaster />);
    });

    expect(sonnerProps.current?.position).toBe('bottom-right');
    expect(sonnerProps.current?.style).toBeUndefined();
  });

  it('moves off the editor dock and below its chrome while visual editing', async () => {
    visualMode.enabled = true;

    await act(async () => {
      root.render(<ThemeAwareToaster />);
    });

    expect(sonnerProps.current?.position).toBe('bottom-left');
    const style = sonnerProps.current?.style as { zIndex?: number } | undefined;
    // Below the dock (9998) and the inspector (10010): the editor keeps the click.
    expect(style?.zIndex).toBe(9000);
    expect(style?.zIndex).toBeLessThan(9998);
  });
});
