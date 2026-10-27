'use client';

import type { VisualComposerStyles } from '@/types/unified';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  FONT_SMOOTHING_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  TEXT_COLUMNS_OPTIONS,
  TEXT_DECORATION_OPTIONS,
  TEXT_GRADIENT_OPTIONS,
  TEXT_SHADOW_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
  TEXT_WRAP_OPTIONS,
  TypographyEditorialStudio,
  TypographyEffectsStudio,
  TypographyPaletteStudio,
  TypographyScaleStudio,
  WORD_BREAK_OPTIONS,
} from './typography';

export {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  FONT_SMOOTHING_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  TEXT_COLUMNS_OPTIONS,
  TEXT_DECORATION_OPTIONS,
  TEXT_GRADIENT_OPTIONS,
  TEXT_SHADOW_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
  TEXT_WRAP_OPTIONS,
  TypographyEditorialStudio,
  TypographyEffectsStudio,
  TypographyPaletteStudio,
  TypographyScaleStudio,
  WORD_BREAK_OPTIONS,
};

export interface TypographyStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  fontFamilySelectId?: string;
  fontSizeSelectId?: string;
  fontWeightSelectId?: string;
  textGradientSelectId?: string;
  lineHeightSelectId?: string;
  letterSpacingSelectId?: string;
  textTransformSelectId?: string;
  textDecorationSelectId?: string;
  textShadowSelectId?: string;
  fontStyleSelectId?: string;
  textWrapSelectId?: string;
  wordBreakSelectId?: string;
  textColumnsSelectId?: string;
  fontSmoothingSelectId?: string;
}

export function TypographyStudio({
  styles,
  setStyles,
  fontFamilySelectId,
  fontSizeSelectId,
  fontWeightSelectId,
  textGradientSelectId,
  lineHeightSelectId,
  letterSpacingSelectId,
  textTransformSelectId,
  textDecorationSelectId,
  textShadowSelectId,
  fontStyleSelectId,
  textWrapSelectId,
  wordBreakSelectId,
  textColumnsSelectId,
  fontSmoothingSelectId,
}: TypographyStudioProps) {
  return (
    <div className="space-y-4">
      {/* 1. Font Family, Scale & Hierarchy */}
      <TypographyScaleStudio
        styles={styles}
        setStyles={setStyles}
        fontFamilySelectId={fontFamilySelectId}
        fontSizeSelectId={fontSizeSelectId}
        fontWeightSelectId={fontWeightSelectId}
        textGradientSelectId={textGradientSelectId}
        lineHeightSelectId={lineHeightSelectId}
      />

      {/* 2. Text Alignment & Color Swatches */}
      <TypographyPaletteStudio styles={styles} setStyles={setStyles} />

      {/* 3. Spacing, Casing & Accents */}
      <TypographyEffectsStudio
        styles={styles}
        setStyles={setStyles}
        letterSpacingSelectId={letterSpacingSelectId}
        textTransformSelectId={textTransformSelectId}
        textDecorationSelectId={textDecorationSelectId}
        textShadowSelectId={textShadowSelectId}
      />

      {/* 4. Advanced Editorial Typography */}
      <TypographyEditorialStudio
        styles={styles}
        setStyles={setStyles}
        fontStyleSelectId={fontStyleSelectId}
        textWrapSelectId={textWrapSelectId}
        wordBreakSelectId={wordBreakSelectId}
        textColumnsSelectId={textColumnsSelectId}
        fontSmoothingSelectId={fontSmoothingSelectId}
      />
    </div>
  );
}
