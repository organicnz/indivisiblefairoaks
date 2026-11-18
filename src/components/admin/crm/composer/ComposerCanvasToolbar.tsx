'use client';

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FolderOpen,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from 'lucide-react';

interface ReadingStats {
  words: number;
  readingMinutes: number;
}

interface ComposerCanvasToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  blockCount: number;
  readingStats: ReadingStats;
  canvasViewport: 'full' | 'standard' | 'mobile';
  onCanvasViewportChange: (viewport: 'full' | 'standard' | 'mobile') => void;
  onBrowseMedia: () => void;
  allPreviewing: boolean;
  onToggleAllPreviews: () => void;
  allCollapsed: boolean;
  onToggleAllCollapse: () => void;
}

export function ComposerCanvasToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  blockCount,
  readingStats,
  canvasViewport,
  onCanvasViewportChange,
  onBrowseMedia,
  allPreviewing,
  onToggleAllPreviews,
  allCollapsed,
  onToggleAllCollapse,
}: ComposerCanvasToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 bg-surface-muted border border-border rounded-2xl">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          aria-label="Undo block edit"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-foreground hover:bg-surface-card hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <Undo2 size={13} />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo block edit"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-foreground hover:bg-surface-card hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <Redo2 size={13} />
          <span>Redo</span>
        </button>
        <span className="text-[11px] font-mono text-muted-foreground pl-1">
          {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground bg-surface-card px-2 py-0.5 rounded-md border border-border">
          {readingStats.words}w · ~{readingStats.readingMinutes}m read
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Email Viewport Simulation Frame Switcher */}
        <fieldset className="inline-flex items-center rounded-lg border border-border bg-surface-card p-0.5 shadow-2xs">
          <legend className="sr-only">Canvas preview framing</legend>
          <button
            type="button"
            onClick={() => onCanvasViewportChange('full')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
              canvasViewport === 'full'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Full width layout"
            aria-label="Full width canvas"
          >
            <Monitor size={12} />
            <span className="hidden sm:inline">100%</span>
          </button>
          <button
            type="button"
            onClick={() => onCanvasViewportChange('standard')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
              canvasViewport === 'standard'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Standard email width (600px)"
            aria-label="Standard email canvas"
          >
            <Tablet size={12} />
            <span className="hidden sm:inline">600px</span>
          </button>
          <button
            type="button"
            onClick={() => onCanvasViewportChange('mobile')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
              canvasViewport === 'mobile'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Mobile phone email width (375px)"
            aria-label="Mobile phone canvas"
          >
            <Smartphone size={12} />
            <span className="hidden sm:inline">375px</span>
          </button>
        </fieldset>

        <button
          type="button"
          onClick={onBrowseMedia}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-foreground bg-surface-card border border-border hover:bg-surface-muted transition-colors shadow-2xs"
          title="Browse Supabase S3 Media Library"
          aria-label="Browse Supabase S3 Media Library"
        >
          <FolderOpen size={13} className="text-primary dark:text-primary-on-dark" />
          <span className="hidden md:inline">Supabase Media</span>
        </button>
        <button
          type="button"
          onClick={onToggleAllPreviews}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground bg-surface-card border border-border hover:bg-surface-muted transition-colors shadow-2xs"
        >
          {allPreviewing ? (
            <>
              <EyeOff size={13} className="text-muted-foreground" />
              <span className="hidden sm:inline">Form View All</span>
            </>
          ) : (
            <>
              <Eye size={13} className="text-primary dark:text-primary-on-dark" />
              <span className="hidden sm:inline">Live Preview All</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleAllCollapse}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground bg-surface-card border border-border hover:bg-surface-muted transition-colors shadow-2xs"
        >
          {allCollapsed ? (
            <>
              <ChevronDown size={13} />
              <span className="hidden sm:inline">Expand All</span>
            </>
          ) : (
            <>
              <ChevronUp size={13} />
              <span className="hidden sm:inline">Collapse All</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
