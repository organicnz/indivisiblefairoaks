'use client';

import { ChevronRight, Database, Globe, Layers, LayoutGrid, Type } from 'lucide-react';
import type React from 'react';

export interface BreadcrumbBarProps {
  visible: boolean;
  pageTitle: string;
  pathname: string;
  activeRegionLabel?: string | null;
  activeSectionLabel?: string | null;
  activeTag?: string | null;
  activeDataPointKey?: string | null;
  onFocusSection?: () => void;
  onOpenDataPoints?: () => void;
}

export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  visible,
  pageTitle,
  pathname,
  activeRegionLabel,
  activeSectionLabel,
  activeTag,
  activeDataPointKey,
  onFocusSection,
  onOpenDataPoints,
}) => {
  if (!visible) return null;

  return (
    <nav
      aria-label="DOM element hierarchy breadcrumb"
      data-testid="visual-breadcrumb-bar"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-[90vw] overflow-x-auto no-scrollbar pointer-events-auto"
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/90 px-3 py-1 text-[11px] font-mono text-white shadow-float backdrop-blur-md animate-in fade-in-0 duration-150 whitespace-nowrap">
        {/* Page Crumb */}
        <span className="flex items-center gap-1 text-ink-muted-on-dark font-sans font-semibold">
          <Globe size={11} className="text-accent-gold" />
          <span className="truncate max-w-[120px]">{pageTitle || pathname}</span>
        </span>

        {/* Region Crumb (if applicable) */}
        {activeRegionLabel && (
          <>
            <ChevronRight size={10} className="text-white/30 shrink-0" />
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <Layers size={11} className="text-emerald-400" />
              <span className="truncate max-w-[140px]">{activeRegionLabel}</span>
            </span>
          </>
        )}

        {/* Section Block Crumb */}
        {activeSectionLabel && (
          <>
            <ChevronRight size={10} className="text-white/30 shrink-0" />
            {onFocusSection ? (
              <button
                type="button"
                onClick={onFocusSection}
                className="flex items-center gap-1 text-accent-gold hover:underline cursor-pointer font-bold"
                title="Focus this block section"
              >
                <LayoutGrid size={11} className="text-accent-gold" />
                <span className="truncate max-w-[150px]">{activeSectionLabel}</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 text-accent-gold font-bold">
                <LayoutGrid size={11} className="text-accent-gold" />
                <span className="truncate max-w-[150px]">{activeSectionLabel}</span>
              </span>
            )}
          </>
        )}

        {/* Element Tag Crumb */}
        {activeTag && (
          <>
            <ChevronRight size={10} className="text-white/30 shrink-0" />
            <span className="flex items-center gap-1 text-sky-300 font-bold uppercase">
              <Type size={11} className="text-sky-400" />
              <span>&lt;{activeTag}&gt;</span>
            </span>
          </>
        )}

        {/* DataPoint Key Crumb */}
        {activeDataPointKey && (
          <>
            <ChevronRight size={10} className="text-white/30 shrink-0" />
            {onOpenDataPoints ? (
              <button
                type="button"
                onClick={onOpenDataPoints}
                className="flex items-center gap-1 text-sky-400 hover:underline cursor-pointer font-bold"
                title="Inspect in DataPoints Matrix"
              >
                <Database size={11} className="text-sky-400" />
                <span className="truncate max-w-[160px]">{activeDataPointKey}</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 text-sky-400 font-bold">
                <Database size={11} className="text-sky-400" />
                <span className="truncate max-w-[160px]">{activeDataPointKey}</span>
              </span>
            )}
          </>
        )}
      </div>
    </nav>
  );
};
