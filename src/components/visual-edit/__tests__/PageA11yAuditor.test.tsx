// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageA11yAuditor } from '@/components/visual-edit/PageA11yAuditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PageA11yAuditor', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const main = document.createElement('main');
    main.innerHTML = `
      <img src="/test.jpg" />
      <span data-data-point="empty.field"></span>
      <button></button>
    `;
    document.body.appendChild(main);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scans DOM and flags missing alt text and missing H1', () => {
    act(() => {
      root.render(<PageA11yAuditor isOpen={true} onClose={() => {}} />);
    });

    expect(document.body.textContent).toContain('Civic A11y & Health Audit');
    expect(document.body.textContent).toContain('Image missing alt attribute');
    expect(document.body.textContent).toContain('Missing H1 heading');
    expect(document.body.textContent).toContain('Unlabeled interactive element');
    expect(document.body.textContent).toContain('Empty DataPoint: "empty.field"');
  });

  it('calculates accessibility score', () => {
    act(() => {
      root.render(<PageA11yAuditor isOpen={true} onClose={() => {}} />);
    });

    // Score should be reduced due to issues
    const scoreBadge = document.querySelector('.font-mono.text-4xl');
    expect(scoreBadge).not.toBeNull();
    const scoreVal = Number.parseInt(scoreBadge?.textContent?.replace('%', '') || '100', 10);
    expect(scoreVal).toBeLessThan(100);
  });
});
