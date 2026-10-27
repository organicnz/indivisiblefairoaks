'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioInput, StudioSection, StudioToggle } from '../ui';

export interface SectionAdvancedStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  sectionAnchorIdInputId?: string;
  sectionCustomClassesInputId?: string;
  sectionCustomStyleInputId?: string;
  compiledClassNames?: string;
}

export function SectionAdvancedStudio({
  styles,
  setStyles,
  sectionAnchorIdInputId,
  sectionCustomClassesInputId,
  sectionCustomStyleInputId = 'section-custom-style-input',
  compiledClassNames,
}: SectionAdvancedStudioProps) {
  return (
    <StudioSection
      title="Developer Attributes & Visibility"
      badge="Advanced"
      description="HTML anchor IDs, extra custom Tailwind classes, and device display controls."
    >
      <div className="grid grid-cols-2 gap-2">
        <StudioInput
          id={sectionAnchorIdInputId}
          label="Section Anchor ID"
          prefix="#"
          value={styles.anchorId}
          onChange={(val) =>
            setStyles({
              ...styles,
              anchorId: val.replace(/[^a-zA-Z0-9_-]/g, ''),
            })
          }
          placeholder="speakers, rsvp"
        />
        <StudioInput
          id={sectionCustomClassesInputId}
          label="Section Custom Classes"
          value={styles.customClasses}
          onChange={(val) => setStyles({ ...styles, customClasses: val })}
          placeholder="border-t border-white/10"
        />
      </div>

      <div>
        <label htmlFor={sectionCustomStyleInputId} className="block text-slate-300 font-bold mb-1">
          Section Custom Inline CSS (style="...")
        </label>
        <input
          id={sectionCustomStyleInputId}
          type="text"
          value={styles.customStyle || ''}
          onChange={(e) => setStyles({ ...styles, customStyle: e.target.value })}
          placeholder="e.g. min-height: 480px; background-attachment: fixed;"
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Custom inline CSS rules applied directly to the outer row / section container.
        </p>
      </div>

      {/* Sticky Row Pinning & Print Visibility */}
      <div className="grid grid-cols-2 gap-2">
        <StudioToggle
          label="Sticky Row"
          description="Pin to top on scroll"
          active={Boolean(styles.section.sticky)}
          statusLabel={styles.section.sticky ? 'ON' : 'OFF'}
          onToggle={() =>
            setStyles({
              ...styles,
              section: { ...styles.section, sticky: !styles.section.sticky },
            })
          }
        />
        <StudioToggle
          label="Hide on Print"
          description="Exclude from print"
          active={Boolean(styles.responsive.hidePrint)}
          activeTone="rose"
          statusLabel={styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
          onToggle={() =>
            setStyles({
              ...styles,
              responsive: { ...styles.responsive, hidePrint: !styles.responsive.hidePrint },
            })
          }
        />
      </div>

      {/* Section Responsive Device Visibility */}
      <div>
        <span className="block text-slate-400 text-[10px] mb-1.5 font-medium">Hide on Devices</span>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            {
              key: 'hideMobile' as const,
              label: 'Mobile',
              active: styles.responsive.hideMobile,
            },
            {
              key: 'hideTablet' as const,
              label: 'Tablet',
              active: styles.responsive.hideTablet,
            },
            {
              key: 'hideDesktop' as const,
              label: 'Desktop',
              active: styles.responsive.hideDesktop,
            },
          ].map((item) => (
            <StudioToggle
              key={item.key}
              label={item.label}
              active={Boolean(item.active)}
              activeTone="rose"
              icon={
                item.active ? (
                  <EyeOff size={12} className="text-rose-300" />
                ) : (
                  <Eye size={12} className="text-slate-400" />
                )
              }
              onToggle={() =>
                setStyles({
                  ...styles,
                  responsive: {
                    ...styles.responsive,
                    [item.key]: !styles.responsive[item.key],
                  },
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Generated CSS Classes Preview */}
      {compiledClassNames !== undefined && (
        <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Compiled Classnames Preview
          </span>
          <p className="font-mono text-[10px] text-accent-gold break-all">
            {compiledClassNames || '(default section styles)'}
          </p>
        </div>
      )}
    </StudioSection>
  );
}
