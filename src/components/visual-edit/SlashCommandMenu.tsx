'use client';

import {
  Code,
  Eraser,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Search,
  Sparkles,
  Type,
  Volume2,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { clampFixedPanelPosition, type FixedPanelPosition } from './fixed-panel-position';
import { focusEditorFallback } from './focusable';

export interface SlashCommandItem {
  id: string;
  title: string;
  subtitle: string;
  shortcut?: string;
  icon: React.ReactNode;
  keywords: string[];
  run: () => void;
}

export interface SlashCommandMenuProps {
  open: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  onExecuteCommand: (commandId: string) => void;
  onOpenGhostwriter?: () => void;
  onInsertLink?: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  open,
  onClose,
  position,
  onExecuteCommand,
  onOpenGhostwriter,
  onInsertLink,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const [panelPosition, setPanelPosition] = useState<FixedPanelPosition | null>(null);
  const inputId = useId();
  const listboxId = useId();
  const optionId = useCallback(
    (commandId: string) => `${listboxId}-option-${commandId}`,
    [listboxId]
  );

  const commands: SlashCommandItem[] = useMemo(
    () => [
      {
        id: 'h2',
        title: 'Heading 2',
        subtitle: 'Major civic section header',
        shortcut: '/h2',
        icon: <Heading2 size={15} className="text-accent-gold" />,
        keywords: ['h2', 'heading', 'title', 'header'],
        run: () => onExecuteCommand('h2'),
      },
      {
        id: 'h3',
        title: 'Heading 3',
        subtitle: 'Sub-heading for group topics',
        shortcut: '/h3',
        icon: <Heading3 size={15} className="text-amber-300" />,
        keywords: ['h3', 'subheading', 'subtitle'],
        run: () => onExecuteCommand('h3'),
      },
      {
        id: 'paragraph',
        title: 'Paragraph Text',
        subtitle: 'Standard clean body copy',
        shortcut: '/p',
        icon: <Type size={15} className="text-sky-400" />,
        keywords: ['paragraph', 'text', 'p', 'body'],
        run: () => onExecuteCommand('paragraph'),
      },
      {
        id: 'callout',
        title: 'Callout Box',
        subtitle: 'Highlight critical civic alerts or notices',
        shortcut: '/callout',
        icon: <Volume2 size={15} className="text-emerald-400" />,
        keywords: ['callout', 'alert', 'notice', 'highlight'],
        run: () => onExecuteCommand('callout'),
      },
      {
        id: 'quote',
        title: 'Quote Block',
        subtitle: 'Attributed quotation or activist testimonial',
        shortcut: '/quote',
        icon: <Quote size={15} className="text-purple-400" />,
        keywords: ['quote', 'blockquote', 'cite'],
        run: () => onExecuteCommand('quote'),
      },
      {
        id: 'bulletList',
        title: 'Bullet List',
        subtitle: 'Organize bulleted points and notes',
        shortcut: '/bullet',
        icon: <List size={15} className="text-sky-300" />,
        keywords: ['bullet', 'list', 'ul'],
        run: () => onExecuteCommand('bulletList'),
      },
      {
        id: 'orderedList',
        title: 'Numbered Steps',
        subtitle: 'Sequential activist action steps',
        shortcut: '/steps',
        icon: <ListOrdered size={15} className="text-amber-400" />,
        keywords: ['numbered', 'steps', 'order', 'ol'],
        run: () => onExecuteCommand('orderedList'),
      },
      {
        id: 'code',
        title: 'Code Snippet',
        subtitle: 'Monospace code or technical syntax',
        shortcut: '/code',
        icon: <Code size={15} className="text-rose-400" />,
        keywords: ['code', 'mono', 'snippet'],
        run: () => onExecuteCommand('code'),
      },
      ...(onInsertLink
        ? [
            {
              id: 'link',
              title: 'Insert Link',
              subtitle: 'Link selection to internal route or web URL',
              shortcut: '⌘K',
              icon: <LinkIcon size={15} className="text-emerald-400" />,
              keywords: ['link', 'url', 'href'],
              run: onInsertLink,
            },
          ]
        : []),
      ...(onOpenGhostwriter
        ? [
            {
              id: 'ai-ghostwriter',
              title: 'Civic AI Ghostwriter',
              subtitle: 'Polish tone, clarity, and community resonance',
              shortcut: '/ai',
              icon: <Sparkles size={15} className="text-accent-gold animate-pulse" />,
              keywords: ['ai', 'polish', 'ghostwriter', 'tone', 'civic'],
              run: onOpenGhostwriter,
            },
          ]
        : []),
      {
        id: 'divider',
        title: 'Divider',
        subtitle: 'Horizontal separator line',
        shortcut: '/hr',
        icon: <Minus size={15} className="text-slate-400" />,
        keywords: ['divider', 'hr', 'line', 'separator'],
        run: () => onExecuteCommand('divider'),
      },
      {
        id: 'clear',
        title: 'Clear Formatting',
        subtitle: 'Strip custom styling to default plain text',
        shortcut: '/clear',
        icon: <Eraser size={15} className="text-slate-400" />,
        keywords: ['clear', 'remove', 'reset', 'plain'],
        run: () => onExecuteCommand('clear'),
      },
    ],
    [onExecuteCommand, onInsertLink, onOpenGhostwriter]
  );

  const filtered = useMemo(() => {
    const q = query.replace(/^\//, '').toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
    );
  }, [commands, query]);

  const activeIndex = filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);
  const activeOptionId = filtered[activeIndex] ? optionId(filtered[activeIndex].id) : undefined;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }
    const menu = containerRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPanelPosition(
      clampFixedPanelPosition({
        x: position.left,
        y: position.top,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    );
  }, [open, position.left, position.top]);

  useLayoutEffect(() => {
    if (!open) return;
    closingRef.current = false;
    const active = document.activeElement;
    returnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    setQuery('');
    setSelectedIndex(0);
    inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = filtered[activeIndex];
    if (!active) return;
    document.getElementById(optionId(active.id))?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, filtered, open, optionId]);

  // Pointer outside closes. Page scroll dismisses an anchored palette rather
  // than leaving it floating over unrelated content; scrolling inside the
  // command list remains the menu's own business.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        requestClose();
      }
    };
    const handleScroll = (e: Event) => {
      if (e.target instanceof Node && containerRef.current?.contains(e.target)) return;
      requestClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, requestClose]);

  const dismiss = useCallback(() => {
    requestClose();
    queueMicrotask(() => {
      const opener = returnFocusRef.current;
      returnFocusRef.current = null;
      if (opener?.isConnected) {
        opener.focus({ preventScroll: true });
        return;
      }
      focusEditorFallback();
    });
  }, [requestClose]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (closingRef.current) return;
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) return;
      requestClose();
    },
    [requestClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => {
          if (filtered.length === 0) return 0;
          const current = Math.min(i, filtered.length - 1);
          return (current + 1) % filtered.length;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => {
          if (filtered.length === 0) return 0;
          const current = Math.min(i, filtered.length - 1);
          return (current - 1 + filtered.length) % filtered.length;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedIndex(Math.max(0, filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const command = filtered[activeIndex];
        if (command) {
          command.run();
          requestClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    },
    [activeIndex, dismiss, filtered, requestClose]
  );

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      style={{
        position: 'fixed',
        top: `${panelPosition?.top ?? position.top}px`,
        left: `${panelPosition?.left ?? position.left}px`,
        maxHeight: panelPosition?.maxHeight,
        maxWidth: 'calc(100vw - 1rem)',
        zIndex: 10000,
      }}
      className="w-72 rounded-2xl border border-white/20 bg-slate-950/95 p-1.5 text-white shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 pointer-events-auto flex flex-col max-h-80"
    >
      {/* Search Filter Header */}
      <div className="relative mb-1 flex items-center">
        <Search size={12} className="absolute left-2.5 text-accent-gold pointer-events-none" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label="Filter slash commands"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-haspopup="listbox"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Filter commands (e.g. /h2, /quote)..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-7 pr-3 text-xs text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
        />
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {filtered.length === 0
          ? 'No matching slash commands.'
          : `${filtered.length} slash command${filtered.length === 1 ? '' : 's'} available.`}
      </div>

      {/* Command Items List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-400">
            No matching slash commands found
          </div>
        )}
        <div
          id={listboxId}
          role="listbox"
          aria-label="Slash commands"
          className="space-y-0.5"
        >
          {filtered.map((cmd, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={cmd.id}
                id={optionId(cmd.id)}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => {
                  cmd.run();
                  requestClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                    {cmd.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold leading-tight truncate text-white">
                      {cmd.title}
                    </span>
                    <span className="block text-[10px] leading-tight text-slate-400 truncate">
                      {cmd.subtitle}
                    </span>
                  </div>
                </div>

                {cmd.shortcut && (
                  <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-accent-gold">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
