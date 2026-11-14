// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposerWorkspaceBoot } from '@/components/visual-edit/ComposerWorkspaceBoot';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';

const setVisualEditMode = vi.hoisted(() => vi.fn());
vi.mock('@/components/layout/visual-edit-store', () => ({ setVisualEditMode }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('ComposerWorkspaceBoot readiness', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setVisualEditMode.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const readiness = () =>
    container.querySelector<HTMLElement>('[data-testid="composer-readiness"]');

  it('reports the document load and flips to ready when the rail publishes it', async () => {
    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    expect(setVisualEditMode).toHaveBeenCalledWith(true);
    expect(readiness()?.textContent).toContain('Starting the visual editor');

    const overlay = document.createElement('aside');
    overlay.setAttribute('data-testid', 'visual-edit-overlay');
    overlay.setAttribute('data-document-state', 'loading');
    await act(async () => {
      document.body.appendChild(overlay);
      await flush();
    });

    expect(readiness()?.dataset.state).toBe('loading');
    expect(readiness()?.textContent).toContain('Opening the saved document');

    await act(async () => {
      overlay.setAttribute('data-document-state', 'ready');
      await flush();
    });

    expect(readiness()?.dataset.state).toBe('ready');
    expect(readiness()?.textContent).toContain('Editor ready');
  });

  it('reopens a closed editor and follows the remounted overlay', async () => {
    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    const overlay = document.createElement('aside');
    overlay.setAttribute('data-testid', 'visual-edit-overlay');
    overlay.setAttribute('data-document-state', 'ready');
    await act(async () => {
      document.body.appendChild(overlay);
      await flush();
    });
    expect(readiness()?.dataset.state).toBe('ready');

    await act(async () => {
      overlay.remove();
      await flush();
    });
    expect(readiness()?.dataset.state).toBe('closed');

    const reopen = Array.from(readiness()?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Reopen editor')
    );
    expect(reopen).toBeDefined();
    await act(async () => {
      reopen?.click();
    });
    expect(readiness()?.dataset.state).toBe('starting');
    expect(setVisualEditMode).toHaveBeenCalledWith(true);

    const reopened = document.createElement('aside');
    reopened.setAttribute('data-testid', 'visual-edit-overlay');
    reopened.setAttribute('data-document-state', 'loading');
    await act(async () => {
      document.body.appendChild(reopened);
      await flush();
    });
    expect(readiness()?.dataset.state).toBe('loading');

    await act(async () => {
      reopened.setAttribute('data-document-state', 'ready');
      await flush();
    });
    expect(readiness()?.dataset.state).toBe('ready');
  });

  it('reports a crashed editor rather than leaving the ready message in place', async () => {
    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.crashed, { detail: { message: 'boom' } })
      );
      await flush();
    });

    expect(readiness()?.dataset.state).toBe('crashed');
    expect(readiness()?.textContent).toContain('stopped unexpectedly');
    expect(readiness()?.querySelector('button')?.textContent).toContain('Reload');
  });

  it('times out instead of waiting forever for an overlay that never mounts', async () => {
    vi.useFakeTimers();
    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    await act(async () => {
      vi.advanceTimersByTime(12_001);
    });

    expect(readiness()?.dataset.state).toBe('slow');
    expect(readiness()?.textContent).toContain('Still starting the visual editor');

    await act(async () => {
      vi.advanceTimersByTime(13_000);
    });

    expect(readiness()?.dataset.state).toBe('unavailable');
    expect(readiness()?.textContent).toContain('did not finish opening');
  });

  it('recovers from the start timeout when the overlay arrives late', async () => {
    vi.useFakeTimers();
    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    await act(async () => {
      vi.advanceTimersByTime(12_001);
    });
    expect(readiness()?.dataset.state).toBe('slow');

    const overlay = document.createElement('aside');
    overlay.setAttribute('data-testid', 'visual-edit-overlay');
    overlay.setAttribute('data-document-state', 'loading');
    await act(async () => {
      document.body.appendChild(overlay);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(readiness()?.dataset.state).toBe('loading');
  });

  it('gives a retried document load a fresh timeout clock', async () => {
    vi.useFakeTimers();
    const overlay = document.createElement('aside');
    overlay.setAttribute('data-testid', 'visual-edit-overlay');
    overlay.setAttribute('data-document-state', 'loading');
    document.body.appendChild(overlay);

    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    // The first read reaches its own timeout and the rail publishes failure.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_001);
      overlay.setAttribute('data-document-state', 'degraded');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(readiness()?.dataset.state).toBe('degraded');

    // Retrying four seconds before the old deadline must not inherit it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      overlay.setAttribute('data-document-state', 'loading');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(readiness()?.dataset.state).toBe('loading');

    // The original 25s timer would have fired here. The retry's own clock has
    // not, so the editor is still legitimately opening.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(readiness()?.dataset.state).toBe('loading');

    await act(async () => {
      overlay.setAttribute('data-document-state', 'ready');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(readiness()?.dataset.state).toBe('ready');
  });

  it('does not call a mounted editor unavailable while its document is still opening', async () => {
    vi.useFakeTimers();
    const overlay = document.createElement('aside');
    overlay.setAttribute('data-testid', 'visual-edit-overlay');
    overlay.setAttribute('data-document-state', 'loading');
    document.body.appendChild(overlay);

    await act(async () => {
      root.render(<ComposerWorkspaceBoot />);
    });

    await act(async () => {
      vi.advanceTimersByTime(12_001);
    });
    expect(readiness()?.dataset.state).toBe('loading');
    expect(readiness()?.textContent).toContain('Opening the saved document');

    await act(async () => {
      vi.advanceTimersByTime(13_000);
    });
    expect(readiness()?.dataset.state).toBe('unavailable');
    expect(readiness()?.textContent).toContain('did not finish opening');
  });
});
