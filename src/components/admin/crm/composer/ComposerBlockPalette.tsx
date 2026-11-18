'use client';

import {
  AlertCircle,
  BarChart3,
  Calendar,
  ExternalLink,
  Heading,
  Image as ImageIcon,
  List as ListIcon,
  Minus,
  PenTool,
  Quote as QuoteIcon,
  Share2,
  Type,
} from 'lucide-react';
import type { ComposerBlock } from './types';

interface ComposerBlockPaletteProps {
  onAddBlock: (type: ComposerBlock['type']) => void;
}

export function ComposerBlockPalette({ onAddBlock }: ComposerBlockPaletteProps) {
  return (
    <div className="p-4 bg-surface-muted border border-border rounded-2xl shadow-2xs space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        + Add Section Block
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        <button
          type="button"
          onClick={() => onAddBlock('header')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <Heading size={13} className="text-primary dark:text-primary-on-dark" />
          Headline
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('text')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <Type size={13} className="text-muted-foreground" />
          Text / Story
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('image')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <ImageIcon size={13} className="text-cyan-600" />
          Photo / Banner
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('quote')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <QuoteIcon size={13} className="text-amber-600" />
          Quote Box
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('stat')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <BarChart3 size={13} className="text-emerald-600" />
          Stat Counter
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('list')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <ListIcon size={13} className="text-indigo-600" />
          Checklist
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('callout')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <AlertCircle size={13} className="text-amber-600" />
          Callout Box
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('button')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <ExternalLink size={13} className="text-blue-600" />
          CTA Button
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('event')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <Calendar size={13} className="text-purple-600" />
          Event Card
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('social')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <Share2 size={13} className="text-blue-600" />
          Social Links
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('divider')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <Minus size={13} className="text-muted-foreground" />
          Divider
        </button>
        <button
          type="button"
          onClick={() => onAddBlock('signoff')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
        >
          <PenTool size={13} className="text-emerald-600" />
          Sign-off
        </button>
      </div>
    </div>
  );
}
