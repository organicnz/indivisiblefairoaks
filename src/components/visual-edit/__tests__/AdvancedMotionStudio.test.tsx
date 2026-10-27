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

  it('renders MotionEntranceStudio and triggers entrance animation change, replay and presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <MotionEntranceStudio
          styles={currentStyles}
          setStyles={setStyles}
          motionEntranceSelectId="motion-entrance-select"
          motionDelaySelectId="motion-delay-select"
        />
      );
    });

    expect(container.textContent).toContain('Live Entrance Stage');
    expect(container.textContent).toContain('1-Click Entrance Presets');
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

    // Replay motion button
    const replayBtn = container.querySelector(
      '[data-testid="replay-motion-button"]'
    ) as HTMLButtonElement;
    expect(replayBtn).not.toBeNull();
    await act(async () => {
      replayBtn.click();
    });

    // 1-Click Preset: Dynamic Slide Up
    const slideUpBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Dynamic Slide Up')
    );
    expect(slideUpBtn).toBeDefined();
    await act(async () => {
      slideUpBtn?.click();
    });

    expect(currentStyles.motion.entrance).toContain('slide-in-from-bottom-4');
    expect(currentStyles.motion.delay).toBe('delay-150');
  });

  it('renders MotionHoverStudio and triggers hover scale change and hover presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <MotionHoverStudio
          styles={currentStyles}
          setStyles={setStyles}
          motionHoverSelectId="motion-hover-select"
          motionHoverScaleSelectId="motion-hover-scale-select"
        />
      );
    });

    expect(container.textContent).toContain('Live Hover Dynamics Playground');
    expect(container.textContent).toContain('1-Click Hover Presets');
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
    expect(currentStyles.motion.hoverScale).toBe('hover:scale-105');

    // 1-Click Preset: Float Card Up
    const floatBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Float Card Up')
    );
    expect(floatBtn).toBeDefined();

    await act(async () => {
      floatBtn?.click();
    });

    expect(currentStyles.motion.hoverLift).toBe('hover:-translate-y-1');
    expect(currentStyles.motion.hoverShadow).toBe('hover:shadow-xl');

    // Reset Hover
    const resetHoverBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Hover')
    );
    expect(resetHoverBtn).toBeDefined();

    await act(async () => {
      resetHoverBtn?.click();
    });

    expect(currentStyles.motion.hoverLift).toBe('');
    expect(currentStyles.motion.hoverShadow).toBe('');
  });

  it('renders MotionTimingStudio and triggers duration change and timing presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <MotionTimingStudio
          styles={currentStyles}
          setStyles={setStyles}
          motionDurationSelectId="motion-duration-select"
          motionTimingSelectId="motion-timing-select"
        />
      );
    });

    expect(container.textContent).toContain('Transition Physics Stage');
    expect(container.textContent).toContain('1-Click Timing Curves');
    expect(container.textContent).toContain('Transition Speed');
    expect(container.textContent).toContain('Animation Easing Curve');

    // Test Glider Button Click
    const testBtn = container.querySelector(
      '[data-testid="motion-timing-test-btn"]'
    ) as HTMLButtonElement;
    expect(testBtn).not.toBeNull();

    await act(async () => {
      testBtn.click();
    });

    expect(container.querySelector('[data-testid="motion-timing-glider"]')).not.toBeNull();

    const select = container.querySelector('#motion-duration-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'transition-all duration-300';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.motion.duration).toBe('transition-all duration-300');

    // Click 1-Click Preset: Snappy Decel
    const snappyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Snappy Decel')
    );
    expect(snappyBtn).toBeDefined();

    await act(async () => {
      snappyBtn?.click();
    });

    expect(currentStyles.motion.duration).toBe('transition-all duration-150');
    expect(currentStyles.motion.timing).toBe('ease-out');

    // Click Reset Timing
    const resetTimingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Timing')
    );
    expect(resetTimingBtn).toBeDefined();

    await act(async () => {
      resetTimingBtn?.click();
    });

    expect(currentStyles.motion.duration).toBe('');
    expect(currentStyles.motion.timing).toBe('');
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
