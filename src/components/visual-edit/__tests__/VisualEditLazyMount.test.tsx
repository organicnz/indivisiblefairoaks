// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualEditLazyMount } from '@/components/visual-edit/VisualEditLazyMount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { editContext, visualMode, pathname } = vi.hoisted(() => ({
  editContext: {
    isAdmin: false,
    target: null,
  },
  visualMode: {
    enabled: false,
    toggle: vi.fn(),
  },
  pathname: { value: '/' },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}));

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => editContext,
}));

vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: () => visualMode,
}));

vi.mock('@/components/visual-edit/VisualEditOverlay', () => ({
  VisualEditOverlay: () => <div data-testid="mock-visual-edit-overlay">Overlay Mounted</div>,
}));

describe('VisualEditLazyMount', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    editContext.isAdmin = false;
    visualMode.enabled = false;
    pathname.value = '/';
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders null when visual editing is off and user is not admin', async () => {
    await act(async () => {
      root.render(<VisualEditLazyMount />);
    });
    expect(container.innerHTML).toBe('');
  });

  it('mounts VisualEditOverlay when user is an admin', async () => {
    editContext.isAdmin = true;
    await act(async () => {
      root.render(<VisualEditLazyMount />);
    });
    expect(container.querySelector('[data-testid="mock-visual-edit-overlay"]')).not.toBeNull();
  });

  it('mounts VisualEditOverlay when visual editing mode is enabled', async () => {
    visualMode.enabled = true;
    await act(async () => {
      root.render(<VisualEditLazyMount />);
    });
    expect(container.querySelector('[data-testid="mock-visual-edit-overlay"]')).not.toBeNull();
  });
});

