'use client';

import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Block } from '@/lib/blocks';
import { resolveEffectiveTheme, type ThemeMode } from '@/lib/theme';
import type {
  VisualComposerDevice,
  VisualComposerMode,
  VisualComposerStyles,
} from '@/types/unified';
import { ThemePreviewToggle } from './ui/ThemePreviewToggle';

/** Common entities, so `&amp;` does not appear as itself in the preview. */
const PREVIEW_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
};

/**
 * The text a reader would see, from the HTML an editor holds.
 *
 * The preview used to render `html` as a text node, so a heading containing
 * `<strong>` showed the tag rather than the emphasis. Stripping the markup is
 * not a rendering of the design, but it is an honest reading of the copy — and
 * it is the only safe one here: the mini-preview sits in the client bundle and
 * must not pull the sanitizer (and its parser) in just to draw two lines.
 */
function previewText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|td|th)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith('#')) {
        const point = code.startsWith('#x')
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
        // `fromCodePoint` throws outside Unicode, and an entity in a stored
        // paragraph is not a reason to take the composer down.
        return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : match;
      }
      return PREVIEW_ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Content-addressed keys for a preview list.
 *
 * The same string can legitimately appear twice in a list or a table column,
 * so the key also counts occurrences. Deriving it from the content rather than
 * the position means an edit does not remount every row after it.
 */
function keyed<T>(values: readonly T[]): { key: string; value: T }[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const label = String(value);
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return { key: `${label}#${count}`, value };
  });
}

const HEADING_PREVIEW_SIZE = {
  1: 'text-xl',
  2: 'text-lg',
  3: 'text-base',
  4: 'text-sm',
  5: 'text-xs',
  6: 'text-[11px]',
} as const;

/**
 * What the block actually is, at miniature size.
 *
 * A preview that says "paragraph" for some content and "button element" for
 * others is a label, not a preview. Each branch renders the shape a reader will
 * see — a quote rule, a button chip, list markers, a table head — so the design
 * controls are being judged against something recognisable.
 */
