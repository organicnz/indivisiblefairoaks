// @vitest-environment jsdom-same-realm

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(container.textContent).toContain('Rep. Ami Bera, M.D.');
    expect(container.textContent).toContain('Sen. Alex Padilla');
    expect(container.textContent).toContain('Sen. Laphonza Butler');
    expect(container.textContent).toContain('Asm. Josh Hoover');
    expect(container.textContent).toContain('Supervisor Rich Desmond');

    const fiveCallsLink = container.querySelector<HTMLAnchorElement>('a[href="https://5calls.org"]');
    expect(fiveCallsLink).not.toBeNull();
    expect(fiveCallsLink?.target).toBe('_blank');
    expect(fiveCallsLink?.rel).toContain('noopener');

    const phoneLink = container.querySelector<HTMLAnchorElement>('a[href="tel:9166350505"]');
    expect(phoneLink).not.toBeNull();
  });

async function searchZip(container: HTMLElement, zip: string) {
  const form = container.querySelector('form');
  const input = container.querySelector<HTMLInputElement>('#repfinder-zip');
  if (!form || !input) throw new Error('Zip form or input not found');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, zip);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

  it('searches for Carmichael (95608) and updates district', async () => {
    await act(async () => {
      root.render(<SacramentoRepresentativeFinder />);
    });

    await searchZip(container, '95608');
    expect(container.textContent).toContain('Carmichael, CA (95608)');
  });

  it('searches for Orangevale (95662) and displays Rep. Kevin Kiley', async () => {
    await act(async () => {
      root.render(<SacramentoRepresentativeFinder />);
    });

    await searchZip(container, '95662');
    expect(container.textContent).toContain('Orangevale, CA (95662)');
    expect(container.textContent).toContain('Rep. Kevin Kiley');
  });

  it('falls back gracefully to Sacramento Region on unknown ZIP', async () => {
    await act(async () => {
      root.render(<SacramentoRepresentativeFinder />);
    });

    await searchZip(container, '99999');
    expect(container.textContent).toContain('Sacramento Region, CA (99999)');
  });

  it('switches call script based on selected issue tab and allows copying', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    await act(async () => {
      root.render(<SacramentoRepresentativeFinder />);
    });

    // Default voting script
    expect(container.textContent).toContain('protect the freedom to vote');

    // Switch to democracy
    const democracyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Democracy')
    );
    await act(async () => {
      democracyBtn?.click();
    });
    expect(container.textContent).toContain('uphold democratic norms');

    // Switch to climate
    const climateBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Climate')
    );
    await act(async () => {
      climateBtn?.click();
    });
    expect(container.textContent).toContain('local clean energy initiatives');

    // Switch back to voting
    const votingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Voting Rights')
    );
    await act(async () => {
      votingBtn?.click();
    });
    expect(container.textContent).toContain('protect the freedom to vote');

    // Copy script
    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy Script')
    );
    await act(async () => {
      copyBtn?.click();
    });
    expect(writeTextMock).toHaveBeenCalled();
  });
});
