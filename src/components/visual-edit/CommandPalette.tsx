'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Activity,
  ArrowRight,
  Code,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  ListTree,
  Monitor,
  Moon,
  PenLine,
  Redo2,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Type,
  Undo2,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Block } from '@/lib/blocks';
import type { VisualSection } from '@/lib/visual-sections';
import type { ViewportMode } from './VisualEditOverlay';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: VisualSection[];
  onSelectSection: (blockIndex: number) => void;
  onAddNewBlock: (type: Block['type']) => void;
  onSave: () => void;
  canSave: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  viewportMode: ViewportMode;
  onSetViewportMode: (mode: ViewportMode) => void;
  onRotateOrientation: () => void;
  deviceOrientation: 'portrait' | 'landscape';
  themeMode: 'light' | 'dark' | 'system';
  onCycleTheme: () => void;
  showBadges: boolean;
  onToggleBadges: () => void;
  showFrames: boolean;
  onToggleFrames: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  onOpenMedia: () => void;
  onOpenSettings: () => void;
  onOpenRevisions: () => void;
  onOpenCrm: (tab?: 'constituents' | 'events' | 'news' | 'links') => void;
  onOpenShortcuts: () => void;
  onOpenDiagnostics: () => void;
  onOpenDataPoints?: () => void;
  onOpenA11yAuditor?: () => void;
  onOpenDiff?: () => void;
  onOpenVisualComposer?: () => void;
  onOpenBlockLibrary?: () => void;
  onOpenNavigator?: () => void;
  onExportJson: () => void;
  onExit: () => void;
}

