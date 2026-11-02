// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SacramentoRepresentativeFinder } from '../SacramentoRepresentativeFinder';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SacramentoRepresentativeFinder', () => {
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

  it('renders representative lookup and 5 Calls action button', async () => {
    await act(async () => {
      root.render(<SacramentoRepresentativeFinder />);
    });

    expect(container.textContent).toContain('Representative Finder');
    expect(container.textContent).toContain('5 Calls App');

    const fiveCallsLink = container.querySelector<HTMLAnchorElement>('a[href="https://5calls.org"]');
    expect(fiveCallsLink).not.toBeNull();
    expect(fiveCallsLink?.target).toBe('_blank');
    expect(fiveCallsLink?.rel).toContain('noopener');

    const copyBtn = container.querySelector('button[title*="Copy"], button:has(svg)');
    expect(copyBtn).not.toBeNull();
  });
});
