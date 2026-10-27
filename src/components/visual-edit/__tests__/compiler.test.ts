// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  compileBadgeHtml,
  compileBlockClasses,
  compileBorderClasses,
  compileClassNames,
  compileSectionClasses,
} from '@/components/visual-edit/composer/compiler';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';

describe('Visual Composer Compiler Suite', () => {
  describe('compileBorderClasses', () => {
    it('returns linked radius when width is border-0', () => {
      const result = compileBorderClasses({
        side: 'all',
        width: 'border-0',
        style: 'solid',
        color: 'border-border',
        radius: 'rounded-xl',
        radiusLinked: true,
      });
      expect(result).toBe('');
    });

    it('returns unlinked radii when width is border-0', () => {
      const result = compileBorderClasses({
        side: 'all',
        width: 'border-0',
        style: 'solid',
        color: 'border-border',
        radius: 'rounded-none',
        radiusLinked: false,
        radiusTopLeft: 'rounded-tl-2xl',
        radiusTopRight: 'rounded-tr-none',
        radiusBottomRight: 'rounded-br-2xl',
        radiusBottomLeft: 'rounded-bl-none',
      });
      expect(result).toBe('rounded-tl-2xl rounded-tr-none rounded-br-2xl rounded-bl-none');
    });

    it('compiles directional side borders with color and radius', () => {
      const topBorder = compileBorderClasses({
        side: 'top',
        width: 'border-2',
        style: 'solid',
        color: 'border-amber-500',
        radius: 'rounded-t-2xl',
      });
      expect(topBorder).toBe('border-t-2 border-solid border-amber-500 rounded-t-2xl');

      const yBorder = compileBorderClasses({
        side: 'y',
        width: 'border-4',
        style: 'dashed',
        color: 'border-blue-900',
        radius: 'rounded-lg',
      });
      expect(yBorder).toBe('border-y-4 border-dashed border-blue-900 rounded-lg');
    });
  });

  describe('compileSectionClasses', () => {
    it('compiles standard section layout classes', () => {
      const classes = compileSectionClasses(
        DEFAULT_VC_STYLES.section,
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(classes).toContain('max-w-4xl mx-auto px-4');
      expect(classes).toContain('py-8');
      expect(classes).toContain('bg-transparent');
    });

    it('compiles row canvas layouts: screen-height and full-width-content', () => {
      const screenHeight = compileSectionClasses(
        { ...DEFAULT_VC_STYLES.section, rowLayout: 'screen-height' },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(screenHeight).toContain('min-h-screen flex items-center');

      const fullWidth = compileSectionClasses(
        { ...DEFAULT_VC_STYLES.section, rowLayout: 'full-width-content' },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(fullWidth).toContain('w-full max-w-none px-0');
    });

    it('compiles ambient video background with relative overflow-hidden', () => {
      const videoClasses = compileSectionClasses(
        {
          ...DEFAULT_VC_STYLES.section,
          videoUrl: 'https://cdn.example.com/ambient-loop.mp4',
        },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(videoClasses).toContain('relative overflow-hidden');
    });

    it('compiles themeMode overrides into section class outputs', () => {
      const darkSection = compileSectionClasses(
        { ...DEFAULT_VC_STYLES.section, themeMode: 'dark' },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(darkSection).toContain('[data-theme=dark] [color-scheme:dark]');

      const lightSection = compileSectionClasses(
        { ...DEFAULT_VC_STYLES.section, themeMode: 'light' },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(lightSection).toContain('[data-theme=light] [color-scheme:light]');

      const systemSection = compileSectionClasses(
        { ...DEFAULT_VC_STYLES.section, themeMode: 'system' },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(systemSection).toContain('[data-theme-mode=system]');
    });

    it('compiles responsive device visibility on section', () => {
      const hiddenSection = compileSectionClasses(
        {
          ...DEFAULT_VC_STYLES.section,
          hideMobile: true,
          hideTablet: true,
          hideDesktop: true,
          hidePrint: true,
        },
        DEFAULT_VC_STYLES.effects,
        DEFAULT_VC_STYLES.motion,
        DEFAULT_VC_STYLES.responsive
      );
      expect(hiddenSection).toContain('max-sm:hidden');
      expect(hiddenSection).toContain('sm:max-md:hidden');
      expect(hiddenSection).toContain('md:hidden');
      expect(hiddenSection).toContain('print:hidden');
    });
  });

  describe('compileBlockClasses', () => {
    it('compiles block background media image, overlay, and positioning', () => {
      const stylesWithBg = {
        ...DEFAULT_VC_STYLES,
        background: {
          ...DEFAULT_VC_STYLES.background,
          image: 'https://example.com/card-bg.jpg',
          overlay: 'bg-black/60',
          position: 'bg-center',
          size: 'bg-cover',
          repeat: 'bg-no-repeat',
        },
      };

      const compiled = compileBlockClasses(stylesWithBg);
      expect(compiled).toContain("bg-[url('https://example.com/card-bg.jpg')]");
      expect(compiled).toContain('relative overflow-hidden');
      expect(compiled).toContain('bg-black/60');
      expect(compiled).toContain('bg-center');
      expect(compiled).toContain('bg-cover');
      expect(compiled).toContain('bg-no-repeat');
    });

    it('compiles themeMode overrides into block class outputs', () => {
      const darkBlock = compileBlockClasses({
        ...DEFAULT_VC_STYLES,
        themeMode: 'dark',
      });
      expect(darkBlock).toContain('[data-theme=dark] [color-scheme:dark]');

      const lightBlock = compileBlockClasses({
        ...DEFAULT_VC_STYLES,
        themeMode: 'light',
      });
      expect(lightBlock).toContain('[data-theme=light] [color-scheme:light]');

      const systemBlock = compileBlockClasses({
        ...DEFAULT_VC_STYLES,
        themeMode: 'system',
      });
      expect(systemBlock).toContain('[data-theme-mode=system]');
    });

    it('compiles flex container flow, justify, align, and wrap', () => {
      const flexBlock = compileBlockClasses({
        ...DEFAULT_VC_STYLES,
        layout: {
          ...DEFAULT_VC_STYLES.layout,
          display: 'flex',
          flexDirection: 'flex-col',
          justifyContent: 'justify-between',
          alignItems: 'items-center',
          flexWrap: 'flex-wrap',
        },
      });
      expect(flexBlock).toContain('flex');
      expect(flexBlock).toContain('flex-col');
      expect(flexBlock).toContain('justify-between');
      expect(flexBlock).toContain('items-center');
      expect(flexBlock).toContain('flex-wrap');
    });

    it('compiles fine-grained optical filters and shadow aura glow', () => {
      const filteredBlock = compileBlockClasses({
        ...DEFAULT_VC_STYLES,
        effects: {
          ...DEFAULT_VC_STYLES.effects,
          opacity: 'opacity-90',
          grayscale: 'grayscale',
          brightness: 'brightness-110',
          shadowColor: 'shadow-amber-500/20',
          clipPath: '[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]',
        },
        shadow: 'shadow-xl',
      });
      expect(filteredBlock).toContain('opacity-90');
      expect(filteredBlock).toContain('grayscale');
      expect(filteredBlock).toContain('brightness-110');
      expect(filteredBlock).toContain('shadow-amber-500/20');
      expect(filteredBlock).toContain('[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]');
      expect(filteredBlock).toContain('shadow-xl');
    });
  });

  describe('compileBadgeHtml', () => {
    it('returns empty string when no badgeText is defined', () => {
      expect(compileBadgeHtml(DEFAULT_VC_STYLES)).toBe('');
    });

    it('compiles decorative badge ribbon HTML with position and tone', () => {
      const badgeHtml = compileBadgeHtml({
        ...DEFAULT_VC_STYLES,
        badgeText: 'FEATURED ACTION',
        badgeTone: 'emerald',
        badgePosition: 'top-left',
      });
      expect(badgeHtml).toContain('data-vc-badge');
      expect(badgeHtml).toContain('data-tone="emerald"');
      expect(badgeHtml).toContain('data-pos="top-left"');
      expect(badgeHtml).toContain('top-2 left-2');
      expect(badgeHtml).toContain('FEATURED ACTION');
    });
  });

  describe('compileClassNames universal dispatcher', () => {
    it('dispatches to section and block compilers accurately', () => {
      const sectionClasses = compileClassNames('section', DEFAULT_VC_STYLES);
      expect(sectionClasses).toContain('max-w-4xl mx-auto px-4');

      const blockClasses = compileClassNames('block', DEFAULT_VC_STYLES);
      expect(blockClasses).toContain('my-2');
      expect(blockClasses).toContain('p-4');
    });
  });
});
