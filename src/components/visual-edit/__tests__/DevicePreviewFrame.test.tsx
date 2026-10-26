// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicePreviewFrame } from '@/components/visual-edit/composer/DevicePreviewFrame';
import type { Block } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DevicePreviewFrame', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockBlock: Block = {
    id: 'block-1',
    type: 'heading',
    level: 2,
    html: 'Test Headline Preview',
  };

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

  it('renders device buttons and theme toggles', async () => {
    const setPreviewDevice = vi.fn();
    const setPreviewTheme = vi.fn();

    await act(async () => {
      root.render(
        <DevicePreviewFrame
          inspectorMode="block"
          previewDevice="desktop"
          setPreviewDevice={setPreviewDevice}
          previewTheme="system"
          setPreviewTheme={setPreviewTheme}
          compiledClassNames="p-4 bg-transparent"
          currentBlock={mockBlock}
        />
      );
    });

    expect(container.textContent).toContain('Live Mini-Preview (block)');
    expect(container.textContent).toContain('Desk');
    expect(container.textContent).toContain('Tab');
    expect(container.textContent).toContain('Mob');
    expect(container.textContent).toContain('Test Headline Preview');

    // Click dark theme preview button
    const darkBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Preview in Dark mode"]'
    );
    expect(darkBtn).not.toBeNull();
    await act(async () => {
      darkBtn?.click();
    });
    expect(setPreviewTheme).toHaveBeenCalledWith('dark');
  });

  it('applies data-theme attribute when a theme is pinned', async () => {
    await act(async () => {
      root.render(
        <DevicePreviewFrame
          inspectorMode="section"
          previewDevice="mobile"
          setPreviewDevice={vi.fn()}
          previewTheme="light"
          setPreviewTheme={vi.fn()}
          compiledClassNames="p-4"
          currentBlock={mockBlock}
        />
      );
    });

    const themedContainer = container.querySelector('[data-theme="light"]');
    expect(themedContainer).not.toBeNull();
  });

  it('renders decorative badge ribbon and tone lock indicator when styles are provided', async () => {
    await act(async () => {
      root.render(
        <DevicePreviewFrame
          inspectorMode="block"
          previewDevice="desktop"
          setPreviewDevice={vi.fn()}
          previewTheme="system"
          setPreviewTheme={vi.fn()}
          compiledClassNames="p-4"
          currentBlock={mockBlock}
          styles={
            {
              themeMode: 'dark',
              badgeText: 'HOT UPDATE',
              badgeTone: 'emerald',
              badgePosition: 'top-right',
            } as unknown as import('@/types/unified').VisualComposerStyles
          }
        />
      );
    });

    expect(container.textContent).toContain('Tone: dark');
    const badgeRibbon = container.querySelector('[data-testid="preview-badge-ribbon"]');
    expect(badgeRibbon).not.toBeNull();
    expect(badgeRibbon?.textContent).toBe('HOT UPDATE');
  });
});
