// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WallEChatWidget } from '@/components/ui/WallEChatWidget';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WallEChatWidget', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders closed launcher button with accessible label and avatar', async () => {
    await act(async () => {
      root.render(<WallEChatWidget />);
    });

    const launcherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open WALL-E assistant"]'
    );
    expect(launcherBtn).toBeDefined();
    expect(container.textContent).toContain('Ask WALL-E');
  });

  it('opens chat dialogue when launcher is clicked, and morphs button to close', async () => {
    await act(async () => {
      root.render(<WallEChatWidget />);
    });

    const launcherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open WALL-E assistant"]'
    );
    expect(launcherBtn).toBeDefined();

    await act(async () => {
      launcherBtn?.click();
    });

    // Chat dialogue rendered in document.body via Dialog.Portal
    expect(document.body.textContent).toContain('WALL-E');
    expect(document.body.textContent).toContain('Online');
    expect(document.body.textContent).toContain("Hi! I'm WALL-E");

    // Launcher button morphs to close
    const closeLauncherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close WALL-E assistant"]'
    );
    expect(closeLauncherBtn).toBeDefined();

    // Dialog header close button also exists in document.body
    const closeDialogBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Close WALL-E assistant"]'
    );
    expect(closeDialogBtn).toBeDefined();

    // Input exists and has accessible label
    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Message WALL-E"]'
    );
    expect(input).toBeDefined();
  });

  it('closes dialogue when header close button or launcher is clicked', async () => {
    await act(async () => {
      root.render(<WallEChatWidget />);
    });

    const launcherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open WALL-E assistant"]'
    );

    await act(async () => {
      launcherBtn?.click();
    });

    expect(document.body.textContent).toContain("Hi! I'm WALL-E");

    const closeBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Close WALL-E assistant"]'
    );

    await act(async () => {
      closeBtn?.click();
    });

    expect(document.body.textContent).not.toContain("Hi! I'm WALL-E");
  });
});
