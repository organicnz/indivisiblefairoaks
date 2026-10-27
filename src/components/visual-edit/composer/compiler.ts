import type {
  VisualComposerBorder,
  VisualComposerEffects,
  VisualComposerMode,
  VisualComposerMotion,
  VisualComposerResponsive,
  VisualComposerSection,
  VisualComposerStyles,
} from '@/types/unified';

/**
 * Builds border utility string based on side, width, style, color, and radius.
 */
export function compileBorderClasses(border: VisualComposerBorder): string {
  const radiusClasses =
    border.radiusLinked === false
      ? [
          border.radiusTopLeft,
          border.radiusTopRight,
          border.radiusBottomRight,
          border.radiusBottomLeft,
        ]
          .filter(Boolean)
          .join(' ')
      : border.radius;

  if (border.width === 'border-0') {
    return border.radiusLinked === false ? radiusClasses : '';
  }

  const sidePrefix =
    border.side === 'top'
      ? border.width.replace('border', 'border-t')
      : border.side === 'bottom'
        ? border.width.replace('border', 'border-b')
        : border.side === 'left'
          ? border.width.replace('border', 'border-l')
          : border.side === 'right'
            ? border.width.replace('border', 'border-r')
            : border.side === 'y'
              ? border.width.replace('border', 'border-y')
              : border.width;
  const styleClass = border.style !== 'none' ? `border-${border.style}` : '';

  return [sidePrefix, styleClass, border.color, radiusClasses].filter(Boolean).join(' ');
}

/**
 * Builds Tailwind classes string for section mode.
 */
