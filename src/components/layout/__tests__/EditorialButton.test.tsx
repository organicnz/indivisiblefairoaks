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

vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: () => ({
    enabled: mockEnabled,
    toggle: mockToggle,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}));

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

    // Set up mock DOM sections
    const main = document.createElement('main');
    const sec1 = document.createElement('section');
    const h1 = document.createElement('h2');
    h1.textContent = 'Mission Statement';
    sec1.appendChild(h1);
    main.appendChild(sec1);
    document.body.appendChild(main);

    await act(async () => {
      root.render(<EditorialButton />);
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

    const main = document.createElement('main');
    const sec1 = document.createElement('section');
    const h1 = document.createElement('h2');
    h1.textContent = 'Community Voices';
    sec1.appendChild(h1);
    main.appendChild(sec1);
    document.body.appendChild(main);

    const eventListener = vi.fn();
    window.addEventListener('indivisible:focus-section', eventListener);

    await act(async () => {
      root.render(<EditorialButton />);
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
        detail: { index: 0, openEdit: false },
      })
    );
    window.removeEventListener('indivisible:focus-section', eventListener);
  });

  it('renders mobile drawer row with parity', async () => {
    mockEnabled = true;
    const onNavigate = vi.fn();

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={onNavigate} />);
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
});
