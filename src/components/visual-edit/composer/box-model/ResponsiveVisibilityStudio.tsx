'use client';

import { Eye } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioToggle } from '../ui';

export interface ResponsiveVisibilityStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
}

export function ResponsiveVisibilityStudio({ styles, setStyles }: ResponsiveVisibilityStudioProps) {
  return (
    <StudioSection
      title="Responsive Device Visibility"
      badge="Breakpoints"
      description="Selectively show or hide this block element on mobile phones, tablets, desktop screens, or print viewports."
      action={<Eye size={13} className="text-accent-gold" />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StudioToggle
          active={Boolean(styles.responsive.hideMobile)}
          onToggle={() =>
            setStyles({
              ...styles,
              responsive: {
                ...styles.responsive,
                hideMobile: !styles.responsive.hideMobile,
              },
            })
          }
          label="Hide Mobile"
          statusLabel={styles.responsive.hideMobile ? 'HIDDEN' : 'VISIBLE'}
          description="Hidden under 640px"
        />
        <StudioToggle
          active={Boolean(styles.responsive.hideTablet)}
          onToggle={() =>
            setStyles({
              ...styles,
              responsive: {
                ...styles.responsive,
                hideTablet: !styles.responsive.hideTablet,
              },
            })
          }
          label="Hide Tablet"
          statusLabel={styles.responsive.hideTablet ? 'HIDDEN' : 'VISIBLE'}
          description="Hidden 640px - 768px"
        />
        <StudioToggle
          active={Boolean(styles.responsive.hideDesktop)}
          onToggle={() =>
            setStyles({
              ...styles,
              responsive: {
                ...styles.responsive,
                hideDesktop: !styles.responsive.hideDesktop,
              },
            })
          }
          label="Hide Desktop"
          statusLabel={styles.responsive.hideDesktop ? 'HIDDEN' : 'VISIBLE'}
          description="Hidden above 768px"
        />
        <StudioToggle
          active={Boolean(styles.responsive.hidePrint)}
          onToggle={() =>
            setStyles({
              ...styles,
              responsive: {
                ...styles.responsive,
                hidePrint: !styles.responsive.hidePrint,
              },
            })
          }
          label="Hide on Print"
          statusLabel={styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
          description="Suppressed in printouts"
        />
      </div>
    </StudioSection>
  );
}
