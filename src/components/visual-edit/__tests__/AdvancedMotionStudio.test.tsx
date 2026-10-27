// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdvancedMotionStudio,
  MotionAdvancedStudio,
  MotionEntranceStudio,
  MotionHoverStudio,
  MotionTimingStudio,
} from '@/components/visual-edit/composer/AdvancedMotionStudio';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AdvancedMotionStudio & Sub-Studios', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders MotionEntranceStudio and triggers entrance animation change', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <MotionEntranceStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          motionEntranceSelectId="motion-entrance-select"
          motionDelaySelectId="motion-delay-select"
        />
      );
    });

    expect(container.textContent).toContain('Entrance Dynamics');
    expect(container.textContent).toContain('Entrance Animation');
    expect(container.textContent).toContain('Entrance Stagger Delay');

    const select = container.querySelector('#motion-entrance-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'animate-in fade-in duration-300';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders MotionHoverStudio and triggers hover scale change', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <MotionHoverStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          motionHoverSelectId="motion-hover-select"
          motionHoverScaleSelectId="motion-hover-scale-select"
        />
      );
    });

    expect(container.textContent).toContain('Hover Interaction Preset');
    expect(container.textContent).toContain('Hover Micro-Interactions & Timing');
    expect(container.textContent).toContain('Scale on Hover');

    const select = container.querySelector('#motion-hover-scale-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'hover:scale-105';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders MotionTimingStudio and triggers duration change', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <MotionTimingStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          motionDurationSelectId="motion-duration-select"
          motionTimingSelectId="motion-timing-select"
        />
      );
    });

    expect(container.textContent).toContain('Transition Speed');
    expect(container.textContent).toContain('Animation Easing Curve');

    const select = container.querySelector('#motion-duration-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'transition-all duration-300';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders MotionAdvancedStudio and toggles responsive visibility', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <MotionAdvancedStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          anchorIdInputId="test-anchor-id"
          compiledClassNames="p-4 bg-slate-900"
        />
      );
    });

    expect(container.textContent).toContain('Page Anchor & Linking');
    expect(container.textContent).toContain('Responsive Device Visibility');
    expect(container.textContent).toContain('Generated CSS Class Output');
    expect(container.textContent).toContain('p-4 bg-slate-900');

    // Click on Hide on Mobile toggle
    const toggleButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hide on Mobile')
    );
    expect(toggleButton).toBeDefined();

    act(() => {
      toggleButton?.click();
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders complete composed AdvancedMotionStudio without errors', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <AdvancedMotionStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          anchorIdInputId="composed-anchor-id"
          compiledClassNames="flex items-center text-white"
        />
      );
    });

    expect(container.textContent).toContain('All Motion');
    expect(container.textContent).toContain('Entrance');
    expect(container.textContent).toContain('Hover Effects');
    expect(container.textContent).toContain('Timing & Curves');
    expect(container.textContent).toContain('Anchor & CSS');

    expect(container.textContent).toContain('Motion & Animation Transitions');
    expect(container.textContent).toContain('Entrance Dynamics');
    expect(container.textContent).toContain('Hover Interaction Preset');
    expect(container.textContent).toContain('Page Anchor & Linking');
    expect(container.textContent).toContain('Responsive Device Visibility');
  });

  it('filters controls when activeMotionTab is entrance', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <AdvancedMotionStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          activeMotionTab="entrance"
        />
      );
    });

    expect(container.textContent).toContain('Entrance Dynamics');
    expect(container.textContent).not.toContain('Hover Interaction Preset');
    expect(container.textContent).not.toContain('Page Anchor & Linking');
  });
});
