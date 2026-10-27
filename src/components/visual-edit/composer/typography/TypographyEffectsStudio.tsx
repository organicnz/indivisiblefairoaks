'use client';

import { Sparkles, Type } from 'lucide-react';
import type { VisualComposerStyles, VisualComposerTypographyEffectsPreset } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const LETTER_SPACING_OPTIONS = [
  { value: 'tracking-normal', label: 'Normal' },
  { value: 'tracking-wide', label: 'Wide (+0.025em)' },
  { value: 'tracking-wider', label: 'Wider (+0.05em)' },
  { value: 'tracking-tight', label: 'Tight (-0.025em)' },
] as const;

export const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none', label: 'Normal Casing' },
  { value: 'uppercase', label: 'ALL CAPS' },
  { value: 'capitalize', label: 'Capitalize Words' },
  { value: 'lowercase', label: 'all lowercase' },
] as const;

export const TEXT_DECORATION_OPTIONS = [
  { value: '', label: 'None (Standard)' },
  { value: 'underline underline-offset-4 decoration-border', label: 'Subtle Underline' },
  {
    value: 'underline underline-offset-4 decoration-amber-500/60 decoration-2',
    label: 'Civic Gold Underline',
  },
  {
    value: 'underline underline-offset-4 decoration-blue-500/60 decoration-2',
    label: 'Navy Accent Underline',
  },
  { value: 'line-through decoration-rose-500/70', label: 'Strikethrough' },
] as const;

export const TEXT_SHADOW_OPTIONS = [
  { value: '', label: 'None (Crisp Flat)' },
  { value: 'drop-shadow-sm', label: 'Subtle Soft (sm)' },
  { value: 'drop-shadow-md', label: 'High Contrast (md)' },
  { value: 'drop-shadow-lg', label: 'Dramatic Depth (lg)' },
] as const;

export const TYPOGRAPHY_EFFECTS_PRESETS: readonly VisualComposerTypographyEffectsPreset[] = [
  {
    id: 'civic-gold-accent',
    name: 'Civic Gold Accent',
    description: 'Wide tracking, capitalize words, civic gold underline, and subtle soft shadow',
    badge: 'Civic Accent',
    apply: () => ({
      letterSpacing: 'tracking-wide',
      textTransform: 'capitalize',
      textDecoration: 'underline underline-offset-4 decoration-amber-500/60 decoration-2',
      textShadow: 'drop-shadow-sm',
    }),
  },
  {
    id: 'headline-banner',
    name: 'Headline Banner',
    description: 'Tight tracking with ALL CAPS and high contrast depth shadow for impact',
    badge: 'Punchy',
    apply: () => ({
      letterSpacing: 'tracking-tight',
      textTransform: 'uppercase',
      textDecoration: '',
      textShadow: 'drop-shadow-md',
    }),
  },
  {
    id: 'modern-spaced-label',
    name: 'Modern Spaced Label',
    description: 'Wider tracking with ALL CAPS and flat shadow for sophisticated category pills',
    badge: 'Pill Label',
    apply: () => ({
      letterSpacing: 'tracking-wider',
      textTransform: 'uppercase',
      textDecoration: '',
      textShadow: '',
    }),
  },
  {
    id: 'archived-strikethrough',
    name: 'Archived / Retired',
    description: 'Normal tracking with rose strikethrough for deprecated or retired items',
    badge: 'Archived',
    apply: () => ({
      letterSpacing: 'tracking-normal',
      textTransform: 'none',
      textDecoration: 'line-through decoration-rose-500/70',
      textShadow: '',
    }),
  },
  {
    id: 'reset-effects',
    name: 'Reset Effects',
    description: 'Restore normal tracking, default casing, flat shadow, and no underline',
    badge: 'Clean',
    apply: () => ({
      letterSpacing: 'tracking-normal',
      textTransform: 'none',
      textDecoration: '',
      textShadow: '',
    }),
  },
] as const;

export interface TypographyEffectsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  letterSpacingSelectId?: string;
  textTransformSelectId?: string;
  textDecorationSelectId?: string;
  textShadowSelectId?: string;
}

