// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChoirSongbookExplorer } from '@/components/ui/ChoirSongbookExplorer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ChoirSongbookExplorer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders choir songbook title, description, and default songs', async () => {
    await act(async () => {
      root.render(<ChoirSongbookExplorer />);
    });

    expect(container.textContent).toContain('Carmichael Resistance Choir Songbook');
    expect(container.textContent).toContain('Anthems, Chants & Freedom Songs');
    expect(container.textContent).toContain('Singing for Our Lives');
    expect(container.textContent).toContain('Ain’t Gonna Let Nobody Turn Me Around');
    expect(container.textContent).toContain('We Shall Not Be Moved');
    expect(container.textContent).toContain('Ella’s Song');
    expect(container.textContent).toContain('This Land Is Your Land');
  });

  it('filters songs by category filter button', async () => {
    await act(async () => {
      root.render(<ChoirSongbookExplorer />);
    });

    const laborButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Labor & Freedom'
    );
    expect(laborButton).toBeDefined();

    await act(async () => {
      laborButton?.click();
    });

    // Should include labor songs, exclude civil rights only songs
    expect(container.textContent).toContain('We Shall Not Be Moved');
    expect(container.textContent).toContain('This Land Is Your Land');
    expect(container.textContent).not.toContain('Singing for Our Lives');
    expect(container.textContent).not.toContain('Ella’s Song');
  });

  it('filters songs by search query', async () => {
    await act(async () => {
      root.render(<ChoirSongbookExplorer />);
    });

    const searchInput = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      if (searchInput) {
        // Set search query for Guthrie
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(searchInput, 'Guthrie');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(container.textContent).toContain('This Land Is Your Land');
    expect(container.textContent).not.toContain('Singing for Our Lives');
  });

  it('toggles chords visibility on click', async () => {
    await act(async () => {
      root.render(<ChoirSongbookExplorer />);
    });

    // Initially chords button says 'Show Chords'
    const chordsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Show Chords')
    );
    expect(chordsBtn).toBeDefined();
    expect(container.textContent).not.toContain('Chords: C - G - Am - F');

    await act(async () => {
      chordsBtn?.click();
    });

    expect(chordsBtn?.textContent).toContain('Chords: Visible');
    expect(container.textContent).toContain('Chords:');
  });

  it('toggles song expansion and accessible aria attributes', async () => {
    await act(async () => {
      root.render(<ChoirSongbookExplorer />);
    });

    // Default expanded is 'singing-for-our-lives'
    const defaultToggle = container.querySelector<HTMLButtonElement>(
      'button[aria-controls="song-body-singing-for-our-lives"]'
    );
    expect(defaultToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#song-body-singing-for-our-lives')).not.toBeNull();

    // Collapse it
    await act(async () => {
      defaultToggle?.click();
    });

    expect(defaultToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#song-body-singing-for-our-lives')).toBeNull();

    // Expand another song: 'aint-gonna-let-nobody'
    const aintGonnaToggle = container.querySelector<HTMLButtonElement>(
      'button[aria-controls="song-body-aint-gonna-let-nobody"]'
    );
    expect(aintGonnaToggle?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      aintGonnaToggle?.click();
    });

    expect(aintGonnaToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#song-body-aint-gonna-let-nobody')).not.toBeNull();
    expect(container.textContent).toContain('Albany Movement (1962)');
  });
});