interface CommandItem {
  id: string;
  category: 'Actions' | 'Sections' | 'Data Points' | 'Add Block' | 'Viewports';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  sections,
  onSelectSection,
  onAddNewBlock,
  onSave,
  canSave,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  viewportMode,
  onSetViewportMode,
  onRotateOrientation,
  deviceOrientation,
  themeMode,
  onCycleTheme,
  showBadges,
  onToggleBadges,
  showFrames,
  onToggleFrames,
  showInspector,
  onToggleInspector,
  onOpenMedia,
  onOpenSettings,
  onOpenRevisions,
  onOpenCrm,
  onOpenShortcuts,
  onOpenDiagnostics,
  onOpenDataPoints,
  onOpenA11yAuditor,
  onOpenDiff,
  onOpenVisualComposer,
  onOpenBlockLibrary,
  onOpenNavigator,
  onExportJson,
  onExit,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Scan for live DataPoints in DOM
  const [liveDataPoints, setLiveDataPoints] = useState<Array<{ name: string; preview: string }>>(
    []
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    const points: Array<{ name: string; preview: string }> = [];
    const elements = document.querySelectorAll<HTMLElement>('[data-data-point]');
    const seen = new Set<string>();
    for (const el of Array.from(elements)) {
      const name = el.getAttribute('data-data-point');
      if (name && !seen.has(name)) {
        seen.add(name);
        const text = el.textContent?.trim().slice(0, 48) || '';
        points.push({ name, preview: text });
      }
    }
    setLiveDataPoints(points);
  }, [open]);

  // Build command catalogue
  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // Core Actions
    list.push({
      id: 'save',
      category: 'Actions',
      title: 'Save to Supabase Database',
      subtitle: canSave ? 'Commit all pending changes' : 'All changes saved',
      shortcut: '⌘S',
      icon: <Sparkles size={16} className="text-accent-gold" />,
      run: () => {
        onSave();
        onOpenChange(false);
      },
    });

    if (canUndo) {
      list.push({
        id: 'undo',
        category: 'Actions',
        title: 'Undo Edit',
        shortcut: '⌘Z',
        icon: <Undo2 size={16} className="text-sky-400" />,
        run: () => {
          onUndo();
          onOpenChange(false);
        },
      });
    }

    if (canRedo) {
      list.push({
        id: 'redo',
        category: 'Actions',
        title: 'Redo Edit',
        shortcut: '⌘⇧Z',
        icon: <Redo2 size={16} className="text-sky-400" />,
        run: () => {
          onRedo();
          onOpenChange(false);
        },
      });
    }

    list.push(
      {
        id: 'toggle-inspector',
        category: 'Actions',
        title: `Inspector HUD: ${showInspector ? 'Disable' : 'Enable'}`,
        subtitle: 'Live element hover badge with tag, size & key info',
        shortcut: '⌘I',
        icon: <Eye size={16} className="text-emerald-400" />,
        run: () => {
          onToggleInspector();
          onOpenChange(false);
        },
      },
      {
        id: 'toggle-badges',
        category: 'Actions',
        title: `In-Page Section Badges: ${showBadges ? 'Hide' : 'Show'}`,
        subtitle: 'Pills marking editable content boundaries',
        icon: <Layers size={16} className="text-accent-gold" />,
        run: () => {
          onToggleBadges();
          onOpenChange(false);
        },
      },
      {
        id: 'toggle-frames',
        category: 'Actions',
        title: `Section Outlines: ${showFrames ? 'Hide' : 'Show'}`,
        subtitle: 'Dashed frame borders around sections',
        icon: showFrames ? (
          <EyeOff size={16} className="text-slate-400" />
        ) : (
          <Eye size={16} className="text-slate-400" />
        ),
        run: () => {
          onToggleFrames();
          onOpenChange(false);
        },
      },
      {
        id: 'cycle-theme',
        category: 'Actions',
        title: `Cycle Theme (Current: ${themeMode})`,
        subtitle: 'Preview site in light, dark or system contrast',
        icon:
          themeMode === 'light' ? (
            <Sun size={16} className="text-amber-400" />
          ) : themeMode === 'dark' ? (
            <Moon size={16} className="text-blue-400" />
          ) : (
            <Monitor size={16} className="text-emerald-400" />
          ),
        run: () => {
          onCycleTheme();
        },
      },
      {
        id: 'media-library',
        category: 'Actions',
        title: 'Open Supabase Media Library',
        subtitle: 'Browse and upload images to cloud S3 bucket',
        icon: <FolderOpen size={16} className="text-accent-gold" />,
        run: () => {
          onOpenMedia();
          onOpenChange(false);
        },
      },
      {
        id: 'page-settings',
        category: 'Actions',
        title: 'Page Settings & SEO Metadata',
        subtitle: 'Configure title, slug, featured image & SERP preview',
        icon: <Settings size={16} className="text-purple-400" />,
        run: () => {
          onOpenSettings();
          onOpenChange(false);
        },
      },
      {
        id: 'revisions',
        category: 'Actions',
        title: 'Revision History & Restorations',
        subtitle: 'View timestamped snapshots and restore past edits',
        icon: <History size={16} className="text-amber-300" />,
        run: () => {
          onOpenRevisions();
          onOpenChange(false);
        },
      },
      {
        id: 'crm',
        category: 'Actions',
        title: 'Civic CRM & Outreach Panel',
        subtitle: 'Constituents, calendar events, newsletters & links',
        icon: <UsersRound size={16} className="text-emerald-400" />,
        run: () => {
          onOpenCrm();
          onOpenChange(false);
        },
      },
      {
        id: 'diagnostics',
        category: 'Actions',
        title: 'System Diagnostics & Edge Status',
        subtitle: 'Latency probes, Postgres connectivity & media health',
        icon: <Activity size={16} className="text-rose-400" />,
        run: () => {
          onOpenDiagnostics();
          onOpenChange(false);
        },
      },
      {
        id: 'export-json',
        category: 'Actions',
        title: 'Export Page JSON Snapshot',
        subtitle: 'Download complete structured block tree as portable JSON',
        icon: <Download size={16} className="text-sky-300" />,
        run: () => {
          onExportJson();
          onOpenChange(false);
        },
      },
      ...(onOpenDataPoints
        ? [
            {
              id: 'datapoints-matrix',
              category: 'Actions' as const,
              title: 'Open Page DataPoints Matrix',
              subtitle: 'Inspect, spotlight, and batch-edit all live database fields',
              shortcut: '⌘⇧D',
              icon: <Database size={16} className="text-sky-400" />,
              run: () => {
                onOpenDataPoints();
                onOpenChange(false);
              },
            },
          ]
        : []),
      ...(onOpenA11yAuditor
        ? [
            {
              id: 'a11y-audit',
              category: 'Actions' as const,
              title: 'Run Civic A11y & SEO Health Audit',
              subtitle: 'Scan live DOM for image alt text, heading hierarchy, and empty data',
              shortcut: '⌘⇧A',
              icon: <ShieldCheck size={16} className="text-emerald-400" />,
              run: () => {
                onOpenA11yAuditor();
                onOpenChange(false);
              },
            },
          ]
        : []),
      ...(onOpenDiff
        ? [
            {
              id: 'visual-diff',
              category: 'Actions' as const,
              title: 'Review Visual Changes & Draft Diff',
              subtitle: 'Inspect exact draft diffs against published database before committing',
              shortcut: '⌘⇧V',
              icon: <Activity size={16} className="text-accent-gold" />,
              run: () => {
                onOpenDiff();
                onOpenChange(false);
              },
            },
          ]
        : []),
      ...(onOpenVisualComposer
        ? [
            {
              id: 'visual-composer',
              category: 'Actions' as const,
              title: 'Visual Composer: Design & Box Model Inspector',
              subtitle: 'Full spacing, typography, borders, backgrounds & responsive visibility',
              shortcut: '⌘E',
              icon: <SlidersHorizontal size={16} className="text-accent-gold" />,
              run: () => {
                onOpenVisualComposer();
                onOpenChange(false);
              },
            },
          ]
        : []),
      ...(onOpenBlockLibrary
        ? [
            {
              id: 'block-library',
              category: 'Actions' as const,
              title: 'Visual Composer: Element Library & Templates',
              subtitle: 'Insert pre-built civic blocks, callouts, tables, and media',
              shortcut: '⌘⇧E',
              icon: <Layers size={16} className="text-emerald-400" />,
              run: () => {
                onOpenBlockLibrary();
                onOpenChange(false);
              },
            },
          ]
        : []),
      ...(onOpenNavigator
        ? [
            {
              id: 'page-navigator',
              category: 'Actions' as const,
              title: 'Visual Composer: Structure Navigator & Page Tree',
              subtitle: 'Tree view outline, reorder blocks, jump to element on canvas',
              shortcut: '⌘7',
              icon: <ListTree size={16} className="text-sky-400" />,
              run: () => {
                onOpenNavigator();
                onOpenChange(false);
              },
            },
          ]
        : []),
      {
        id: 'shortcuts',
        category: 'Actions',
        title: 'Keyboard Shortcuts Cheat Sheet',
        shortcut: '⌘/',
        icon: <PenLine size={16} className="text-accent-gold" />,
        run: () => {
          onOpenShortcuts();
          onOpenChange(false);
        },
      },
      {
        id: 'exit',
        category: 'Actions',
        title: 'Exit Visual Editor',
        subtitle: 'Close editing overlay and return to standard page view',
        icon: <X size={16} className="text-rose-400" />,
        run: () => {
          onExit();
          onOpenChange(false);
        },
      }
    );

    // Viewport Modes
    list.push(
      {
        id: 'viewport-desktop',
        category: 'Viewports',
        title: 'Desktop Viewport (100% Full Width)',
        subtitle: viewportMode === 'desktop' ? 'Currently active' : 'Switch to desktop view',
        icon: <Monitor size={16} className="text-sky-400" />,
        run: () => {
          onSetViewportMode('desktop');
          onOpenChange(false);
        },
      },
      {
        id: 'viewport-tablet',
        category: 'Viewports',
        title: `Tablet Viewport (768px — ${deviceOrientation})`,
        subtitle: viewportMode === 'tablet' ? 'Currently active' : 'Simulate iPad / tablet frame',
        icon: <Tablet size={16} className="text-purple-400" />,
        run: () => {
          onSetViewportMode('tablet');
          onOpenChange(false);
        },
      },
      {
        id: 'viewport-mobile',
        category: 'Viewports',
        title: `Mobile Viewport (390px — ${deviceOrientation})`,
        subtitle: viewportMode === 'mobile' ? 'Currently active' : 'Simulate iPhone frame',
        icon: <Smartphone size={16} className="text-emerald-400" />,
        run: () => {
          onSetViewportMode('mobile');
          onOpenChange(false);
        },
      },
      {
        id: 'rotate-orientation',
        category: 'Viewports',
        title: `Rotate Device Orientation (${deviceOrientation === 'portrait' ? 'Landscape' : 'Portrait'})`,
        subtitle: 'Toggle between portrait and landscape canvas preview',
        icon: <RotateCw size={16} className="text-amber-400" />,
        run: () => {
          onRotateOrientation();
          onOpenChange(false);
        },
      }
    );

    // Add Block Types
    const blockTypes: Array<{ type: Block['type']; label: string; icon: React.ReactNode }> = [
      {
        type: 'paragraph',
        label: 'Paragraph Text',
        icon: <Type size={16} className="text-slate-300" />,
      },
      {
        type: 'heading',
        label: 'Heading Section',
        icon: <Type size={16} className="text-amber-400 font-bold" />,
      },
      {
        type: 'callout',
        label: 'Callout / Alert Card',
        icon: <Sparkles size={16} className="text-amber-400" />,
      },
      {
        type: 'button',
        label: 'Button CTA Link',
        icon: <ArrowRight size={16} className="text-emerald-400" />,
      },
      {
        type: 'image',
        label: 'Image Asset (S3)',
        icon: <ImageIcon size={16} className="text-purple-400" />,
      },
      {
        type: 'quote',
        label: 'Quote Block',
        icon: <PenLine size={16} className="text-sky-300" />,
      },
      {
        type: 'code',
        label: 'Code Snippet',
        icon: <Code size={16} className="text-indigo-400" />,
      },
      {
        type: 'bulletList',
        label: 'Bullet List',
        icon: <Layers size={16} className="text-cyan-400" />,
      },
      {
        type: 'table',
        label: 'Data Table',
        icon: <LayoutGrid size={16} className="text-emerald-300" />,
      },
    ];

    for (const bt of blockTypes) {
      list.push({
        id: `add-${bt.type}`,
        category: 'Add Block',
        title: `Add ${bt.label}`,
        subtitle: `Insert new ${bt.type} block at bottom of document`,
        icon: bt.icon,
        run: () => {
          onAddNewBlock(bt.type);
          onOpenChange(false);
        },
      });
    }

    // Sections on page
    for (const sec of sections) {
      list.push({
        id: `section-${sec.key}`,
        category: 'Sections',
        title: `${sec.ordinal}. ${sec.label}`,
        subtitle: `Block index #${sec.blockIndex}`,
        icon: <Type size={16} className="text-accent-gold" />,
        run: () => {
          onSelectSection(sec.blockIndex);
          onOpenChange(false);
        },
      });
    }

    // Live DataPoints on page
    for (const dp of liveDataPoints) {
      list.push({
        id: `dp-${dp.name}`,
        category: 'Data Points',
        title: dp.name,
        subtitle: dp.preview ? `"${dp.preview}"` : 'Direct Supabase DataPoint',
        icon: <Database size={16} className="text-sky-400" />,
        run: () => {
          onOpenChange(false);
          const el = document.querySelector<HTMLElement>(`[data-data-point="${dp.name}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }, 300);
          }
        },
      });
    }

    return list;
  }, [
    canSave,
    canUndo,
    canRedo,
    showInspector,
    showBadges,
    showFrames,
    themeMode,
    viewportMode,
    deviceOrientation,
    sections,
    liveDataPoints,
    onSave,
    onUndo,
    onRedo,
    onToggleInspector,
    onToggleBadges,
    onToggleFrames,
    onCycleTheme,
    onOpenMedia,
    onOpenSettings,
    onOpenRevisions,
    onOpenCrm,
    onOpenDiagnostics,
    onExportJson,
    onOpenShortcuts,
    onExit,
    onSetViewportMode,
    onRotateOrientation,
    onAddNewBlock,
    onSelectSection,
    onOpenChange,
    onOpenDataPoints,
    onOpenA11yAuditor,
    onOpenDiff,
    onOpenVisualComposer,
    onOpenBlockLibrary,
    onOpenNavigator,
  ]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        Boolean(cmd.subtitle?.toLowerCase().includes(q)) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length)
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) selected.run();
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    },
    [filteredCommands, selectedIndex, onOpenChange]
  );

  // Keep selected in view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    const active = items[selectedIndex] as HTMLElement | undefined;
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Group commands by category for display
  const groupedCategories = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const cmd of filteredCommands) {
      const list = map.get(cmd.category) ?? [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return Array.from(map.entries());
  }, [filteredCommands]);

  let globalIndexCounter = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-200" />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          className="fixed left-1/2 top-[16%] z-[160] w-full max-w-2xl -translate-x-1/2 rounded-3xl border border-white/20 bg-slate-950/95 p-0 text-white shadow-2xl backdrop-blur-2xl duration-200 animate-in fade-in-0 zoom-in-95 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Header & Search Input */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <Search size={18} className="text-accent-gold shrink-0 animate-pulse" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search blocks, data points, or type an action… (Esc to close)"
              className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-white/40 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-md p-1 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <kbd className="hidden sm:inline-block rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              ESC
            </kbd>
          </div>

          <DialogPrimitive.Title id={titleId} className="sr-only">
            Visual Editor Command Palette
          </DialogPrimitive.Title>

          {/* Results List */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
            {groupedCategories.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                No matching actions, sections, or data points found for &ldquo;{query}&rdquo;
              </div>
            ) : (
              groupedCategories.map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
                    <span>{category}</span>
                    <span className="font-mono text-[9px] text-slate-400">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {items.map((item) => {
                    globalIndexCounter += 1;
                    const itemIndex = globalIndexCounter;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-command-item="true"
                        type="button"
                        onClick={item.run}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-accent-gold/20 text-white border border-accent-gold/40'
                            : 'text-slate-200 hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-1.5 rounded-xl shrink-0 ${
                              isSelected ? 'bg-accent-gold/30' : 'bg-white/10'
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-[11px] text-slate-300 truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </div>
                        {item.shortcut && (
                          <kbd
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold shrink-0 ${
                              isSelected
                                ? 'border-accent-gold/40 bg-accent-gold/20 text-accent-gold'
                                : 'border-white/10 bg-white/5 text-slate-300'
                            }`}
                          >
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-5 py-2.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="font-mono text-slate-200">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="font-mono text-slate-200">↵</kbd> select
              </span>
              <span>
                <kbd className="font-mono text-slate-200">esc</kbd> close
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Sparkles size={12} className="text-accent-gold" />
              <span>Indivisible Studio Pro</span>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
