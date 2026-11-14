// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualEditErrorBoundary } from '@/components/visual-edit/VisualEditErrorBoundary';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Boom(): never {
  throw new Error('kaboom');
}

describe('VisualEditErrorBoundary', () => {
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

  it('renders children when nothing throws', async () => {
    await act(async () => {
      root.render(
        <VisualEditErrorBoundary>
          <p>Page content</p>
        </VisualEditErrorBoundary>
      );
    });
    expect(container.textContent).toContain('Page content');
  });

  it('catches a render error and does not crash the page', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      root.render(
        <VisualEditErrorBoundary>
          <Boom />
        </VisualEditErrorBoundary>
      );
    });
    expect(spy).toHaveBeenCalledWith(
      'Visual editor crashed:',
      expect.any(Error),
      expect.any(String)
    );
    spy.mockRestore();
  });

  it('renders a recoverable fallback and announces the crash', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onCrash = vi.fn();
    window.addEventListener(VISUAL_EDIT_EVENTS.crashed, onCrash);
    await act(async () => {
      root.render(
        <VisualEditErrorBoundary>
          <Boom />
        </VisualEditErrorBoundary>
      );
    });

    expect(container.textContent).toContain('Visual editor stopped unexpectedly');
    expect(container.textContent).toContain('Reload editor');
    expect(container.querySelector('a[href="/admin/content"]')?.textContent).toContain(
      'Pages & Posts'
    );
    expect(onCrash).toHaveBeenCalledTimes(1);

    window.removeEventListener(VISUAL_EDIT_EVENTS.crashed, onCrash);
    spy.mockRestore();
  });
});
