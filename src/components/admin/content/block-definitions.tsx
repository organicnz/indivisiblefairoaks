'use client';

import {
  AlertTriangle,
  Code,
  Heading2,
  Image as ImageIcon,
  Info,
  List,
  ListOrdered,
  Megaphone,
  Minus,
  MousePointerClick,
  Quote,
  Table,
  Type,
} from 'lucide-react';
import { CALLOUT_TONES, type CalloutTone, type HeadingLevel } from '@/lib/blocks/types';

export type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'quote'
  | 'callout'
  | 'code'
  | 'image'
  | 'divider'
  | 'table'
  | 'button';

export interface BlockDefinition {
  kind: BlockKind;
  label: string;
  hint: string;
  icon: typeof Type;
  keywords: string[];
  /** Only callouts carry a variant selector. */
  tones?: readonly { tone: CalloutTone; label: string; icon: typeof Info }[];
  levels?: readonly HeadingLevel[];
}

const TONE_META: Record<CalloutTone, { label: string; icon: typeof Info }> = {
  info: { label: 'Info', icon: Info },
  action: { label: 'Action', icon: Megaphone },
  warning: { label: 'Warning', icon: AlertTriangle },
};

/**
 * The slash menu's contents.
 *
 * Every entry here is a block the serializer can emit *and* the sanitizer will
 * return intact — the pair is asserted by `blocks.test.ts`. There is deliberately
 * no "embed", "video" or "divider-with-HTML" entry: `<iframe>` is stripped by
 * `sanitizeWPContent`, so such a button would produce a block that vanishes on
 * publish. A control that cannot survive its own pipeline is a fake control.
 */
export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  {
    kind: 'paragraph',
    label: 'Text',
    hint: 'Plain body copy',
    icon: Type,
    keywords: ['paragraph', 'text', 'body', 'copy', 'p'],
  },
  {
    kind: 'heading',
    label: 'Heading',
    hint: 'A section title',
    icon: Heading2,
    keywords: ['heading', 'title', 'h2', 'h3', 'h4', 'subhead'],
    levels: [2, 3, 4],
  },
  {
    kind: 'bulletList',
    label: 'Bulleted list',
    hint: 'Unordered items',
    icon: List,
    keywords: ['list', 'bullet', 'ul', 'unordered', 'points'],
  },
  {
    kind: 'orderedList',
    label: 'Numbered list',
    hint: 'Steps in order',
    icon: ListOrdered,
    keywords: ['list', 'number', 'ordered', 'ol', 'steps'],
  },
  {
    kind: 'quote',
    label: 'Quote',
    hint: 'Pulled-out statement',
    icon: Quote,
    keywords: ['quote', 'blockquote', 'pull'],
  },
  {
    kind: 'callout',
    label: 'Callout',
    hint: 'Highlighted box',
    icon: Info,
    keywords: ['callout', 'box', 'note', 'aside', 'alert', 'panel'],
    tones: CALLOUT_TONES.map((tone) => ({ tone, ...TONE_META[tone] })),
  },
  {
    kind: 'button',
    label: 'Call to action',
    hint: 'A single prominent link',
    icon: MousePointerClick,
    keywords: ['button', 'cta', 'link', 'action', 'signup', 'rsvp'],
  },
  {
    kind: 'image',
    label: 'Image',
    hint: 'Photo with optional caption',
    icon: ImageIcon,
    keywords: ['image', 'photo', 'picture', 'img', 'media', 'figure'],
  },
  {
    kind: 'table',
    label: 'Table',
    hint: 'Rows and columns of data',
    icon: Table,
    keywords: ['table', 'grid', 'rows', 'columns', 'data'],
  },
  {
    kind: 'code',
    label: 'Code',
    hint: 'Preformatted text',
    icon: Code,
    keywords: ['code', 'pre', 'snippet', 'mono'],
  },
  {
    kind: 'divider',
    label: 'Divider',
    hint: 'A horizontal rule',
    icon: Minus,
    keywords: ['divider', 'hr', 'rule', 'separator', 'line'],
  },
] as const;

const BY_KIND = new Map(BLOCK_DEFINITIONS.map((def) => [def.kind, def]));

export function definitionFor(kind: BlockKind): BlockDefinition {
  return BY_KIND.get(kind) ?? BLOCK_DEFINITIONS[0];
}

/**
 * Rank slash-menu results. An exact label match wins, then a label prefix, then
 * keywords, so typing "ta" surfaces Table above "A single prominent link".
 * Anything that does not match at all is excluded rather than dimmed — a menu
 * full of non-matches reads as broken.
 */
export function searchBlocks(query: string): BlockDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...BLOCK_DEFINITIONS];

  const scored: Array<{ def: BlockDefinition; score: number }> = [];
  for (const def of BLOCK_DEFINITIONS) {
    const label = def.label.toLowerCase();
    let score = 0;
    if (label === q) score = 100;
    else if (label.startsWith(q)) score = 80;
    else if (def.keywords.some((k) => k === q)) score = 60;
    else if (label.includes(q)) score = 40;
    else if (def.keywords.some((k) => k.startsWith(q))) score = 30;
    else if (def.keywords.some((k) => k.includes(q))) score = 10;
    if (score > 0) scored.push({ def, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.def);
}

export const INLINE_FORMATS = [
  { command: 'bold', label: 'Bold', icon: BoldIcon, key: 'Ctrl+B' },
  { command: 'italic', label: 'Italic', icon: ItalicIcon, key: 'Ctrl+I' },
  { command: 'underline', label: 'Underline', icon: UnderlineIcon, key: 'Ctrl+U' },
] as const;

/* Small inline SVGs: these are typographic marks, not layout, and pulling three
   more lucide nodes in for them would bloat the editor bundle for no gain. */
function BoldIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 4h6.5a4.5 4.5 0 0 1 3.2 7.7A5 5 0 0 1 14.5 20H7V4zm3 3v4h3.2a2 2 0 1 0 0-4H10zm0 7v4h4a2 2 0 1 0 0-4h-4z" />
    </svg>
  );
}

function ItalicIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 4h8v3h-2.7l-3.2 10H14v3H6v-3h2.7l3.2-10H10V4z" />
    </svg>
  );
}

function UnderlineIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 4h3v7a5 5 0 0 0 10 0V4h3v7a8 8 0 0 1-16 0V4zM5 19h14v2H5v-2z" />
    </svg>
  );
}
