// @vitest-environment jsdom-same-realm
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
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Site guide');
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
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Online');

    // The current question is sent once, as `message`; it must not also appear
    // in the history that the edge function receives.
    const chatCall = mockFetch.mock.calls.find(([url]) => String(url) === '/api/wall-e-chat') as
      | [string, RequestInit]
      | undefined;
    const requestInit = chatCall?.[1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      message: string;
      history: Array<{ role: string; content: string }>;
    };
    expect(requestBody.message).toBe('What upcoming events does our chapter have scheduled?');
    expect(requestBody.history.some((item) => item.content === requestBody.message)).toBe(false);

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

  it('shows a server error message and keeps an online status for a rate limit', async () => {
    installFetchMock(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too many questions. Please try again later.' }),
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

    const eventsChip = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Upcoming Events')
    );
    await act(async () => {
      eventsChip?.click();
    });

    expect(document.body.textContent).toContain('Too many questions. Please try again later.');
    expect(document.body.textContent).not.toContain("I couldn't reach my notes just now.");
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Online');
  });

  it('ignores an in-flight answer after the conversation is reset', async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    installFetchMock(vi.fn().mockReturnValue(pending));

    await act(async () => {
      root.render(<WallEChatWidget />);
    });

    const launcherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open WALL-E assistant"]'
    );
    await act(async () => {
      launcherBtn?.click();
    });

    const eventsChip = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Upcoming Events')
    );
    await act(async () => {
      eventsChip?.click();
    });
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Checking…');

    const resetBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Reset conversation"]'
    );
    await act(async () => {
      resetBtn?.click();
    });
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Site guide');

    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({ answer: 'This answer arrived after the reset.' }),
      });
      await pending;
    });

    expect(document.body.textContent).not.toContain('This answer arrived after the reset.');
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Site guide');
  });

  it('reports an unavailable check instead of claiming the bot is online', async () => {
    installFetchMock(vi.fn().mockRejectedValue(new Error('offline')));

    await act(async () => {
      root.render(<WallEChatWidget />);
    });

    const launcherBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open WALL-E assistant"]'
    );
    await act(async () => {
      launcherBtn?.click();
    });

    const eventsChip = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Upcoming Events')
    );
    await act(async () => {
      eventsChip?.click();
    });

    expect(document.body.textContent).toContain("I couldn't reach my notes just now.");
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Unavailable');
  });
});
