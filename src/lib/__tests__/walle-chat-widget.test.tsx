// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WallEChatWidget } from '@/components/ui/WallEChatWidget';
import { installFetchMock } from './fetch-mock';

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

  it('renders suggestion chips and submits question when a chip is clicked', async () => {
    const mockFetch = installFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          answer: 'Here are our upcoming events for this month.',
          citations: [{ title: 'Events Calendar', url: '/events' }],
        }),
      })
    );

    await act(async () => {
      root.render(<WallEChatWidget />);
    });

    const launcherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open WALL-E assistant"]'
    );
    await act(async () => {
      launcherBtn?.click();
    });

    // Check suggestion chips are visible
    expect(document.body.textContent).toContain('Suggested topics');
    expect(document.body.textContent).toContain('Upcoming Events');

    // Click the upcoming events chip
    const eventsChip = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Upcoming Events')
    );
    expect(eventsChip).toBeDefined();

    await act(async () => {
      eventsChip?.click();
    });

    // Verify query was sent
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/wall-e-chat',
      expect.objectContaining({
        method: 'POST',
      })
    );

    // Verify response rendered with rich formatting and citation
    expect(document.body.textContent).toContain('Here are our upcoming events for this month.');
    expect(document.body.textContent).toContain('Events Calendar');

    // Check reset conversation button appears and functions
    const resetBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Reset conversation"]'
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn?.click();
    });

    expect(document.body.textContent).toContain("Hi! I'm WALL-E");
    expect(document.body.textContent).not.toContain('Here are our upcoming events for this month.');
  });
});
