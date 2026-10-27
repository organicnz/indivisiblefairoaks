// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import {
  SectionAdvancedStudio,
  SectionAtmosphereStudio,
  SectionDividersStudio,
  SectionLayoutStudio,
  SectionPresetsStudio,
} from '@/components/visual-edit/composer/section';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Section Sub-Studios', () => {
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

  describe('SectionPresetsStudio', () => {
    it('renders presets and applies preset on click', async () => {
      let currentStyles = { ...DEFAULT_VC_STYLES };
      const setStyles = vi.fn((update) => {
        currentStyles = typeof update === 'function' ? update(currentStyles) : update;
      });

      await act(async () => {
        root.render(<SectionPresetsStudio styles={currentStyles} setStyles={setStyles} />);
      });

      expect(container.textContent).toContain('1-Click Section Presets');
      expect(container.textContent).toContain('10 Pro Templates');
      expect(container.textContent).toContain('Hero Spotlight');

      const heroBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Hero Spotlight')
      );
      expect(heroBtn).toBeDefined();

      await act(async () => {
        heroBtn?.click();
      });

      expect(setStyles).toHaveBeenCalled();
    });

    it('filters presets by category pills and search input', async () => {
      const setStyles = vi.fn();

      await act(async () => {
        root.render(<SectionPresetsStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
      });

      const metricsPill = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Metrics'
      );
      expect(metricsPill).toBeDefined();

      await act(async () => {
        metricsPill?.click();
      });

      expect(container.textContent).toContain('Civic Impact Metrics Grid');
      expect(container.textContent).not.toContain('Civic Hero Spotlight');

      // Test search
      const input = container.querySelector('input');
      expect(input).not.toBeNull();
      await act(async () => {
        if (input) {
          input.value = 'Spotlight';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
  });

  describe('SectionLayoutStudio', () => {
    it('renders structure, spacing, and multi-column grid', async () => {
      const setStyles = vi.fn();

      await act(async () => {
        root.render(
          <SectionLayoutStudio
            styles={DEFAULT_VC_STYLES}
            setStyles={setStyles}
            sectionRowLayoutSelectId="test-row-layout"
            sectionWidthSelectId="test-width-select"
          />
        );
      });

      expect(container.textContent).toContain('Canvas & Container Structure');
      expect(container.textContent).toContain('Spacing & Geometry');
      expect(container.textContent).toContain('Row Multi-Column Layout');
      expect(container.querySelector('#test-row-layout')).not.toBeNull();
      expect(container.querySelector('#test-width-select')).not.toBeNull();
    });
  });

  describe('SectionAtmosphereStudio', () => {
    it('renders atmospheric tone and overrides with live stage and presets', async () => {
      let currentStyles = { ...DEFAULT_VC_STYLES };
      const setStyles = vi.fn((update) => {
        currentStyles = typeof update === 'function' ? update(currentStyles) : update;
      });

      await act(async () => {
        root.render(
          <SectionAtmosphereStudio
            styles={currentStyles}
            setStyles={setStyles}
            sectionBgSelectId="test-bg-theme"
          />
        );
      });

      expect(container.textContent).toContain('Theme, Atmosphere & Background');
      expect(container.textContent).toContain('Live Atmosphere Stage');
      expect(container.textContent).toContain('1-Click Atmosphere Presets');
      expect(container.textContent).toContain('Section Background Theme');
      expect(container.textContent).toContain('Quick Canvas Tint');
      expect(container.textContent).toContain('Tone Mode Override');
      expect(container.textContent).toContain('Civic Gradient Background');
      expect(container.textContent).toContain('Ambient Background Video');
      expect(container.querySelector('#test-bg-theme')).not.toBeNull();

      expect(
        container.querySelector('[data-testid="section-atmosphere-preview-stage"]')
      ).not.toBeNull();

      // Click 1-Click Preset: Patriotic Midnight Navy
      const navyPresetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Patriotic Midnight Navy')
      );
      expect(navyPresetBtn).toBeDefined();

      await act(async () => {
        navyPresetBtn?.click();
      });

      expect(currentStyles.section.background).toBe('bg-navy-950 text-white');
      expect(currentStyles.section.themeMode).toBe('dark');

      // Click Clean Card Minimal
      const minimalBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clean Card Minimal')
      );
      expect(minimalBtn).toBeDefined();

      await act(async () => {
        minimalBtn?.click();
      });

      expect(currentStyles.section.background).toBe('bg-card text-foreground');
      expect(currentStyles.section.themeMode).toBe('system');
    });
  });

  describe('SectionDividersStudio', () => {
    it('renders borders, shape dividers, live boundary visualizer, and elevation stacking', async () => {
      let currentStyles = { ...DEFAULT_VC_STYLES };
      const setStyles = vi.fn((update) => {
        currentStyles = typeof update === 'function' ? update(currentStyles) : update;
      });

      await act(async () => {
        root.render(
          <SectionDividersStudio
            styles={currentStyles}
            setStyles={setStyles}
            sectionRadiusSelectId="test-radius"
            sectionDividerSelectId="test-divider"
          />
        );
      });

      expect(container.textContent).toContain('Shape Dividers & Boundary Geometry');
      expect(container.textContent).toContain('Live Section Boundary Preview');
      expect(container.textContent).toContain('1-Click Boundary Presets');
      expect(container.textContent).toContain('Borders, Radius & Glassmorphism');
      expect(container.textContent).toContain('Shape Dividers & Cutouts');
      expect(container.textContent).toContain('Clipping & Stacking Elevation');
      expect(container.querySelector('#test-radius')).not.toBeNull();
      expect(container.querySelector('#test-divider')).not.toBeNull();

      // Click a 1-click boundary preset
      const archBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Civic Gold Banner & Arch')
      );
      expect(archBtn).toBeDefined();
      await act(async () => {
        archBtn?.click();
      });
      expect(setStyles).toHaveBeenCalled();

      // Click Reset Boundaries button
      const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Reset Boundaries')
      );
      expect(resetBtn).toBeDefined();
      await act(async () => {
        resetBtn?.click();
      });
      expect(setStyles).toHaveBeenCalled();
    });
  });

  describe('SectionAdvancedStudio', () => {
    it('renders developer attributes and responsive visibility matrix', async () => {
      const setStyles = vi.fn();

      await act(async () => {
        root.render(
          <SectionAdvancedStudio
            styles={DEFAULT_VC_STYLES}
            setStyles={setStyles}
            sectionAnchorIdInputId="test-anchor"
            compiledClassNames="max-w-4xl mx-auto py-8"
          />
        );
      });

      expect(container.textContent).toContain('Developer Attributes & Visibility');
      expect(container.textContent).toContain('Section Anchor ID');
      expect(container.textContent).toContain('Section Custom Classes');
      expect(container.textContent).toContain('Sticky Row');
      expect(container.textContent).toContain('Hide on Print');
      expect(container.textContent).toContain('Hide on Devices');
      expect(container.textContent).toContain('Compiled Classnames Preview');
      expect(container.textContent).toContain('max-w-4xl mx-auto py-8');
      expect(container.querySelector('#test-anchor')).not.toBeNull();
    });
  });
});