export function TypographyEffectsStudio({
  styles,
  setStyles,
  letterSpacingSelectId,
  textTransformSelectId,
  textDecorationSelectId,
  textShadowSelectId,
}: TypographyEffectsStudioProps) {
  const activeSpacingLabel =
    LETTER_SPACING_OPTIONS.find((o) => o.value === styles.typography.letterSpacing)?.label ||
    'Normal';
  const activeTransformLabel =
    TEXT_TRANSFORM_OPTIONS.find((o) => o.value === styles.typography.textTransform)?.label ||
    'Normal Casing';
  const activeDecorationLabel =
    TEXT_DECORATION_OPTIONS.find((o) => o.value === styles.typography.textDecoration)?.label ||
    'None';
  const activeShadowLabel =
    TEXT_SHADOW_OPTIONS.find((o) => o.value === styles.typography.textShadow)?.label || 'None';

  return (
    <StudioSection title="Letter Spacing, Casing & Accents" badge="Styling">
      <div className="space-y-4">
        {/* Live Effects Sandbox Card */}
        <div
          data-testid="typography-effects-preview-card"
          className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-3 shadow-inner"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Live Effects Sandbox
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Sample Render</span>
          </div>

          <div className="min-h-12 bg-black/20 dark:bg-black/40 rounded-md border border-white/10 p-3 flex items-center justify-center text-center overflow-hidden">
            <p
              data-testid="typography-effects-preview-text"
              className={`text-sm md:text-base font-bold text-foreground transition-all duration-200 ${
                styles.typography.letterSpacing
              } ${styles.typography.textTransform} ${styles.typography.textDecoration || ''} ${
                styles.typography.textShadow || ''
              }`}
            >
              Civic Democracy In Action
            </p>
          </div>

          {/* Active Status Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              <Type className="w-2.5 h-2.5 text-amber-500" />
              {activeSpacingLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              {activeTransformLabel}
            </span>
            {styles.typography.textDecoration && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                {activeDecorationLabel}
              </span>
            )}
            {styles.typography.textShadow && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                {activeShadowLabel}
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Typography Effects Presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              1-Click Effect Presets
            </span>
            <span className="text-[10px] text-slate-400">Curated Styles</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {TYPOGRAPHY_EFFECTS_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`effects-preset-${preset.id}`}
                onClick={() =>
                  setStyles((prev) => ({
                    ...prev,
                    typography: {
                      ...prev.typography,
                      ...preset.apply(),
                    },
                  }))
                }
                className="group p-2 rounded-md border border-border/40 bg-card/40 hover:bg-card hover:border-amber-500/40 text-left transition-all"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-medium text-foreground group-hover:text-accent-gold transition-colors">
                    {preset.name}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Granular Dropdowns */}
        <div>
          <span className="text-[10px] text-slate-400 mb-1 block">Letter Spacing &amp; Casing</span>
          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={letterSpacingSelectId}
              value={styles.typography.letterSpacing}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  typography: { ...styles.typography, letterSpacing: val },
                })
              }
              options={LETTER_SPACING_OPTIONS}
            />
            <StudioSelect
              id={textTransformSelectId}
              value={styles.typography.textTransform}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  typography: {
                    ...styles.typography,
                    textTransform: val as typeof styles.typography.textTransform,
                  },
                })
              }
              options={TEXT_TRANSFORM_OPTIONS}
            />
          </div>
        </div>

        <div>
          <StudioSelect
            id={textDecorationSelectId}
            label="Text Decoration & Accents"
            value={styles.typography.textDecoration || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, textDecoration: val },
              })
            }
            options={TEXT_DECORATION_OPTIONS}
          />
        </div>

        <div>
          <StudioSelect
            id={textShadowSelectId}
            label="Text Drop Shadow"
            value={styles.typography.textShadow}
            onChange={(val) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, textShadow: val },
              })
            }
            options={TEXT_SHADOW_OPTIONS}
          />
        </div>
      </div>
    </StudioSection>
  );
}