function PreviewBlockContent({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading':
      return (
        <p
          data-testid="composer-preview-body"
          className={`line-clamp-3 font-black leading-tight ${HEADING_PREVIEW_SIZE[block.level]}`}
        >
          {previewText(block.html) || 'Heading preview'}
        </p>
      );
    case 'paragraph':
      return (
        <p
          data-testid="composer-preview-body"
          className="line-clamp-3 text-xs leading-relaxed opacity-90"
        >
          {previewText(block.html) || 'Paragraph preview'}
        </p>
      );
    case 'quote':
      return (
        <blockquote
          data-testid="composer-preview-body"
          className="line-clamp-3 border-l-2 border-accent-gold/70 pl-2 text-xs italic opacity-90"
        >
          {previewText(block.html) || 'Quote preview'}
        </blockquote>
      );
    case 'callout': {
      const tone =
        block.tone === 'warning'
          ? 'border-amber-500/60 bg-amber-500/10'
          : block.tone === 'action'
            ? 'border-emerald-500/60 bg-emerald-500/10'
            : 'border-sky-500/60 bg-sky-500/10';
      return (
        <div
          data-testid="composer-preview-body"
          className={`line-clamp-3 rounded-lg border px-2 py-1.5 text-[11px] leading-snug ${tone}`}
        >
          {previewText(block.html) || 'Callout preview'}
        </div>
      );
    }
    case 'button':
      return (
        <span
          data-testid="composer-preview-body"
          className="inline-flex items-center rounded-lg bg-accent-gold px-2.5 py-1 text-[11px] font-black text-ink-strong shadow-sm"
        >
          {block.label || 'Button label'}
        </span>
      );
    case 'bulletList':
    case 'orderedList': {
      const items = block.items.map(previewText).filter(Boolean);
      const listClass = `space-y-0.5 pl-4 text-[11px] leading-snug opacity-90 ${
        block.type === 'bulletList' ? 'list-disc' : 'list-decimal'
      }`;
      const listItems = (
        <>
          {keyed(items.slice(0, 3)).map(({ key, value }) => (
            <li key={key} className="line-clamp-1">
              {value}
            </li>
          ))}
          {items.length > 3 ? (
            <li className="list-none text-[9px] opacity-60">+{items.length - 3} more</li>
          ) : null}
        </>
      );
      return block.type === 'bulletList' ? (
        <ul data-testid="composer-preview-body" className={listClass}>
          {listItems}
        </ul>
      ) : (
        <ol data-testid="composer-preview-body" className={listClass}>
          {listItems}
        </ol>
      );
    }
    case 'code':
      return (
        <pre
          data-testid="composer-preview-body"
          className="max-h-16 overflow-hidden whitespace-pre-wrap rounded-md bg-current/10 p-1.5 font-mono text-[9px] leading-snug"
        >
          {block.text || 'Code preview'}
        </pre>
      );
    case 'image': {
      const safeSrc = (() => {
        if (!block.src.trim()) return null;
        try {
          const url = new URL(block.src, 'https://preview.invalid');
          if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
          return url.href.replace(/["\\\n\r]/g, encodeURIComponent);
        } catch {
          return null;
        }
      })();
      const dimensions = block.width && block.height ? `${block.width}×${block.height}` : '';
      return (
        <div data-testid="composer-preview-body" className="space-y-1">
          <div
            role="img"
            aria-label={block.alt || 'Image preview'}
            className="relative flex h-16 items-end overflow-hidden rounded-lg border border-current/20 bg-current/5 p-1.5"
            style={
              safeSrc
                ? {
                    backgroundImage: `url("${safeSrc}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {/* The label stays visible over a real image too: a broken URL
                should leave a placeholder, not an empty box. */}
            <span className="flex items-center gap-1 rounded bg-slate-950/65 px-1 py-0.5 text-[9px] font-bold text-white">
              <ImageIcon size={11} />
              <span className="line-clamp-1">{block.alt || 'Image without alt text'}</span>
            </span>
          </div>
          <p className="truncate text-[9px] opacity-60">
            {dimensions ? `Intrinsic ${dimensions}` : 'Width and height not set'}
          </p>
          {/* An accessibility defect the composer can point at without a scan. */}
          {!block.alt.trim() ? (
            <p className="text-[9px] font-bold text-rose-300">Missing alt text</p>
          ) : null}
          {block.caption ? (
            <p className="line-clamp-1 text-[9px] italic opacity-70">{block.caption}</p>
          ) : null}
        </div>
      );
    }
    case 'divider':
      return (
        <div data-testid="composer-preview-body" className="py-2">
          <hr className="border-t border-current opacity-30" />
        </div>
      );
    case 'table': {
      const head = block.head.map(previewText).filter(Boolean);
      const rows = block.rows.slice(0, 2);
      return (
        <table data-testid="composer-preview-body" className="w-full text-left text-[9px]">
          {head.length > 0 ? (
            <thead>
              <tr className="border-b border-current/30">
                {keyed(head).map(({ key, value }) => (
                  <th key={key} className="py-0.5 pr-2 font-black">
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {keyed(rows).map(({ key: rowKey, value: row }) => (
              <tr key={rowKey} className="border-b border-current/10">
                {keyed(row).map(({ key: cellKey, value: cell }) => (
                  <td key={cellKey} className="py-0.5 pr-2 opacity-80">
                    {previewText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'row':
      return (
        <div
          data-testid="composer-preview-row"
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${block.columns.length}, minmax(0, 1fr))` }}
        >
          {block.columns.map((column, index) => (
            <div
              key={column.id}
              data-testid={`composer-preview-column-${index}`}
              className="min-w-0 space-y-1 rounded border border-current/20 p-1.5"
            >
              {column.blocks.length === 0 ? (
                <p className="text-[9px] italic opacity-60">Empty column</p>
              ) : (
                column.blocks.map((child) => <PreviewBlockContent key={child.id} block={child} />)
              )}
            </div>
          ))}
        </div>
      );
    case 'unsupported':
      return (
        <p
          data-testid="composer-preview-body"
          className="line-clamp-3 text-xs leading-relaxed opacity-80"
        >
          {previewText(block.html) || 'Raw HTML block'}
        </p>
      );
  }
}

export interface DevicePreviewFrameProps {
  inspectorMode: VisualComposerMode;
  previewDevice: VisualComposerDevice;
  setPreviewDevice: (device: VisualComposerDevice) => void;
  compiledClassNames: string;
  currentBlock: Block;
  previewTheme?: ThemeMode;
  setPreviewTheme?: (theme: ThemeMode) => void;
  styles?: VisualComposerStyles;
}

export function DevicePreviewFrame({
  inspectorMode,
  previewDevice,
  setPreviewDevice,
  compiledClassNames,
  currentBlock,
  previewTheme: propTheme,
  setPreviewTheme: propSetTheme,
  styles,
}: DevicePreviewFrameProps) {
  const [internalTheme, setInternalTheme] = useState<ThemeMode>('system');
  const activeTheme = propTheme ?? internalTheme;
  const handleSetTheme = propSetTheme ?? setInternalTheme;

  const [osPrefersDark, setOsPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsPrefersDark(e.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const hasThemeOverride =
    (styles?.themeMode && styles.themeMode !== 'inherit') ||
    (styles?.section?.themeMode && styles.section.themeMode !== 'inherit');
  const themeOverrideTone =
    inspectorMode === 'section'
      ? styles?.section?.themeMode || styles?.themeMode
      : styles?.themeMode || styles?.section?.themeMode;

  const effectiveTheme = resolveEffectiveTheme(
    hasThemeOverride && themeOverrideTone
      ? themeOverrideTone === 'system'
        ? 'system'
        : themeOverrideTone === 'dark'
          ? 'dark'
          : 'light'
      : activeTheme,
    osPrefersDark
  );

  return (
    <div className="border-b border-white/10 bg-slate-900/40 px-5 py-2.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <Sparkles size={11} className="text-accent-gold" />
          <span>Live Mini-Preview ({inspectorMode})</span>
          <span className="text-[9px] text-accent-gold/90 font-mono ml-1">Real-time</span>
          {hasThemeOverride && (
            <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-accent-gold font-mono border border-accent-gold/30">
              Tone: {themeOverrideTone}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* Theme Mode Selector (System / Light / Dark) */}
          <ThemePreviewToggle currentMode={activeTheme} onSelectMode={handleSetTheme} compact />

          <span className="text-white/20">|</span>

          {/* Viewport Device Width (Desk / Tab / Mob) */}
          <div className="flex items-center gap-1">
            {(['desktop', 'tablet', 'mobile'] as const).map((dev) => (
              <button
                key={dev}
                type="button"
                onClick={() => setPreviewDevice(dev)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize transition-colors cursor-pointer ${
                  previewDevice === dev
                    ? 'bg-accent-gold text-ink-strong'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
                title={`Preview on ${dev}`}
                aria-label={`Preview on ${dev}`}
              >
                {dev === 'desktop' ? 'Desk' : dev === 'tablet' ? 'Tab' : 'Mob'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        data-theme={effectiveTheme}
        data-theme-mode={themeOverrideTone || activeTheme}
        className={`rounded-xl border transition-[background-color,border-color,color] duration-300 p-2.5 overflow-hidden relative ${
          effectiveTheme === 'light'
            ? 'bg-white/95 text-ink-strong border-white/20 shadow-xs'
            : 'bg-slate-950 text-white border-white/10 shadow-inner'
        }`}
      >
        {/* Real-time Badge Ribbon Preview */}
        {styles?.badgeText?.trim() && (
          <span
            data-testid="preview-badge-ribbon"
            className={`pointer-events-none absolute z-10 ${
              styles.badgePosition === 'top-left' ? 'top-1.5 left-1.5' : 'top-1.5 right-1.5'
            } text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              styles.badgeTone === 'navy'
                ? 'bg-sky-950 text-sky-200 border border-sky-400/30'
                : styles.badgeTone === 'emerald'
                  ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/30'
                  : styles.badgeTone === 'crimson'
                    ? 'bg-rose-950 text-rose-200 border border-rose-400/30'
                    : styles.badgeTone === 'slate'
                      ? 'bg-slate-800 text-slate-300 border border-white/10'
                      : 'bg-accent-gold text-ink-strong shadow-xs'
            }`}
          >
            {styles.badgeText.trim()}
          </span>
        )}

        <div
          className={`transition-[max-width,width] duration-300 ${
            previewDevice === 'mobile'
              ? 'max-w-[220px] mx-auto'
              : previewDevice === 'tablet'
                ? 'max-w-[320px] mx-auto'
                : 'w-full'
          }`}
        >
          <div
            className={`min-h-6 ${
              compiledClassNames ||
              (effectiveTheme === 'light'
                ? 'p-2 text-ink-strong text-xs'
                : 'p-2 text-white text-xs')
            }`}
          >
            <PreviewBlockContent block={currentBlock} />
          </div>
        </div>
      </div>
    </div>
  );
}
