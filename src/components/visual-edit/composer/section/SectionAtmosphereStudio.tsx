'use client';

import type { VisualComposerStyles } from '@/types/unified';
import {
  ColorSwatchPicker,
  StudioInput,
  StudioSection,
  StudioSelect,
  ThemeModeSelector,
} from '../ui';

export interface SectionAtmosphereStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  sectionBgSelectId?: string;
  bgGradientSelectId?: string;
  sectionPatternSelectId?: string;
  sectionOverlaySelectId?: string;
  sectionBgBlendModeSelectId?: string;
  sectionInnerShadowSelectId?: string;
  sectionThemeModeSelectId?: string;
  sectionBgImageInputId?: string;
  sectionVideoUrlInputId?: string;
  sectionBgAttachmentSelectId?: string;
  sectionBgPositionSelectId?: string;
  sectionBgSizeSelectId?: string;
  sectionBgRepeatSelectId?: string;
}

export function SectionAtmosphereStudio({
  styles,
  setStyles,
  sectionBgSelectId,
  bgGradientSelectId,
  sectionPatternSelectId,
  sectionOverlaySelectId,
  sectionBgBlendModeSelectId = 'section-bg-blend-mode',
  sectionInnerShadowSelectId = 'section-inner-shadow',
  sectionThemeModeSelectId = 'section-theme-mode-select',
  sectionBgImageInputId = 'section-bg-image-input',
  sectionVideoUrlInputId = 'section-video-url-input',
  sectionBgAttachmentSelectId,
  sectionBgPositionSelectId,
  sectionBgSizeSelectId,
  sectionBgRepeatSelectId,
}: SectionAtmosphereStudioProps) {
  return (
    <StudioSection
      title="Theme, Atmosphere & Background"
      badge="Tone"
      description="Palettes, gradients, textures, and dark/light mode overrides."
    >
      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={sectionBgSelectId}
          label="Section Background Theme"
          value={styles.section.background}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: {
                ...styles.section,
                background: val,
                bgGradient: '',
                pattern: '',
              },
            })
          }
          options={[
            { value: 'bg-transparent', label: 'Transparent (Default)' },
            { value: 'bg-card text-foreground', label: 'Clean Card Surface' },
            { value: 'bg-slate-950 text-white', label: 'Midnight Slate Surface' },
            { value: 'bg-navy-950 text-white', label: 'Patriotic Navy Deep' },
            { value: 'bg-amber-500/10 text-foreground', label: 'Civic Gold Warmth' },
            {
              value: 'bg-white/10 backdrop-blur-md border border-white/20 text-white',
              label: 'Frost Liquid Glass',
            },
            { value: 'bg-rose-500/10 text-foreground', label: 'Alert Crimson Tint' },
            { value: 'bg-emerald-500/10 text-foreground', label: 'Grassroots Forest Green' },
          ]}
        />
        <ColorSwatchPicker
          label="Quick Canvas Tint"
          value={styles.section.background}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: {
                ...styles.section,
                background: val,
                bgGradient: '',
                pattern: '',
              },
            })
          }
        />
        <ThemeModeSelector
          id={sectionThemeModeSelectId}
          label="Tone Mode Override"
          value={styles.section.themeMode || 'inherit'}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: {
                ...styles.section,
                themeMode: val,
              },
            })
          }
          description="Locks section to light, dark, or system mode regardless of reader OS setting."
        />
      </div>

      <StudioSelect
        id={bgGradientSelectId}
        label="Civic Gradient Background (Optional)"
        value={styles.section.bgGradient}
        onChange={(val) =>
          setStyles({
            ...styles,
            section: { ...styles.section, bgGradient: val, pattern: '' },
          })
        }
        options={[
          { value: '', label: 'None (Use Solid Theme Above)' },
          {
            value: 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white',
            label: 'Patriotic Midnight Navy',
          },
          {
            value:
              'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-foreground',
            label: 'Civic Gold Glow',
          },
          {
            value: 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-black text-white',
            label: 'Alert Crimson Stand',
          },
          {
            value: 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 text-white',
            label: 'Grassroots Forest Emerald',
          },
          {
            value:
              'bg-gradient-to-br from-white/15 via-white/5 to-white/10 backdrop-blur-lg border border-white/20 text-white',
            label: 'Iridescent Liquid Frost Glass',
          },
        ]}
      />

      <StudioSelect
        id={sectionPatternSelectId}
        label="Civic Background Texture & Patterns"
        value={styles.section.pattern}
        onChange={(val) =>
          setStyles({
            ...styles,
            section: { ...styles.section, pattern: val },
          })
        }
        options={[
          { value: '', label: 'None (Solid / Plain)' },
          {
            value:
              'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:24px_24px]',
            label: 'Civic Dot Matrix (24px Grid)',
          },
          {
            value:
              'bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] [background-size:24px_24px]',
            label: 'Architectural Diagonal Hatch',
          },
          {
            value:
              'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-950 to-slate-950 text-white',
            label: 'Radiant Golden Civic Aura',
          },
          {
            value:
              'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900 to-slate-950 text-white',
            label: 'Midnight Deep Blue Mesh',
          },
        ]}
      />

      <StudioSelect
        id={sectionOverlaySelectId}
        label="Section Atmosphere & Overlay Tint"
        value={styles.section.overlay || ''}
        onChange={(val) =>
          setStyles({
            ...styles,
            section: { ...styles.section, overlay: val },
          })
        }
        options={[
          { value: '', label: 'None (Clear Atmosphere)' },
          { value: 'bg-black/40', label: 'Dark Dramatic Vignette (bg-black/40)' },
          { value: 'bg-blue-950/60', label: 'Midnight Navy Cast (bg-blue-950/60)' },
          { value: 'bg-amber-950/25', label: 'Warm Civic Gold Dust (bg-amber-950/25)' },
          {
            value: 'backdrop-blur-sm bg-slate-900/40',
            label: 'Frosted Mist Overlay',
          },
          { value: 'bg-rose-950/30', label: 'Alert Crimson Aura (bg-rose-950/30)' },
        ]}
      />

      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={sectionBgBlendModeSelectId}
          label="Background Blend Mode"
          size="xs"
          value={styles.section.bgBlendMode || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgBlendMode: val },
            })
          }
          options={[
            { value: '', label: 'Normal (Default)' },
            { value: 'bg-blend-multiply', label: 'Multiply' },
            { value: 'bg-blend-screen', label: 'Screen' },
            { value: 'bg-blend-overlay', label: 'Overlay' },
            { value: 'bg-blend-darken', label: 'Darken' },
            { value: 'bg-blend-lighten', label: 'Lighten' },
            { value: 'bg-blend-color-dodge', label: 'Color Dodge' },
            { value: 'bg-blend-soft-light', label: 'Soft Light' },
            { value: 'bg-blend-difference', label: 'Difference' },
            { value: 'bg-blend-luminosity', label: 'Luminosity' },
          ]}
        />
        <StudioSelect
          id={sectionInnerShadowSelectId}
          label="Inner Recessed Shadow"
          size="xs"
          value={styles.section.innerShadow || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, innerShadow: val },
            })
          }
          options={[
            { value: '', label: 'None (Flat Surface)' },
            { value: 'shadow-inner', label: 'Subtle Inset Well (shadow-inner)' },
            {
              value: 'shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)]',
              label: 'Deep Recessed Well',
            },
            {
              value: 'shadow-[inset_0_2px_8px_rgba(245,158,11,0.2)]',
              label: 'Civic Gold Inset Glow',
            },
          ]}
        />
      </div>

      {/* Ambient Video Background Layer */}
      <div className="space-y-1">
        <StudioInput
          id={sectionVideoUrlInputId}
          label="Ambient Background Video (MP4 / WebM)"
          value={styles.section.videoUrl || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, videoUrl: val },
            })
          }
          placeholder="https://.../ambient-bg.mp4"
          description="Plays muted, looping HTML5 background video behind content."
        />
        {styles.section.videoUrl && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
            <span>Video layer active: automatically loops, autoplays, and mutes.</span>
            <button
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, videoUrl: '' },
                })
              }
              className="text-rose-400 hover:text-rose-300 font-bold ml-2 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Custom Background Image URL */}
      <StudioInput
        id={sectionBgImageInputId}
        label="Background Image URL (Pro)"
        value={styles.section.bgImage || ''}
        onChange={(val) =>
          setStyles({
            ...styles,
            section: { ...styles.section, bgImage: val },
          })
        }
        placeholder="https://.../civic-hero.webp or /images/..."
        description="Responsive background image rendered with CSS background-image."
      />

      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={sectionBgAttachmentSelectId}
          label="Background Scroll Behavior"
          size="xs"
          value={styles.section.bgAttachment || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgAttachment: val },
            })
          }
          options={[
            { value: '', label: 'Normal Scroll' },
            { value: 'bg-fixed', label: 'Fixed Scroll Parallax (bg-fixed)' },
          ]}
        />
        <StudioSelect
          id={sectionBgPositionSelectId}
          label="Background Image Fit"
          size="xs"
          value={styles.section.bgPosition || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgPosition: val },
            })
          }
          options={[
            { value: '', label: 'Default Fit' },
            { value: 'bg-cover bg-center', label: 'Cover Center' },
            { value: 'bg-contain bg-center', label: 'Contain Center' },
            { value: 'bg-cover bg-top', label: 'Cover Top' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={sectionBgSizeSelectId}
          label="Background Scale / Size"
          size="xs"
          value={styles.section.bgSize || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgSize: val },
            })
          }
          options={[
            { value: '', label: 'Default Sizing' },
            { value: 'bg-cover', label: 'Cover Canvas (bg-cover)' },
            { value: 'bg-contain', label: 'Contain Proportional (bg-contain)' },
            { value: 'bg-auto', label: 'Original Scale (bg-auto)' },
          ]}
        />
        <StudioSelect
          id={sectionBgRepeatSelectId}
          label="Background Tiling / Repeat"
          size="xs"
          value={styles.section.bgRepeat || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgRepeat: val },
            })
          }
          options={[
            { value: '', label: 'Default (No Repeat)' },
            { value: 'bg-no-repeat', label: 'Single Image (bg-no-repeat)' },
            { value: 'bg-repeat', label: 'Tile Both Axis (bg-repeat)' },
            { value: 'bg-repeat-x', label: 'Horizontal Strip (bg-repeat-x)' },
            { value: 'bg-repeat-y', label: 'Vertical Column (bg-repeat-y)' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