export function compileSectionClasses(
  section: VisualComposerSection,
  effects: VisualComposerEffects,
  motion: VisualComposerMotion,
  responsive: VisualComposerResponsive,
  customClasses = ''
): string {
  const rowLayoutClass =
    section.rowLayout === 'full-width-content'
      ? 'w-full max-w-none px-0'
      : section.rowLayout === 'screen-height'
        ? 'min-h-screen flex items-center'
        : section.rowLayout === 'full-width-bg'
          ? 'w-full'
          : '';

  return [
    rowLayoutClass || section.containerWidth,
    section.paddingY,
    section.paddingX !== 'px-4' ? section.paddingX : '',
    section.marginY,
    section.marginX,
    section.minHeight,
    section.pattern || section.bgGradient || section.background,
    section.bgImage?.trim()
      ? section.bgImage.trim().startsWith('url(')
        ? `bg-[${section.bgImage.trim()}]`
        : `bg-[url('${section.bgImage.trim().replace(/['"\s]/g, '')}')]`
      : '',
    section.videoUrl?.trim() ? 'relative overflow-hidden' : '',
    effects.backdropBlur,
    section.overlay,
    section.divider,
    section.topDivider,
    section.bottomDivider,
    section.dividerColor,
    section.overflow,
    section.zIndex,
    section.innerShadow,
    section.bgBlendMode,
    section.equalHeight ? 'items-stretch' : '',
    section.border,
    section.border && section.borderColor ? section.borderColor : '',
    section.bgPosition,
    section.bgAttachment,
    section.bgSize,
    section.bgRepeat,
    section.bgTexture,
    section.columns,
    section.columns ? section.rowGap || section.columnGap : '',
    section.columns ? section.verticalAlign : '',
    section.columns && section.justifyContent ? section.justifyContent : '',
    section.contentWidth,
    section.themeMode === 'dark'
      ? '[data-theme=dark] [color-scheme:dark]'
      : section.themeMode === 'light'
        ? '[data-theme=light] [color-scheme:light]'
        : section.themeMode === 'system'
          ? '[data-theme-mode=system]'
          : '',
    section.reverseMobile ? 'flex flex-col-reverse md:flex-row' : '',
    section.radius !== 'rounded-none' ? section.radius : '',
    section.shadow !== 'shadow-none' ? section.shadow : '',
    section.sticky ? 'sticky top-0 z-40 backdrop-blur-md' : '',
    motion.entrance,
    motion.hover,
    responsive.hideMobile || section.hideMobile ? 'max-sm:hidden' : '',
    responsive.hideTablet || section.hideTablet ? 'sm:max-md:hidden' : '',
    responsive.hideDesktop || section.hideDesktop ? 'md:hidden' : '',
    responsive.hidePrint || section.hidePrint ? 'print:hidden' : '',
    customClasses,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Builds Tailwind classes string for block mode.
 */
export function compileBlockClasses(styles: VisualComposerStyles): string {
  const compiledBorder = compileBorderClasses(styles.border);

  return [
    styles.layout.display,
    styles.layout.display === 'flex' || styles.layout.display === 'inline-flex'
      ? [
          styles.layout.flexDirection,
          styles.layout.justifyContent,
          styles.layout.alignItems,
          styles.layout.flexWrap,
        ]
          .filter(Boolean)
          .join(' ')
      : '',
    styles.layout.position,
    styles.layout.inset,
    styles.layout.top,
    styles.layout.bottom,
    styles.layout.left,
    styles.layout.right,
    styles.layout.zIndex,
    styles.layout.overflow,
    styles.layout.cursor,
    styles.layout.visibility,
    styles.layout.pointerEvents,
    styles.layout.userSelect,
    styles.layout.alignSelf,
    styles.layout.order,
    styles.layout.flexGrow,
    styles.layout.flexShrink,
    styles.layout.aspectRatio,
    styles.layout.objectFit,
    styles.layout.width,
    styles.layout.minWidth,
    styles.layout.maxWidth,
    styles.layout.height,
    styles.layout.minHeight,
    styles.layout.maxHeight,
    styles.layout.columns,
    styles.margin.top,
    styles.margin.bottom,
    styles.margin.left,
    styles.margin.right,
    styles.padding.top,
    styles.padding.bottom,
    styles.padding.left,
    styles.padding.right,
    styles.typography.fontFamily,
    styles.typography.fontSmoothing,
    styles.typography.fontStyle === 'italic' ? 'italic' : '',
    styles.typography.textGradient || styles.typography.color,
    styles.typography.fontSize,
    styles.typography.fontWeight,
    styles.typography.textAlign === 'center'
      ? 'text-center'
      : styles.typography.textAlign === 'right'
        ? 'text-right'
        : styles.typography.textAlign === 'justify'
          ? 'text-justify'
          : 'text-left',
    styles.typography.lineHeight,
    styles.typography.letterSpacing,
    styles.typography.textTransform !== 'none' ? styles.typography.textTransform : '',
    styles.typography.textDecoration,
    styles.typography.textWrap,
    styles.typography.wordBreak,
    styles.typography.textColumns,
    styles.typography.textShadow,
    compiledBorder,
    styles.background.gradient || styles.background.preset,
    styles.effects.backdropBlur || (styles.background.blur ? 'backdrop-blur-md' : ''),
    styles.effects.opacity,
    styles.effects.grayscale,
    styles.effects.brightness,
    styles.effects.contrast,
    styles.effects.saturate,
    styles.effects.sepia,
    styles.effects.hueRotate,
    styles.effects.blur,
    styles.effects.blendMode,
    styles.effects.invert,
    styles.effects.dropShadow,
    styles.effects.shadowColor,
    styles.effects.clipPath,
    styles.effects.hoverBrightness,
    styles.effects.hoverOpacity,
    styles.shadow !== 'shadow-none' ? styles.shadow : '',
    styles.transform?.rotate,
    styles.transform?.scale,
    styles.transform?.skew,
    styles.transform?.translateX,
    styles.transform?.translateY,
    styles.transform?.transformOrigin,
    styles.motion.entrance,
    styles.motion.delay,
    styles.motion.hover,
    styles.motion.hoverScale,
    styles.motion.hoverLift,
    styles.motion.hoverRotate,
    styles.motion.hoverGlow,
    styles.motion.hoverBorder,
    styles.motion.hoverShadow,
    styles.motion.hoverBg,
    styles.motion.hoverTextColor,
    styles.motion.duration,
    styles.motion.timing,
    styles.responsive.hideMobile ? 'max-sm:hidden' : '',
    styles.responsive.hideTablet ? 'sm:max-md:hidden' : '',
    styles.responsive.hideDesktop ? 'md:hidden' : '',
    styles.responsive.hidePrint ? 'print:hidden' : '',
    styles.animation !== 'none' ? styles.animation : '',
    styles.themeMode === 'dark'
      ? '[data-theme=dark] [color-scheme:dark]'
      : styles.themeMode === 'light'
        ? '[data-theme=light] [color-scheme:light]'
        : styles.themeMode === 'system'
          ? '[data-theme-mode=system]'
          : '',
    styles.badgeText?.trim() && !styles.layout.position ? 'relative' : '',
    styles.customClasses,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Compiles decorative corner ribbon or badge HTML for a customized block.
 */
export function compileBadgeHtml(styles: VisualComposerStyles): string {
  if (!styles.badgeText?.trim()) return '';
  const pos = styles.badgePosition === 'top-left' ? 'top-2 left-2' : 'top-2 right-2';
  const tone = styles.badgeTone || 'gold';
  const toneClasses =
    tone === 'navy'
      ? 'bg-sky-950 text-sky-200 border border-sky-400/30'
      : tone === 'emerald'
        ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/30'
        : tone === 'crimson'
          ? 'bg-rose-950 text-rose-200 border border-rose-400/30'
          : tone === 'slate'
            ? 'bg-slate-800 text-slate-300 border border-white/10'
            : 'bg-accent-gold text-ink-strong shadow-sm';

  const position = styles.badgePosition || 'top-right';

  return `<span data-vc-badge data-tone="${tone}" data-pos="${position}" class="pointer-events-none absolute ${pos} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${toneClasses}">${styles.badgeText.trim()}</span>`;
}

/**
 * Universal compiler dispatching based on editor mode.
 */
export function compileClassNames(mode: VisualComposerMode, styles: VisualComposerStyles): string {
  return mode === 'section'
    ? compileSectionClasses(
        styles.section,
        styles.effects,
        styles.motion,
        styles.responsive,
        styles.customClasses
      )
    : compileBlockClasses(styles);
}
