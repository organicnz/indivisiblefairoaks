import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorialButton, EditorialDrawerRow } from '@/components/layout/EditorialButton';

const mockToggle = vi.fn();
let mockEnabled = false;
let mockIsAdmin = true;
let mockLoading = false;

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => ({
    loading: mockLoading,
    isAdmin: mockIsAdmin,
    target: { label: 'About Us', editUrl: '/admin/content/1' },
  }),
}));

// The section list comes from the overlay, not from the header. These mock the
// mode store only — the tests that exercise a section list publish one, because
// a header that derived its own list was the bug.
vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: () => ({
    enabled: mockEnabled,
    toggle: mockToggle,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}));

/**
 * Publish the section list the overlay would send, as the overlay sends it.
 *
 * Every field matters: `index` is the DOM ordinal, `blockIndex` is the block the
 * controls address, and `enabled` is whether the overlay is drawing a frame. A
 * test that leaves one out is testing a shape no component produces.
 */
function publishSections(
  sections: {
    index: number | null;
    label: string;
    blockIndex: number | null;
    blockType?: string | null;
    enabled?: boolean;
  }[]
) {
  window.dispatchEvent(
    new CustomEvent('indivisible:page-sections-updated', {
      detail: {
        sections: sections.map((section) => ({
          blockType: null,
          enabled: false,
          ...section,
        })),
        pathname: '/about',
      },
    })
  );
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EditorialButton component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockEnabled = false;
    mockIsAdmin = true;
    mockLoading = false;
    mockToggle.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders nothing when user is not an admin', async () => {
    mockIsAdmin = false;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    expect(container.querySelector('[data-testid="editorial-edit-button"]')).toBeNull();
  });

  it('renders idle toggle button for admin', async () => {
    mockIsAdmin = true;
    mockEnabled = false;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="editorial-edit-button"]');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      btn?.click();
    });
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('renders section dropdown trigger when visual editing is ON', async () => {
    mockEnabled = true;

    await act(async () => {
      root.render(<EditorialButton />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Mission Statement', blockIndex: 0 }]);
    });

    const btn = container.querySelector<HTMLButtonElement>('[data-testid="editorial-edit-button"]');
    expect(btn?.getAttribute('aria-pressed')).toBe('true');

    const dropdownTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section editor menu"]'
    );
    expect(dropdownTrigger).not.toBeNull();

    // Open dropdown
    await act(async () => {
      dropdownTrigger?.click();
    });

    const menu = container.querySelector('[role="dialog"][aria-label="Page Sections Menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Mission Statement');
  });

  it('dispatches focus event when a section is clicked in the menu', async () => {
    mockEnabled = true;

    const eventListener = vi.fn();
    window.addEventListener('indivisible:focus-section', eventListener);

    await act(async () => {
      root.render(<EditorialButton />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Community Voices', blockIndex: 0 }]);
    });

    const dropdownTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section editor menu"]'
    );
    await act(async () => {
      dropdownTrigger?.click();
    });

    const sectionBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Jump to Community Voices"]'
    );
    expect(sectionBtn).not.toBeNull();

    await act(async () => {
      sectionBtn?.click();
    });

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { blockIndex: 0, openEdit: false },
      })
    );
    window.removeEventListener('indivisible:focus-section', eventListener);
  });

  it('toggles visual frame for an individual section', async () => {
    mockEnabled = true;

    const toggleListener = vi.fn();
    window.addEventListener('indivisible:toggle-section-visual', toggleListener);

    await act(async () => {
      root.render(<EditorialButton />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Action Alerts', blockIndex: 0, enabled: true }]);
    });

    const dropdownTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section editor menu"]'
    );
    await act(async () => {
      dropdownTrigger?.click();
    });

    const toggleSwitch = container.querySelector<HTMLButtonElement>(
      'button[role="switch"][aria-label="Toggle visual editing for Action Alerts"]'
    );
    expect(toggleSwitch).not.toBeNull();
    expect(toggleSwitch?.getAttribute('aria-checked')).toBe('true');

    // Click to toggle off
    await act(async () => {
      toggleSwitch?.click();
    });

    expect(toggleListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { blockIndex: 0, enabled: false },
      })
    );
    window.removeEventListener('indivisible:toggle-section-visual', toggleListener);
  });

  it('dispatches duplicate-section event when duplicate button is clicked', async () => {
    mockEnabled = true;

    const dupListener = vi.fn();
    window.addEventListener('indivisible:duplicate-section', dupListener);

    await act(async () => {
      root.render(<EditorialButton />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Community Calendar', blockIndex: 0 }]);
    });

    const dropdownTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section editor menu"]'
    );
    await act(async () => {
      dropdownTrigger?.click();
    });

    const dupBtn = container.querySelector<HTMLButtonElement>('button[title="Duplicate section"]');
    expect(dupBtn).not.toBeNull();

    await act(async () => {
      dupBtn?.click();
    });

    expect(dupListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { blockIndex: 0 },
      })
    );
    window.removeEventListener('indivisible:duplicate-section', dupListener);
  });

  it('renders mobile drawer row with parity and section toggles', async () => {
    mockEnabled = true;
    const onNavigate = vi.fn();

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={onNavigate} />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Get Out The Vote', blockIndex: 0, enabled: true }]);
    });

    const switchBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="editorial-visual-edit-row"]'
    );
    expect(switchBtn).not.toBeNull();
    expect(switchBtn?.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      switchBtn?.click();
    });
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  /**
   * A section the overlay has not described cannot be addressed.
   *
   * `blockIndex: null` is what `discoverPageSections` returns for the DOM-only
   * fallback, and every control on such a row must be inert rather than
   * dispatching an event the overlay would have to guess at. Rendering them live
   * is how the header came to offer "edit section 3" for an element that was
   * really section 4.
   */
  it('disables every control for a section the overlay has not described', async () => {
    mockEnabled = true;

    await act(async () => {
      root.render(<EditorialButton />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Not yet described', blockIndex: null }]);
    });

    const dropdownTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section editor menu"]'
    );
    await act(async () => {
      dropdownTrigger?.click();
    });

    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="switch"], button[title]')
    );
    const sectionControls = controls.filter((button) =>
      button.getAttribute('title')?.includes('Waiting for the editor')
    );
    expect(sectionControls.length).toBeGreaterThan(0);
    for (const control of sectionControls) {
      expect(control.disabled).toBe(true);
    }
  });
});
