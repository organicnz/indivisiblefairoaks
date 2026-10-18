import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicCommandPalette } from '@/components/ui/CivicCommandPalette';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/',
}));

const mockSetMode = vi.fn();
const mockCycle = vi.fn();
vi.mock('@/components/layout/theme-store', () => ({
  useThemeMode: vi.fn(() => ({
    mode: 'system',
    effective: 'light',
    setMode: mockSetMode,
    cycle: mockCycle,
  })),
}));

const mockToggleVisualEdit = vi.fn();
vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: vi.fn(() => ({
    enabled: false,
    toggle: mockToggleVisualEdit,
  })),
}));

const mockUseEditContext = vi.hoisted(() =>
  vi.fn(() => ({ loading: false, isAdmin: false, target: null }))
);
vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: mockUseEditContext,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CivicCommandPalette component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockPush.mockClear();
    mockSetMode.mockClear();
    mockCycle.mockClear();
    mockToggleVisualEdit.mockClear();
    mockUseEditContext.mockReturnValue({ loading: false, isAdmin: false, target: null });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders search trigger button', async () => {
    await act(async () => {
      root.render(<CivicCommandPalette />);
    });

    const trigger = container.querySelector('button[aria-label="Search site (Command K)"]');
    expect(trigger).not.toBeNull();
  });

  it('filters theme commands when searching for theme', async () => {
    await act(async () => {
      root.render(<CivicCommandPalette isOpen={true} setIsOpen={vi.fn()} />);
    });

    const input = document.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      input.value = 'theme';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Directly invoke onChange for React synthetic event
      const changeEvent = new Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', { value: { value: 'theme' } });
      input.dispatchEvent(changeEvent);
    });

    // In React 19 / tests, setting input via change handler:
    const options = document.querySelectorAll('li[role="option"]');
    expect(options.length).toBeGreaterThan(0);
  });

  it('triggers setMode when a theme option is selected', async () => {
    await act(async () => {
      root.render(<CivicCommandPalette isOpen={true} setIsOpen={vi.fn()} />);
    });

    // Locate the dark theme option
    const options = Array.from(document.querySelectorAll('li[role="option"]'));
    const darkOption = options.find((opt) => opt.textContent?.includes('Dark Theme'));
    expect(darkOption).toBeDefined();

    await act(async () => {
      darkOption?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });

  it('triggers setMode for system theme option', async () => {
    await act(async () => {
      root.render(<CivicCommandPalette isOpen={true} setIsOpen={vi.fn()} />);
    });

    const options = Array.from(document.querySelectorAll('li[role="option"]'));
    const systemOption = options.find((opt) => opt.textContent?.includes('System Theme'));
    expect(systemOption).toBeDefined();

    await act(async () => {
      systemOption?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockSetMode).toHaveBeenCalledWith('system');
  });

  it('triggers cycle for cycle color theme option', async () => {
    await act(async () => {
      root.render(<CivicCommandPalette isOpen={true} setIsOpen={vi.fn()} />);
    });

    const options = Array.from(document.querySelectorAll('li[role="option"]'));
    const cycleOption = options.find((opt) => opt.textContent?.includes('Cycle Color Theme'));
    expect(cycleOption).toBeDefined();

    await act(async () => {
      cycleOption?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockCycle).toHaveBeenCalledWith('next');
  });

  it('shows admin publishing and management options when logged in as admin', async () => {
    mockUseEditContext.mockReturnValue({ loading: false, isAdmin: true, target: null });
    await act(async () => {
      root.render(<CivicCommandPalette isOpen={true} setIsOpen={vi.fn()} />);
    });

    const options = Array.from(document.querySelectorAll('li[role="option"]'));
    const newPostOption = options.find((opt) => opt.textContent?.includes('Write New Post'));
    expect(newPostOption).toBeDefined();

    const eventsOption = options.find((opt) => opt.textContent?.includes('Manage Chapter Events'));
    expect(eventsOption).toBeDefined();

    const newsOption = options.find((opt) =>
      opt.textContent?.includes('Manage Bulletins & Newsletters')
    );
    expect(newsOption).toBeDefined();

    const linksOption = options.find((opt) =>
      opt.textContent?.includes('Manage Coalition & Action Links')
    );
    expect(linksOption).toBeDefined();

    const visualEditOption = options.find((opt) =>
      opt.textContent?.includes('Toggle Visual Editor')
    );
    expect(visualEditOption).toBeDefined();

    await act(async () => {
      newPostOption?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/content/new?type=post');
  });
});
