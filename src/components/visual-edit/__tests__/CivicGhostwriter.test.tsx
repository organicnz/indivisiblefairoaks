// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicGhostwriter } from '@/components/visual-edit/CivicGhostwriter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CivicGhostwriter', () => {
  let container: HTMLDivElement;
  let root: Root;
  let editableEl: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    editableEl = document.createElement('p');
    editableEl.textContent = 'we are of the opinion that democracy in order to thrive needs people';
    document.body.appendChild(editableEl);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders AI Polish trigger button', () => {
    act(() => {
      root.render(<CivicGhostwriter element={editableEl} />);
    });

    const trigger = document.querySelector('button[aria-label="AI Civic Ghostwriter"]');
    expect(trigger).not.toBeNull();
  });

  it('transforms text to punchy version when triggered', () => {
    act(() => {
      root.render(<CivicGhostwriter element={editableEl} defaultOpen={true} />);
    });

    const punchyOption = Array.from(document.querySelectorAll('div[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Make Punchier')
    );
    expect(punchyOption).toBeDefined();

    act(() => {
      (punchyOption as HTMLElement)?.click();
    });

    // Verify filler words were replaced
    expect(editableEl.textContent).toContain('we believe');
    expect(editableEl.textContent).toContain('to thrive');
  });
});
