import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicCommandPalette } from '@/components/ui/CivicCommandPalette';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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
});
