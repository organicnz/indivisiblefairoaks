'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioInput, StudioSection, StudioToggle } from '../ui';

export interface MotionAdvancedStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  anchorIdInputId?: string;
  compiledClassNames?: string;
}

export function MotionAdvancedStudio({
  styles,
  setStyles,
  anchorIdInputId,
  compiledClassNames,
}: MotionAdvancedStudioProps) {
  return (
    <>
      {/* 1. HTML Anchor ID Target */}
      {anchorIdInputId && (
        <StudioSection title="Page Anchor & Linking" badge="Deep Link">
          <StudioInput
            id={anchorIdInputId}
            label="HTML Anchor ID (Section Target)"
            value={styles.anchorId}
            onChange={(val) =>
              setStyles({
                ...styles,
                anchorId: val.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
              })
            }
            placeholder="e.g. rally-info, volunteer-form"
            description="Allows links like #rally-info to jump directly to this block."
          />
        </StudioSection>
      )}

      {/* 2. Device Visibility Matrix */}
      <StudioSection title="Responsive Device Visibility" badge="Matrix">
        <div>
          <span className="block text-slate-300 font-bold mb-2">Device Visibility</span>
          <div className="space-y-1.5">
            {[
              {
                key: 'hideMobile' as const,
                label: 'Hide on Mobile (<640px)',
                active: styles.responsive.hideMobile,
              },
              {
                key: 'hideTablet' as const,
                label: 'Hide on Tablet (640-768px)',
                active: styles.responsive.hideTablet,
              },
              {
                key: 'hideDesktop' as const,
                label: 'Hide on Desktop (>768px)',
                active: styles.responsive.hideDesktop,
              },
              {
                key: 'hidePrint' as const,
                label: 'Hide on Print / Paper Export',
                active: styles.responsive.hidePrint,
              },
            ].map((item) => (
              <StudioToggle
                key={item.key}
                label={item.label}
                active={item.active}
                activeTone="rose"
                onToggle={() =>
                  setStyles({
                    ...styles,
                    responsive: {
                      ...styles.responsive,
                      [item.key]: !styles.responsive[item.key],
                    },
                  })
                }
                icon={
                  item.active ? (
                    <EyeOff size={13} className="text-rose-300" />
                  ) : (
                    <Eye size={13} className="text-slate-400" />
                  )
                }
              />
            ))}
          </div>
        </div>
      </StudioSection>

      {/* 3. Generated CSS Classes Preview */}
      {compiledClassNames !== undefined && (
        <StudioSection title="Generated CSS Class Output" badge="Classes">
          <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Compiled Classnames Preview
            </span>
            <p className="font-mono text-[10px] text-accent-gold break-all">
              {compiledClassNames || '(default block styles)'}
            </p>
          </div>
        </StudioSection>
      )}
    </>
  );
}
