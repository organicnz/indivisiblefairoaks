// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementInspectorHud } from '@/components/visual-edit/ElementInspectorHud';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ElementInspectorHud', () => {
  let container: HTMLDivElement;
  let root: Root;
  let main: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    main = document.createElement('main');
    document.body.appendChild(main);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    main.remove();
    vi.restoreAllMocks();
  });

  it('renders nothing when disabled', async () => {
    await act(async () => {
      root.render(<ElementInspectorHud enabled={false} inlineActive={false} />);
    });
    expect(container.textContent).toBe('');
  });

  it('renders nothing when inlineActive is true', async () => {
    await act(async () => {
      root.render(<ElementInspectorHud enabled={true} inlineActive={true} />);
    });
    expect(container.textContent).toBe('');
  });

  it('tracks hovered element within main and displays inspector badge', async () => {
    const heading = document.createElement('h1');
    heading.textContent = 'Welcome Activists';
    heading.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 140,
        left: 50,
        right: 450,
        width: 400,
        height: 40,
      }) as DOMRect;
    main.appendChild(heading);

    await act(async () => {
      root.render(<ElementInspectorHud enabled={true} inlineActive={false} />);
    });

    await act(async () => {
      heading.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    });

    // RAF dispatch
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(container.textContent).toContain('h1');
    expect(container.textContent).toContain('400×40');
    expect(container.textContent).toContain('Click to edit');
    expect(container.textContent).toContain('⌘E');

    const statusHud = container.querySelector('[role="status"]');
    expect(statusHud).not.toBeNull();
    expect(statusHud?.getAttribute('aria-label')).toBe('Element Inspector HUD');
  });

  it('displays DataPoint key name when hovering over a data-data-point element', async () => {
    const dp = document.createElement('span');
    dp.setAttribute('data-data-point', 'gallery.hero.headline');
    dp.textContent = 'Democracy In Full View';
    dp.getBoundingClientRect = () =>
      ({
        top: 200,
        bottom: 230,
        left: 40,
        right: 340,
        width: 300,
        height: 30,
      }) as DOMRect;
    main.appendChild(dp);

    await act(async () => {
      root.render(<ElementInspectorHud enabled={true} inlineActive={false} />);
    });

    await act(async () => {
      dp.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(container.textContent).toContain('gallery.hero.headline');
    expect(container.textContent).toContain('300×30');

    const boundingBox = container.querySelector('[data-testid="element-inspector-box"]');
    expect(boundingBox).not.toBeNull();
  });

  it('calculates WCAG contrast ratio for hovered text element', async () => {
    const p = document.createElement('p');
    p.textContent = 'High Contrast Civic Notice';
    p.style.color = 'rgb(0, 0, 0)';
    p.style.backgroundColor = 'rgb(255, 255, 255)';
    p.getBoundingClientRect = () =>
      ({
        top: 150,
        bottom: 180,
        left: 30,
        right: 330,
        width: 300,
        height: 30,
      }) as DOMRect;
    main.appendChild(p);

    await act(async () => {
      root.render(<ElementInspectorHud enabled={true} inlineActive={false} />);
    });

    await act(async () => {
      p.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const contrastBadge = container.querySelector('[data-testid="element-contrast-badge"]');
    expect(contrastBadge).not.toBeNull();
    expect(contrastBadge?.textContent).toContain('AAA');
  });

  it('triggers onOpenStudio callback when clicking the Studio HUD button', async () => {
    const onOpenStudio = vi.fn();
    const heading = document.createElement('h2');
    heading.textContent = 'Pro Visual Customizer';
    heading.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 140,
        left: 50,
        right: 450,
        width: 400,
        height: 40,
      }) as DOMRect;
    main.appendChild(heading);

    await act(async () => {
      root.render(
        <ElementInspectorHud enabled={true} inlineActive={false} onOpenStudio={onOpenStudio} />
      );
    });

    await act(async () => {
      heading.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const studioButton = container.querySelector(
      '[data-testid="hud-open-studio-button"]'
    ) as HTMLButtonElement | null;
    expect(studioButton).not.toBeNull();
    expect(studioButton?.textContent).toContain('Studio');

    await act(async () => {
      studioButton?.click();
    });

    expect(onOpenStudio).toHaveBeenCalledTimes(1);
  });
});
