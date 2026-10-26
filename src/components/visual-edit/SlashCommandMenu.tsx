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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

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
  const inputId = useId();

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

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) =>
          filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].run();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label="Slash commands"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
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

      {/* Command Items List */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No matching slash commands found
          </div>
        ) : (
          filtered.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  cmd.run();
                  onClose();
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
          })
        )}
      </div>
    </div>
  );
};
