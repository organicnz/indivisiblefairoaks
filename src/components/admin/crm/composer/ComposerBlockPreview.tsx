'use client';

import type { ComposerBlock } from './types';

interface ComposerBlockPreviewProps {
  block: ComposerBlock;
}

/**
 * Read-only rendering of a composer block.
 *
 * Kept separate from the form so the visual preview and the editing controls can
 * evolve independently without one branch's markup sitting in the other's map.
 */
export function ComposerBlockPreview({ block }: ComposerBlockPreviewProps) {
  return (
    <div className="py-2 px-1">
      {block.type === 'header' && (
        <div className="space-y-1">
          {block.eyebrow && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-primary/10 text-primary dark:text-primary-on-dark">
              {block.eyebrow}
            </span>
          )}
          {block.level === 2 ? (
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
              {block.heading || '(Empty headline)'}
            </h2>
          ) : (
            <h1 className="text-xl font-black text-foreground uppercase tracking-tight">
              {block.heading || '(Empty headline)'}
            </h1>
          )}
        </div>
      )}

      {block.type === 'text' && (
        <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
          {block.content || '(Empty text block)'}
        </div>
      )}

      {block.type === 'image' && (
        <div
          className={`space-y-1.5 ${
            block.alignment === 'center'
              ? 'text-center'
              : block.alignment === 'right'
                ? 'text-right'
                : 'text-left'
          }`}
        >
          {block.url ? (
            // biome-ignore lint/performance/noImgElement: user-supplied external campaign banner in visual composer preview
            <img
              src={block.url}
              alt={block.alt || 'Campaign banner'}
              className="max-h-64 rounded-xl object-cover inline-block border border-border"
            />
          ) : (
            <div className="h-32 bg-surface-muted rounded-xl flex items-center justify-center text-muted-foreground text-xs">
              No image URL provided
            </div>
          )}
          {block.caption && (
            <p className="text-[11px] text-muted-foreground italic">{block.caption}</p>
          )}
        </div>
      )}

      {block.type === 'quote' && (
        <div className="p-4 rounded-xl border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 space-y-1">
          <p className="text-xs font-medium text-foreground italic">
            “{block.quote || 'Quote text'}”
          </p>
          <p className="text-[10px] font-bold text-muted-foreground">
            — {block.author}
            {block.role ? `, ${block.role}` : ''}
          </p>
        </div>
      )}

      {block.type === 'stat' && (
        <div className="p-4 rounded-xl border border-border bg-surface-muted text-center space-y-1">
          <div className="text-2xl font-black text-primary dark:text-primary-on-dark tracking-tight">
            {block.value || '0'}
          </div>
          <div className="text-xs font-black uppercase text-foreground">
            {block.label || 'Metric Label'}
          </div>
          {block.description && (
            <div className="text-[11px] text-muted-foreground">{block.description}</div>
          )}
        </div>
      )}

      {block.type === 'list' && (
        <div className="space-y-1">
          {block.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ephemeral list items without database IDs
            <div key={i} className="flex items-start gap-2 text-xs text-foreground">
              <span className="font-bold text-primary dark:text-primary-on-dark">
                {block.style === 'numbered' ? `${i + 1}.` : '•'}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {block.type === 'social' && (
        <div className="p-3 rounded-xl border border-border bg-surface-muted text-center space-y-2">
          {block.heading && (
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              {block.heading}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {block.channels.map((ch, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: ephemeral social link items
                key={i}
                className="px-2.5 py-1 rounded-full bg-surface-card border border-border text-[11px] font-bold text-foreground shadow-2xs"
              >
                {ch.label || ch.platform}
              </span>
            ))}
          </div>
        </div>
      )}

      {block.type === 'callout' && (
        <div
          className={`p-3.5 rounded-xl border ${
            block.variant === 'alert'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              : block.variant === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
          }`}
        >
          {block.title && (
            <h4 className="text-xs font-bold uppercase tracking-wider mb-1">{block.title}</h4>
          )}
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{block.text}</p>
        </div>
      )}

      {block.type === 'button' && (
        <div className="py-2 text-center">
          <span
            className={`inline-block px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm ${
              block.variant === 'accent'
                ? 'bg-amber-600 text-white'
                : block.variant === 'outline'
                  ? 'border border-primary text-primary dark:text-primary-on-dark bg-surface-card'
                  : 'bg-primary text-white'
            }`}
          >
            {block.label || 'Action'}
          </span>
        </div>
      )}

      {block.type === 'event' && (
        <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40 space-y-1">
          <div className="text-xs font-black uppercase text-purple-900 dark:text-purple-200">
            📅 {block.title || 'Event Title'}
          </div>
          <div className="text-[11px] text-purple-700 dark:text-purple-300 font-bold">
            When: {block.date} {block.time && `· ${block.time}`}
          </div>
          <div className="text-[11px] text-purple-700 dark:text-purple-300">
            Where: {block.location}
          </div>
        </div>
      )}

      {block.type === 'divider' && (
        <div className="py-2">
          <hr className="border-border" />
        </div>
      )}

      {block.type === 'signoff' && (
        <div className="text-xs text-foreground space-y-0.5">
          <p className="italic">{block.closing}</p>
          <p className="font-bold">{block.sender}</p>
        </div>
      )}
    </div>
  );
}
