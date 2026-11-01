'use client';

import { AlertTriangle, Eye } from 'lucide-react';
import {
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  type Block,
  blockWrapperAttributes,
  designClassesOf,
  isStructuralBlockClass,
  serializeBlocks,
  themeModeFromAttribute,
  themeModeFromClassList,
} from '@/lib/blocks';
import type { ThemeMode } from '@/lib/theme';
import { sectionLabelForBlock } from '@/lib/visual-sections';

import type {
  VisualComposerDevice,
  VisualComposerMode,
  VisualComposerStyles,
  VisualComposerTab,
} from '@/types/unified';
import {
  AdvancedMotionStudio,
  BlockContentStudio,
  BoxModelStudio,
  CIVIC_CLASS_PRESETS,
  CodeStudio,
  compileBadgeHtml,
  compileClassNames,
  DEFAULT_VC_STYLES,
  DevicePreviewFrame,
  getStylesClipboard,
  INSPECTOR_TABS,
  InspectorFooter,
  InspectorHeader,
  InspectorTabBar,
  inspectorTabId,
  inspectorTabPanelId,
  PresetStudio,
  SECTION_PRESETS,
  SectionStudio,
  type StylePreset,
  setStylesClipboard,
  TypographyStudio,
  VC_COLUMN_PRESETS,
  VC_STYLE_PRESETS,
} from './composer';
import type { ComposerDraftPreview } from './useComposerPagePreview';

export type {
  VisualComposerBackground,
  VisualComposerBorder,
  VisualComposerBoxModel,
  VisualComposerBoxModelTab,
  VisualComposerCivicPreset,
  VisualComposerColumnPreset,
  VisualComposerColumnSlot,
  VisualComposerDevice,
  VisualComposerEffects,
  VisualComposerLayout,
  VisualComposerMode,
  VisualComposerMotion,
  VisualComposerMotionTab,
  VisualComposerPreset,
  VisualComposerPresetCategory,
  VisualComposerResponsive,
  VisualComposerSection,
  VisualComposerSectionPreset,
  VisualComposerSectionTab,
  VisualComposerStyles,
  VisualComposerTab,
  VisualComposerThemeMode,
  VisualComposerTransform,
  VisualComposerTypography,
  VisualComposerTypographyTab,
} from '@/types/unified';
export type { StylePreset };
export {
  CIVIC_CLASS_PRESETS,
  compileClassNames,
  DEFAULT_VC_STYLES,
  getStylesClipboard,
  SECTION_PRESETS,
  setStylesClipboard,
  VC_COLUMN_PRESETS,
  VC_STYLE_PRESETS,
};

/** How many style snapshots the composer keeps for undo. */
const VC_HISTORY_LIMIT = 50;

/**
 * The style groups the footer names when it reports unsaved work.
 *
 * Coarse on purpose: "Type" is something an operator recognises and can act
 * on; `typography.letterSpacing` is not. The exact fields ride in the title, so
 * the chip stays readable and the detail is still one hover away. Several keys
 * may share a label (the three badge fields), and they revert together.
 */
const VC_STYLE_GROUPS: readonly { key: keyof VisualComposerStyles; label: string }[] = [
  { key: 'typography', label: 'Type' },
  { key: 'margin', label: 'Margin' },
  { key: 'padding', label: 'Padding' },
  { key: 'layout', label: 'Layout' },
  { key: 'border', label: 'Border' },
  { key: 'background', label: 'Background' },
  { key: 'shadow', label: 'Shadow' },
  { key: 'effects', label: 'Effects' },
  { key: 'motion', label: 'Motion' },
  { key: 'animation', label: 'Animation' },
  { key: 'transform', label: 'Transform' },
  { key: 'responsive', label: 'Responsive' },
  { key: 'section', label: 'Section' },
  { key: 'anchorId', label: 'Anchor id' },
  { key: 'themeMode', label: 'Theme' },
  { key: 'customClasses', label: 'Custom classes' },
  { key: 'customStyle', label: 'Custom CSS' },
  { key: 'badgeText', label: 'Badge' },
  { key: 'badgeTone', label: 'Badge' },
  { key: 'badgePosition', label: 'Badge' },
];

/** A changed group: what the footer names, and which fields moved. */
export interface VisualComposerStyleChange {
  label: string;
  fields: string[];
}

/** The one "group" that is not a style: the block's own draft copy. */
const CONTENT_CHANGE_LABEL = 'Content';

/** `letterSpacing` reads better as `letter spacing` in a tooltip. */
const humanizeField = (field: string) => field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/**
 * A design this panel wrote, and the mode that compiled it.
 *
 * The block model has no style field, so a design exists only as the utility
 * classes on the wrapper. Without a record of what this panel generated, every
 * reopen reads the whole applied class string back as `customClasses` — and the
 * next apply emits a second copy of every utility. Remembering the draft is
 * how the panel reverses its own compiler without guessing.
 */
interface ComposerStyleMemory {
  mode: VisualComposerMode;
  styles: VisualComposerStyles;
}

/** A plain-data copy: memory must not alias the draft the panel keeps editing. */
function cloneStyles(styles: VisualComposerStyles): VisualComposerStyles {
  return JSON.parse(JSON.stringify(styles)) as VisualComposerStyles;
}

/**
 * The tokens every block-mode draft already generates.
 *
 * These cannot ground a remembered design: `text-left` is on nearly every
 * wrapper, including one this panel never touched. A design is recognisable
 * only by a token that distinguishes it from the defaults.
 */
const DEFAULT_BLOCK_CLASS_TOKENS = new Set(
  compileClassNames('block', DEFAULT_VC_STYLES).split(/\s+/).filter(Boolean)
);

/**
 * The styles a block's own markup currently declares.
 *
 * The block is the source of truth only for what its HTML can carry: an anchor
 * id, hand-authored classes, inline CSS, a pinned theme, a badge. Everything
 * else starts from the editor's defaults, because the block model has no field
 * for it — the design controls are a draft that becomes markup when applied.
 *
 * A remembered design fills that gap, but only while the markup still carries
 * it: see the grounding check below.
 */
function readComposerStylesFromBlock(
  block: Block,
  memory?: ComposerStyleMemory
): VisualComposerStyles {
  const next: VisualComposerStyles = { ...DEFAULT_VC_STYLES };
  if (!('html' in block) || typeof block.html !== 'string') return next;

  const trimmed = block.html.trim();
  const attrs = blockWrapperAttributes(trimmed);
  if (attrs !== null) {
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const styleMatch = attrs.match(/style=["']([^"']+)["']/i);
    const themeMatch = attrs.match(/data-theme(?:-mode)?=["']([^"']+)["']/i);

    /*
     * Every token on the wrapper, split once. `cw-*` classes are structure, not
     * design: the block parser uses them to know a callout is a callout. They
     * are the page's to own, and the overlay re-attaches them on every write, so
     * the design panel never carries them into `customClasses` where a reset
     * would delete them.
     */
    const wrapperTokens = (classMatch?.[1] ?? '').split(/\s+/).filter(Boolean);

    /*
     * The tokens the remembered draft generated. Section-mode designs are not
     * replayed here: the block controls describe a block, and a row design
     * restored into them would describe something else.
     */
    const remembered = memory?.mode === 'block' ? memory : undefined;
    const generated = new Set(
      remembered
        ? compileClassNames('block', { ...remembered.styles, customClasses: '' })
            .split(/\s+/)
            .filter(Boolean)
        : []
    );
    const signature = new Set(
      [...generated].filter((token) => !DEFAULT_BLOCK_CLASS_TOKENS.has(token))
    );

    /*
     * The memory has to be grounded in the markup to be used. A design the panel
     * wrote is only still there while the wrapper carries one of the tokens that
     * distinguish that design from the defaults; an overlay undo, a revert or an
     * external rewrite removes them. Reading a remembered design out of markup
     * that no longer has it would show controls for a look the page does not
     * have, and the next apply would write that look back.
     */
    const grounded =
      remembered !== undefined &&
      (signature.size > 0
        ? wrapperTokens.some((token) => signature.has(token))
        : wrapperTokens.some((token) => generated.has(token)));

    if (grounded && remembered) {
      Object.assign(next, cloneStyles(remembered.styles));
      /*
       * Identity stays markup-owned. An anchor id identifies one element, so a
       * batch's primary anchor must not follow the memory onto every target;
       * the badge lives in the block's HTML rather than in the design fields;
       * and inline CSS is the Code tab's, not the design's.
       */
      next.anchorId = DEFAULT_VC_STYLES.anchorId;
      next.customStyle = '';
      next.customClasses = '';
      next.themeMode = DEFAULT_VC_STYLES.themeMode;
      next.badgeText = '';
      next.badgeTone = DEFAULT_VC_STYLES.badgeTone;
      next.badgePosition = DEFAULT_VC_STYLES.badgePosition;
    }

    if (idMatch?.[1]) next.anchorId = idMatch[1];
    if (styleMatch?.[1]) next.customStyle = styleMatch[1];

    /*
     * What is left of the wrapper is the operator's own classes. Subtracting the
     * generated tokens is what prevents the next apply from emitting every
     * utility a second time; CSS source order, not class-attribute order, would
     * decide which copy wins. Without a grounded memory there is nothing to
     * subtract, so this is the pre-existing read of the wrapper.
     */
    next.customClasses = grounded
      ? wrapperTokens
          .filter((token) => !isStructuralBlockClass(token) && !generated.has(token))
          .join(' ')
      : designClassesOf(classMatch?.[1] ?? '');
    if (themeMatch?.[1]) {
      const mode = themeModeFromAttribute(themeMatch[1]);
      if (mode) next.themeMode = mode;
    } else {
      const mode = themeModeFromClassList(classMatch?.[1]);
      if (mode) next.themeMode = mode;
    }
  }

  // Restore the decorative badge ribbon if the block carries one.
  const badgeMatch = trimmed.match(/<span\s+data-vc-badge(?:[^>]*)>(.*?)<\/span>/i);
  if (badgeMatch) {
    const text = badgeMatch[1].trim();
    const toneMatch = badgeMatch[0].match(/data-tone=["']([^"']+)["']/);
    const posMatch = badgeMatch[0].match(/data-pos=["']([^"']+)["']/);
    next.badgeText = text;
    next.badgeTone = (toneMatch?.[1] as VisualComposerStyles['badgeTone']) || 'gold';
    next.badgePosition = (posMatch?.[1] as VisualComposerStyles['badgePosition']) || 'top-right';
  }

  return next;
}

/** One undo step: both halves of the draft, because both reach the page together. */
interface ComposerSnapshot {
  styles: VisualComposerStyles;
  block: Block | null;
}

/**
 * Return a copy of `current` with the named keys taken from `baseline`.
 *
 * `Object.assign` per key keeps the assignment typed against the real key
 * rather than launder the whole object through a cast.
 */
function revertKeys(
  current: VisualComposerStyles,
  baseline: VisualComposerStyles,
  keys: readonly (keyof VisualComposerStyles)[]
): VisualComposerStyles {
  const next = { ...current };
  for (const key of keys) {
    Object.assign(next, { [key]: baseline[key] });
  }
  return next;
}

/**
 * The block a save will write, with the draft badge folded in.
 *
 * The live preview composes the same block before extracting its copy, so the
 * page cannot show a badge the write omits — or show the old badge after the
 * operator changed it. The regular expression is the one the save always used:
 * an existing badge is replaced, never stacked.
 */
function composeDraftBlock(block: Block, styles: VisualComposerStyles): Block {
  const finalBlock: Block = { ...block };
  const badgeHtml = compileBadgeHtml(styles);
  if ('html' in finalBlock && typeof finalBlock.html === 'string') {
    let content = finalBlock.html.replace(/<span\s+data-vc-badge[^>]*>.*?<\/span>/gi, '');
    if (badgeHtml) content = `${badgeHtml}${content}`;
    return { ...finalBlock, html: content };
  }
  if (!badgeHtml) return finalBlock;
  const serialized = serializeBlocks([finalBlock]);
  return { id: finalBlock.id, type: 'unsupported', html: `${badgeHtml}${serialized}` };
}

/**
 * The inside of the one element a serialized block produces.
 *
 * `null` when there is no single top-level element to read — a document of
 * nothing, or unsupported markup with several roots. Painting nothing is the
 * honest answer there; guessing would put copy on the page that the save would
 * not write in that shape. A DOM parse rather than string surgery because the
 * serializer's element may nest, and because a void element (a divider) has no
 * inside at all. The server pass skips it: the report runs in an effect.
 */
function blockInnerHtml(serialized: string): string | null {
  if (typeof document === 'undefined') return null;
  const template = document.createElement('template');
  template.innerHTML = serialized;
  const elements = template.content.children;
  return elements.length === 1 ? elements[0].innerHTML : null;
}

/**
 * One tab's panel.
 *
 * Only the active panel renders, which is what keeps the strip cheap; the
 * wrapper exists so that panel carries the role, id and label its tab points
 * at. Without it the strip is six buttons pretending to be tabs — announced as
 * a row of toggles, with nothing telling a screen reader that choosing one
 * changed the content below it.
 */
function ComposerTabPanel({
  idBase,
  tab,
  activeTab,
  children,
}: {
  idBase: string;
  tab: VisualComposerTab;
  activeTab: VisualComposerTab;
  children: ReactNode;
}) {
  if (activeTab !== tab) return null;
  return (
    <div
      role="tabpanel"
      id={inspectorTabPanelId(idBase, tab)}
      aria-labelledby={inspectorTabId(idBase, tab)}
    >
      {children}
    </div>
  );
}

/**
 * What a save handler reports back.
 *
 * `false` is the one meaningful refusal: the page declined the write. `true`
 * and `undefined` both mean it happened, because most handlers are `void` and
 * an async refactor should not silently stop closing the panel.
 */
export type VisualComposerSaveResult = boolean | undefined;

/** Everything inside the panel that a Tab press should visit. */
const INSPECTOR_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface VisualComposerInspectorProps {
  open: boolean;
  onClose: () => void;
  block: Block | null;
  blockIndex: number | null;
  /**
   * Returns `false` when the page refused the write — a duplicate anchor id,
   * for instance. The inspector then stays open with every edit intact rather
   * than closing over a save that did not happen.
   */
  onSaveBlock: (
    updatedBlock: Block,
    customClasses?: string,
    anchorId?: string,
    customStyle?: string
  ) => VisualComposerSaveResult;
  /**
   * Batch save: applies one set of design controls to every selected block.
   * `blockIndexes` are the targets; `updatedBlock` is the primary (draft) block.
   * Only used when `selectedBlockIndexes.length > 1`.
   */
  onSaveBlocks?: (
    updatedBlock: Block,
    blockIndexes: number[],
    customClasses?: string,
    anchorId?: string,
    customStyle?: string
  ) => VisualComposerSaveResult;
  /** Indexes of every block currently selected for batch styling. */
  selectedBlockIndexes?: number[];
  /**
   * The blocks a batch will style, named the way the page names them.
   * A count is not a scope: an operator about to write to several blocks at
   * once can check these before the click rather than after the toast.
   */
  selectedBlockTargets?: readonly { index: number; id?: string; label: string; type: string }[];
  /**
   * How many blocks the batch was opened for. When a block is deleted behind
   * the open panel the live target count drops, and this is the only way to
   * tell a shorter batch from a smaller selection.
   */
  expectedSelectedCount?: number;
  /** Anchor ids other blocks on this page already own. */
  takenAnchorIds?: readonly string[];
  /** Scroll this block into view on the page, without changing the selection. */
  onLocateBlock?: (blockIndex: number) => void;
  /**
   * Move the panel to the previous or next block without closing it.
   *
   * Working down a page used to mean close → find the next block → reopen, with
   * the discard prompt in the middle of the move. Navigation goes through the
   * same guard as closing, so an unapplied draft is still a decision.
   */
  onNavigateBlock?: (direction: 'previous' | 'next') => void;
  /** Whether there is a block before this one in the page. */
  canNavigatePrevious?: boolean;
  /** Whether there is a block after this one in the page. */
  canNavigateNext?: boolean;
  initialMode?: VisualComposerMode;
  /** Initial value of the "keep open after apply" toggle. */
  keepOpenOnApplyInitial?: boolean;
  /**
   * Ask the panel to close through its own unsaved-work guard.
   *
   * The page owns the document and can learn that the blocks underneath the
   * panel are about to be replaced; it cannot see the draft. So it asks with a
   * monotonically increasing token instead of closing directly, and the same
   * guard that Close, Escape and ⌘E use decides what happens: a clean panel
   * closes, a dirty one asks first.
   */
  closeRequest?: number;
  /**
   * Report the unapplied design so the page itself can show it.
   *
   * Called with `null` whenever there is nothing to preview — the draft is
   * clean, the panel closed, or the component unmounted — so the page always
   * has a way back to its own markup. The overlay owns what "preview" means;
   * this panel only says what the draft looks like.
   */
  onPreviewChange?: (draft: ComposerDraftPreview | null) => void;
}

export function VisualComposerInspector({
  open,
  onClose,
  block,
  blockIndex,
  onSaveBlock,
  onSaveBlocks,
  selectedBlockIndexes = [],
  selectedBlockTargets = [],
  expectedSelectedCount = 0,
  takenAnchorIds = [],
  onLocateBlock,
  onNavigateBlock,
  canNavigatePrevious = false,
  canNavigateNext = false,
  initialMode = 'block',
  keepOpenOnApplyInitial = false,
  closeRequest = 0,
  onPreviewChange,
}: VisualComposerInspectorProps) {
  const [inspectorMode, setInspectorMode] = useState<VisualComposerMode>(initialMode);
  const [activeTab, setActiveTab] = useState<VisualComposerTab>('content');
  const [styles, setStyles] = useState<VisualComposerStyles>(DEFAULT_VC_STYLES);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(block);
  const [hasCopiedStyles, setHasCopiedStyles] = useState<boolean>(Boolean(getStylesClipboard()));
  const [isSidesLinked, setIsSidesLinked] = useState<boolean>(true);
  const [previewDevice, setPreviewDevice] = useState<VisualComposerDevice>('desktop');
  const [previewTheme, setPreviewTheme] = useState<ThemeMode>('system');
  const [jsonConfigDraft, setJsonConfigDraft] = useState<string>('');

  /** Whether applying styles keeps the inspector open instead of closing it. */
  const [keepOpenOnApply, setKeepOpenOnApply] = useState(keepOpenOnApplyInitial);

  /** True while the footer is asking whether to throw pending edits away. */
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /**
   * Where a discard prompt would take the panel if it is confirmed.
   *
   * The prompt is the same one closing uses, because the question is the same —
   * it is only the destination that differs: `null` closes the panel, and a
   * direction moves it to the neighbouring block instead.
   */
  const [pendingNavigation, setPendingNavigation] = useState<'previous' | 'next' | null>(null);

  /**
   * The styles the panel opened with, or last handed to the page.
   *
   * Kept as an object, not only as a signature, because the footer names *what*
   * is unsaved and can put one group back; a signature can only say "something".
   */
  const [baseline, setBaseline] = useState<VisualComposerStyles>(() => ({ ...DEFAULT_VC_STYLES }));
  const baselineSignature = useMemo(() => JSON.stringify(baseline), [baseline]);
  const stylesSignature = useMemo(() => JSON.stringify(styles), [styles]);
  const designDirty = stylesSignature !== baselineSignature;

  /**
   * Unsaved work is not only style work.
   *
   * The Content tab edits `currentBlock`, which reaches the page on the same
   * Save click — so typed copy is exactly as losable as a colour, and the guard
   * would be half a guard if it only counted the design controls.
   */
  const blockSignature = useMemo(() => (block ? JSON.stringify(block) : ''), [block]);
  const currentBlockSignature = useMemo(
    () => (currentBlock ? JSON.stringify(currentBlock) : ''),
    [currentBlock]
  );
  const contentDirty = currentBlockSignature !== '' && currentBlockSignature !== blockSignature;
  /**
   * The badge is a design control whose output is markup, not a class.
   *
   * It lives inside the block's HTML, so a badge draft has to reach the page
   * through the copy preview even when not a character of copy changed. Without
   * this the mini preview shows the new ribbon and the page keeps the old one.
   */
  const badgeDirty =
    styles.badgeText !== baseline.badgeText ||
    styles.badgeTone !== baseline.badgeTone ||
    styles.badgePosition !== baseline.badgePosition;
  const dirty = designDirty || contentDirty;

  /**
   * What the draft actually changes, grouped the way an operator thinks.
   *
   * Derived from the same baseline the dirty flag uses, so a chip cannot claim
   * a change the save would not write, or miss one it would.
   */
  const changedGroups = useMemo<VisualComposerStyleChange[]>(() => {
    const groups: VisualComposerStyleChange[] = contentDirty
      ? [{ label: CONTENT_CHANGE_LABEL, fields: ['text'] }]
      : [];
    const byLabel = new Map<string, string[]>();
    for (const { key, label } of VC_STYLE_GROUPS) {
      const before = baseline[key];
      const after = styles[key];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;

      const fields = byLabel.get(label) ?? [];
      if (after !== null && typeof after === 'object' && !Array.isArray(after)) {
        const a = (before ?? {}) as Record<string, unknown>;
        const b = after as Record<string, unknown>;
        for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) {
            fields.push(humanizeField(field));
          }
        }
      }
      byLabel.set(label, fields.length > 0 ? fields : [humanizeField(String(key))]);
    }
    return [...groups, ...[...byLabel].map(([label, fields]) => ({ label, fields }))];
  }, [contentDirty, styles, baseline]);

  /** The panel itself, for focus containment and for returning focus on close. */
  const asideRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  /** Session-only composer history: previous draft snapshots for undo/redo. */
  const [vcHistory, setVcHistory] = useState<{
    past: ComposerSnapshot[];
    future: ComposerSnapshot[];
  }>({ past: [], future: [] });

  const vcHistoryRef = useRef(vcHistory);
  vcHistoryRef.current = vcHistory;

  const stylesRef = useRef(styles);
  stylesRef.current = styles;

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;

  const currentBlockRef = useRef<Block | null>(currentBlock);
  currentBlockRef.current = currentBlock;

  /** The draft as it stood after the last recorded change. */
  const snapshotRef = useRef<ComposerSnapshot>({ styles, block: currentBlock });

  /** When the last content edit landed, so a typing burst is one undo step. */
  const lastContentEditAtRef = useRef(0);

  /**
   * A write has been accepted but its block prop has not arrived yet.
   *
   * The page wraps the block's HTML in the shell it persists, so the prop that
   * comes back is not byte-identical to the draft that was sent. Treating that
   * as unsaved copy would make "Keep editing" greet every successful save with
   * "Unsaved changes" for work that was just written.
   */
  const pendingApplyRef = useRef(false);

  /** The exact draft a write was accepted for; see `pendingApplyRef`. */
  const appliedDraftSignatureRef = useRef<string | null>(null);

  /**
   * Marks a `setStyles` call as a user edit worth recording.
   *
   * The studios write through `updateStyles`; prop-driven sync, undo/redo and
   * the block reset write through `setStyles` directly, so they never enter the
   * history stack. Recording them would make the initial sync of a block
   * undoable and, worse, make the undo itself a new change — which is how redo
   * ends up empty after one undo.
   */
  const userEditRef = useRef(false);
  const updateStyles = useCallback<Dispatch<SetStateAction<VisualComposerStyles>>>((value) => {
    userEditRef.current = true;
    setStyles(value);
  }, []);

  /** The Content tab writes the block, and that edit belongs in the same history. */
  const updateCurrentBlock = useCallback((next: Block) => {
    userEditRef.current = true;
    setCurrentBlock(next);
  }, []);

  /** Put one named group back where the page last agreed it was. */
  const revertChangedGroup = useCallback(
    (label: string) => {
      if (label === CONTENT_CHANGE_LABEL) {
        // The draft copy goes back to the block the page is holding. Through
        // `updateCurrentBlock`, so putting the copy back is itself undoable.
        if (block) updateCurrentBlock(block);
        return;
      }
      const keys = VC_STYLE_GROUPS.filter((group) => group.label === label).map(
        (group) => group.key
      );
      if (keys.length === 0) return;
      // Through `updateStyles`, so the revert is itself undoable.
      updateStyles((prev) => revertKeys(prev, baseline, keys));
    },
    [baseline, block, updateCurrentBlock, updateStyles]
  );

  const isBatchMode = selectedBlockIndexes.length > 1;

  /** The compiled draft, shared by the mini preview and the live page preview. */
  const compiledClassNames = useMemo(
    () => compileClassNames(inspectorMode, styles),
    [inspectorMode, styles]
  );

  /*
   * What the live preview paints: the block under edit, or every target of a
   * batch. A ref plus a string key because `selectedBlockIndexes` arrives as a
   * fresh array on most renders, and an effect keyed on its identity would
   * repaint the page on every keystroke elsewhere in the panel.
   */
  const previewIndexes = isBatchMode
    ? selectedBlockIndexes
    : blockIndex !== null
      ? [blockIndex]
      : [];
  const previewIndexesRef = useRef<number[]>(previewIndexes);
  previewIndexesRef.current = previewIndexes;
  const previewIndexKey = previewIndexes.join(',');
  const previewReporterRef = useRef(onPreviewChange);
  previewReporterRef.current = onPreviewChange;

  /**
   * Section mode themes the row through `section.themeMode`; block mode uses
   * the wrapper's own. Sending the wrong one would preview a theme the save
   * would not write.
   */
  const previewThemeMode =
    inspectorMode === 'section'
      ? (styles.section.themeMode ?? styles.themeMode ?? 'system')
      : (styles.themeMode ?? 'system');

  /**
   * The copy the page should show for this draft.
   *
   * Composed through the same block the save writes, so the sentence, the badge
   * and the markup the operator will get on Apply are one thing rather than two
   * hand-copied shapes. A batch and section mode carry no copy: the batch would
   * otherwise stamp the primary block's text onto every target.
   */
  const previewContentHtml = useMemo(() => {
    if ((!contentDirty && !badgeDirty) || inspectorMode !== 'block' || isBatchMode || !currentBlock)
      return null;
    return blockInnerHtml(serializeBlocks([composeDraftBlock(currentBlock, styles)]));
  }, [contentDirty, badgeDirty, inspectorMode, isBatchMode, currentBlock, styles]);

  /*
   * Report the draft to the page. The cleanup is deliberately not part of this
   * effect: it would fire between two keystrokes, and the page would flash its
   * original design back for a frame before the next one. Clearing is explicit
   * — a clean draft, a closed panel, or unmount.
   *
   * Copy is reported as its own half. A design that has not been touched stays
   * off the page, so retyping a headline shows the new sentence without also
   * applying the editor's default classes to a block nobody restyled.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: previewIndexKey is the trigger; the effect reads the live indexes through a ref so the array's identity cannot repaint the page.
  useEffect(() => {
    const report = previewReporterRef.current;
    if (!report) return;
    if (!open || !dirty) {
      report(null);
      return;
    }
    report({
      mode: inspectorMode,
      blockIndexes: previewIndexesRef.current,
      design: designDirty
        ? {
            classes: compiledClassNames,
            style: styles.customStyle ?? '',
            themeMode: previewThemeMode,
          }
        : null,
      contentHtml: previewContentHtml,
    });
  }, [
    open,
    dirty,
    designDirty,
    inspectorMode,
    compiledClassNames,
    previewIndexKey,
    styles.customStyle,
    previewThemeMode,
    previewContentHtml,
  ]);

  useEffect(
    () => () => {
      previewReporterRef.current?.(null);
    },
    []
  );

  /**
   * Nothing changed, so there is nothing to write.
   *
   * A save here mints a revision identical to the one before it — noise in the
   * page's history and a toast that claims work which did not happen. Batch
   * mode is exempt: its baseline describes one block, so applying untouched
   * controls to the others is a real, deliberate act.
   */
  const applyDisabled = !isBatchMode && !dirty;

  /**
   * Blocks the batch was opened for that are no longer on the page.
   *
   * The selection is held by id, so deleting a block behind the open panel
   * shortens the live list with no signal at all. This is the difference
   * between what the operator chose and what the write will touch.
   */
  const removedTargetCount = Math.max(0, expectedSelectedCount - selectedBlockIndexes.length);

  /** The anchor id being typed is one another block already owns. */
  const anchorIdValue = styles.anchorId.trim();
  const anchorConflict =
    !isBatchMode &&
    anchorIdValue.length > 0 &&
    takenAnchorIds.some((id) => id.toLowerCase() === anchorIdValue.toLowerCase());

  /** The block under edit, as the page names it, for the header readout. */
  const currentBlockLabel = useMemo(
    () => (currentBlock ? sectionLabelForBlock(currentBlock) : ''),
    [currentBlock]
  );

  /** Batch styling is design-only; body copy and code stay per block. */
  const excludedTabs = useMemo<VisualComposerTab[]>(
    () => (isBatchMode ? ['content', 'code'] : []),
    [isBatchMode]
  );
  const visibleTabs = useMemo(
    () => INSPECTOR_TABS.filter((tab) => !excludedTabs.includes(tab.id as VisualComposerTab)),
    [excludedTabs]
  );

  const titleId = useId();
  const descId = useId();
  /** The prefix the tab strip and its panels share, so `aria-controls` resolves. */
  const tabIdBase = useId();
  /** Ref to the first interactive element — "Block Element" mode button — for focus-on-open. */
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  /**
   * The block whose markup was last read into the panel, and that markup.
   *
   * The signature is what distinguishes a genuine page-side change from the
   * parent handing over the same block in a new object. Without it, every
   * re-render would look like an edit and the draft would be rebuilt for no
   * reason.
   */
  const lastSyncedBlockRef = useRef<{ id: string; signature: string } | null>(null);

  /**
   * Designs this panel has written, keyed by block id.
   *
   * A ref rather than state: remembering a design is not a render, and memory
   * must not live in a module-level map. This one dies with the overlay, so it
   * cannot outlive the page whose markup it describes.
   */
  const styleMemoryRef = useRef(new Map<string, ComposerStyleMemory>());

  // Sync block state when props change.
  //
  // A new block is a new editing session: it starts from the markup, so one
  // element's classes, anchor or badge cannot leak onto another. A refreshed
  // prop for the block already on screen is different. The page can re-render
  // it for reasons that have nothing to do with this panel (an autosave, an
  // inline edit, a revision), and anything the operator has changed here and
  // not applied is newer than that refresh — so the panel keeps it. Only a
  // completely pristine draft follows the page. Rebuilding the design on every
  // refresh used to mark those unapplied edits clean, which is exactly the
  // state in which Escape throws them away without asking.
  useEffect(() => {
    if (!block) {
      lastSyncedBlockRef.current = null;
      setCurrentBlock(null);
      return;
    }

    const signature = JSON.stringify(block);
    const previous = lastSyncedBlockRef.current;
    const isNewBlock = previous?.id !== block.id;
    lastSyncedBlockRef.current = { id: block.id, signature };

    if (isNewBlock) {
      pendingApplyRef.current = false;
      setCurrentBlock(block);
      const next = readComposerStylesFromBlock(block, styleMemoryRef.current.get(block.id));
      setBaseline(next);
      setStyles(next);
      return;
    }

    // Same block, same markup: nothing to adopt, nothing to rebuild.
    if (previous.signature === signature) return;

    // This refresh is the page acknowledging the draft just applied — unless
    // the operator typed again in the meantime, in which case their newer copy
    // is not replaced by the page's older one.
    if (pendingApplyRef.current) {
      pendingApplyRef.current = false;
      if (JSON.stringify(currentBlockRef.current) === appliedDraftSignatureRef.current) {
        setCurrentBlock(block);
      }
      appliedDraftSignatureRef.current = null;
      return;
    }

    const contentPristine =
      !currentBlockRef.current || JSON.stringify(currentBlockRef.current) === previous.signature;
    const designPristine =
      JSON.stringify(stylesRef.current) === JSON.stringify(baselineRef.current);

    if (contentPristine && designPristine) {
      setCurrentBlock(block);
      // A pristine draft follows the page — and the page's wrapper now carries
      // the classes this panel wrote, so the memory is what keeps the controls
      // describing the design they describe.
      const next = readComposerStylesFromBlock(block, styleMemoryRef.current.get(block.id));
      setBaseline(next);
      setStyles(next);
      return;
    }

    if (contentPristine) setCurrentBlock(block);
  }, [block]);

  // Sync mode if initialMode prop updates
  useEffect(() => {
    setInspectorMode(initialMode);
  }, [initialMode]);

  // ── Composer session history ─────────────────────────────────────────────
  // Records user changes so the admin can undo/redo within this session. Both
  // halves of the draft are recorded: typed copy reaches the page on the same
  // Save click as a colour, so an Undo that only walked back design would be
  // half an undo. Consecutive typing is coalesced into one step (the textarea
  // owns per-keystroke undo while it has focus). The future stack clears on
  // every new change — classic undo semantics.
  useEffect(() => {
    const previous = snapshotRef.current;
    const stylesChanged = previous.styles !== styles;
    const blockChanged = previous.block !== currentBlock;
    if (!stylesChanged && !blockChanged) return;

    const nextSnapshot: ComposerSnapshot = { styles, block: currentBlock };
    const isUserEdit = userEditRef.current;
    userEditRef.current = false;
    snapshotRef.current = nextSnapshot;
    if (!isUserEdit) return;

    /*
     * A burst of typing is one decision, not forty. The step already on the
     * stack holds the draft from before the burst, which is what an undo should
     * restore; pushing each keystroke would make the first Undo revert a space.
     */
    const contentOnly = !stylesChanged && blockChanged;
    const now = Date.now();
    const coalesce = contentOnly && now - lastContentEditAtRef.current < 700;
    lastContentEditAtRef.current = contentOnly ? now : 0;
    if (coalesce) return;

    setVcHistory((prev) => ({
      past: [...prev.past, previous].slice(-VC_HISTORY_LIMIT),
      future: [],
    }));
  }, [styles, currentBlock]);

  // A new panel session or a different block starts with a clean history. The
  // snapshot is pinned to what is on screen so the sync effect's programmatic
  // update is not recorded as the first undoable change.
  const sessionKey = `${open ? 'open' : 'closed'}:${block?.id ?? 'none'}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionKey is the trigger; the effect deliberately reads only refs.
  useEffect(() => {
    setVcHistory({ past: [], future: [] });
    snapshotRef.current = { styles: stylesRef.current, block: currentBlockRef.current };
    userEditRef.current = false;
    lastContentEditAtRef.current = 0;
    // A pending adoption belongs to the session that saved.
    pendingApplyRef.current = false;
    appliedDraftSignatureRef.current = null;
    // A discard prompt belongs to the session that raised it.
    setConfirmDiscard(false);
    setPendingNavigation(null);
  }, [sessionKey]);

  // Batch mode has no Content or Code tab. If one was active when the operator
  // added a second block to the selection, land on a tab that still exists.
  useEffect(() => {
    if (isBatchMode && excludedTabs.includes(activeTab)) {
      setActiveTab(excludedTabs.includes('content') ? 'presets' : 'design');
    }
  }, [isBatchMode, excludedTabs, activeTab]);

  const handleVcUndo = useCallback(() => {
    const { past, future } = vcHistoryRef.current;
    if (past.length === 0) return;
    const target = past[past.length - 1];
    const current: ComposerSnapshot = { styles: stylesRef.current, block: currentBlockRef.current };
    // Pinning the snapshot means the history effect sees no change to record,
    // so an undo does not wipe the redo stack it is building.
    snapshotRef.current = target;
    userEditRef.current = false;
    lastContentEditAtRef.current = 0;
    setVcHistory({
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, VC_HISTORY_LIMIT),
    });
    setStyles(target.styles);
    setCurrentBlock(target.block);
    toast.success('Change undone');
  }, []);

  const handleVcRedo = useCallback(() => {
    const { past, future } = vcHistoryRef.current;
    if (future.length === 0) return;
    const target = future[0];
    const current: ComposerSnapshot = { styles: stylesRef.current, block: currentBlockRef.current };
    snapshotRef.current = target;
    userEditRef.current = false;
    lastContentEditAtRef.current = 0;
    setVcHistory({
      past: [...past, current].slice(-VC_HISTORY_LIMIT),
      future: future.slice(1),
    });
    setStyles(target.styles);
    setCurrentBlock(target.block);
    toast.success('Change redone');
  }, []);

  const canVcUndo = vcHistory.past.length > 0;
  const canVcRedo = vcHistory.future.length > 0;

  /**
   * Leaving the panel with unapplied edits asks first.
   *
   * The composer is a working surface, not a form: an operator nudges a radius,
   * tries a tone, then reaches for Escape. Silently throwing that away is the
   * one loss this panel can inflict, and it is cheap to make visible instead.
   */
  const requestClose = useCallback(() => {
    if (dirty) {
      // A prompt raised by Close must not move the panel when it is confirmed.
      setPendingNavigation(null);
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  /**
   * A close requested by the page, answered by the operator's own guard.
   *
   * Content can be replaced underneath an open panel — a revision restore, a
   * region becoming the active document, an edit context arriving late. The
   * overlay knows that is about to happen and the panel knows whether the draft
   * is worth keeping, so the overlay asks through this token rather than
   * closing over the draft. Without it, a background load was a silent discard.
   */
  const handledCloseRequestRef = useRef(closeRequest);
  useEffect(() => {
    if (closeRequest === handledCloseRequestRef.current) return;
    handledCloseRequestRef.current = closeRequest;
    if (!open) return;
    requestClose();
  }, [closeRequest, open, requestClose]);

  /**
   * Step to the neighbouring block, asking first if the draft is unsaved.
   *
   * Navigation is a way of leaving the draft behind, so it goes through the
   * same question closing does. Without that, the next-block button would be a
   * one-click discard — the exact loss the close guard exists to prevent.
   */
  const requestNavigation = useCallback(
    (direction: 'previous' | 'next') => {
      if (!onNavigateBlock) return;
      if (dirty) {
        setPendingNavigation(direction);
        setConfirmDiscard(true);
        return;
      }
      setPendingNavigation(null);
      onNavigateBlock(direction);
    },
    [dirty, onNavigateBlock]
  );

  /**
   * Discard means discard: the panel is put back to the state the page last
   * agreed to before it moves on. Otherwise reopening the same block would show
   * the edits the prompt just promised to throw away, and the next Save would
   * quietly write them.
   */
  const handleConfirmDiscard = useCallback(() => {
    snapshotRef.current = { styles: baseline, block };
    userEditRef.current = false;
    lastContentEditAtRef.current = 0;
    setStyles(baseline);
    setCurrentBlock(block);
    setConfirmDiscard(false);
    const direction = pendingNavigation;
    setPendingNavigation(null);
    if (direction) onNavigateBlock?.(direction);
    else onClose();
  }, [baseline, block, onClose, onNavigateBlock, pendingNavigation]);

  const handleDismissDiscard = useCallback(() => {
    setConfirmDiscard(false);
    setPendingNavigation(null);
  }, []);

  /*
   * ⌘E is the shortcut that opened this panel, so it reads as the shortcut to
   * close it — and while the panel is open it must not bypass the panel's own
   * close guard. The overlay listens for the same keys on `window` and would
   * otherwise close directly, throwing away unapplied edits with no prompt.
   * Capturing here runs before that listener can act.
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'e') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, requestClose]);

  // Remember where focus came from, and hand it back on close. A keyboard user
  // who opens the composer and closes it should land where they were, not at
  // the top of the document.
  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      restoreFocusRef.current =
        active instanceof HTMLElement && active !== document.body ? active : null;
      return;
    }
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    target?.focus?.();
  }, [open]);

  // FR-4: Focus the first interactive element when the inspector opens.
  useEffect(() => {
    if (open && firstFocusRef.current) {
      // Defer to let the animation frame complete before stealing focus.
      const timer = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  /*
   * Alt+ArrowLeft / Alt+ArrowRight cycle tabs (block mode only); Alt+ArrowUp /
   * Alt+ArrowDown walk to the previous or next block; Escape asks to close. A
   * panel that covers a third of the screen and ignores Escape is a panel an
   * operator has to hunt a mouse to leave.
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // A portalled menu closes on the same key and owns it first: closing the
        // whole panel underneath an open dropdown would be two intentions on
        // one keystroke.
        const menuOpen = document.querySelector(
          '[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"]'
        );
        if (menuOpen) return;
        e.preventDefault();
        if (confirmDiscard) {
          setConfirmDiscard(false);
          setPendingNavigation(null);
        } else {
          requestClose();
        }
        return;
      }

      if (!e.altKey) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;

      /*
       * Up and down walk the page. A batch has no single "next block" —
       * navigating would leave the selection behind — so it is not offered
       * there, and the shortcut does nothing rather than half a thing.
       */
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!onNavigateBlock || isBatchMode) return;
        e.preventDefault();
        requestNavigation(e.key === 'ArrowUp' ? 'previous' : 'next');
        return;
      }

      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (inspectorMode !== 'block') return;
      e.preventDefault();
      setActiveTab((current) => {
        const idx = visibleTabs.findIndex((t) => t.id === current);
        const next =
          e.key === 'ArrowRight'
            ? visibleTabs[(idx + 1) % visibleTabs.length].id
            : visibleTabs[(idx - 1 + visibleTabs.length) % visibleTabs.length].id;
        return next as typeof current;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    open,
    inspectorMode,
    visibleTabs,
    confirmDiscard,
    requestClose,
    requestNavigation,
    onNavigateBlock,
    isBatchMode,
  ]);

  if (!open || !currentBlock || blockIndex === null) return null;

  const handleApply = () => {
    if (!currentBlock || applyDisabled) return;
    const finalBlock = composeDraftBlock(currentBlock, styles);

    const accepted =
      isBatchMode && onSaveBlocks && selectedBlockIndexes.length > 1
        ? onSaveBlocks(
            finalBlock,
            selectedBlockIndexes,
            compiledClassNames,
            // An anchor id identifies one element. Reusing it across a batch
            // would mint duplicate ids, so batch styling never writes one.
            undefined,
            styles.customStyle?.trim() || undefined
          )
        : onSaveBlock(
            finalBlock,
            compiledClassNames,
            styles.anchorId.trim() || undefined,
            styles.customStyle?.trim() || undefined
          );

    /*
     * A page can refuse the write — a duplicate anchor id is the case this
     * exists for. Closing over that refusal would lose the edits *and* the
     * reason they were refused, so the panel stays exactly as it is.
     */
    if (accepted === false) {
      setConfirmDiscard(false);
      return;
    }

    /*
     * Remember what was written, against every block it was written to. A batch
     * receives one compiled class string, so one memory describes all of them;
     * identity (anchor, badge, code) is re-read from each block's own markup
     * when it is reopened.
     */
    const memory: ComposerStyleMemory = { mode: inspectorMode, styles: cloneStyles(styles) };
    if (currentBlock.id) styleMemoryRef.current.set(currentBlock.id, memory);
    for (const target of selectedBlockTargets) {
      if (target.id) styleMemoryRef.current.set(target.id, memory);
    }

    // The page now holds these styles, so the panel is clean again — which is
    // what makes "Keep editing" a safe way to iterate. The block prop that
    // carries the page's wrapped HTML is adopted when it lands.
    setBaseline(styles);
    // Pin the draft that was sent, so a prop refresh can be recognised as the
    // page's acknowledgement of this write rather than as a new edit.
    setCurrentBlock(finalBlock);
    appliedDraftSignatureRef.current = JSON.stringify(finalBlock);
    pendingApplyRef.current = true;
    setConfirmDiscard(false);

    if (!keepOpenOnApply) {
      onClose();
    }
  };

  /** Leaving for a neighbouring block is still leaving: it asks the same way. */
  const handleNavigate = onNavigateBlock
    ? (direction: 'previous' | 'next') => requestNavigation(direction)
    : undefined;

  /**
   * Composer-local shortcuts. They stop propagation so the overlay's document
   * history (⌘Z) does not also fire: while the inspector is open, ⌘Z means
   * "undo this style change", not "undo the whole page".
   */
  const handleInspectorKeyDown = (e: ReactKeyboardEvent) => {
    const target = e.target as HTMLElement;

    /*
     * Tab is contained by the panel.
     *
     * The composer covers the page while it is open, so letting Tab walk into
     * the content behind it is a way to lose the keyboard entirely: focus lands
     * on something the operator cannot see. Wrapping at both ends is the whole
     * of the containment.
     */
    if (e.key === 'Tab') {
      const root = asideRef.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(INSPECTOR_FOCUSABLE)).filter(
        (el) => !el.closest('[aria-hidden="true"], [hidden]')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || !active || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      }
      return;
    }

    const typing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    /*
     * ⌘S means "save this block" while the panel owns the screen. Without this,
     * the keystroke falls through to the overlay's page save, which commits the
     * page without the draft and reports success for work it did not write.
     */
    if (mod && key === 's') {
      e.preventDefault();
      e.stopPropagation();
      handleApply();
      return;
    }

    if (typing) {
      // Let the field undo its own text; without this the overlay's document
      // history would fire instead and the keystroke would do nothing visible.
      if (mod && (key === 'z' || key === 'y')) e.stopPropagation();
      return;
    }

    if (!mod) return;

    if (key === 'z') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) handleVcRedo();
      else handleVcUndo();
      return;
    }
    if (key === 'y') {
      e.preventDefault();
      e.stopPropagation();
      handleVcRedo();
      return;
    }
    if (key === 'enter') {
      e.preventDefault();
      e.stopPropagation();
      handleApply();
    }
  };

  const handleApplyPreset = (preset: StylePreset) => {
    const applied = preset.apply();
    updateStyles((prev) => ({
      ...prev,
      ...applied,
    }));
    toast.success(`Applied ${preset.name} preset`);
  };

  const handleCopyStyles = () => {
    setStylesClipboard({ ...styles });
    setHasCopiedStyles(true);
    toast.success('Block styles copied to clipboard');
  };

  const handlePasteStyles = () => {
    const cb = getStylesClipboard();
    if (!cb) {
      toast.error('Clipboard is empty. Copy styles from a block first.');
      return;
    }
    updateStyles({ ...cb });
    toast.success('Styles pasted to active block');
  };

  const handleResetStyles = () => {
    /*
     * Reset the design, not the block's identity. `DEFAULT_VC_STYLES` has an
     * empty anchor and no custom code, so applying it wholesale would delete an
     * in-page link target and hand-written CSS — two things the Code tab owns
     * and this button does not claim to.
     */
    updateStyles((prev) => ({
      ...DEFAULT_VC_STYLES,
      // An anchor id is a link target, not a look. Clearing it here would break
      // every in-page link that points at the block, silently.
      anchorId: prev.anchorId,
    }));
    toast.success('Design reset — anchor id kept');
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(styles, null, 2);
    setJsonConfigDraft(jsonStr);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(jsonStr)
        .then(() => {
          toast.success('Design configuration copied to clipboard as JSON');
        })
        .catch(() => {
          toast.success('Design configuration generated in Code tab');
        });
    } else {
      toast.success('Design configuration generated in Code tab');
    }
  };

  const handleImportJson = (rawJson?: unknown) => {
    const toParse = typeof rawJson === 'string' ? rawJson : jsonConfigDraft;
    if (!toParse || typeof toParse !== 'string' || !toParse.trim()) {
      toast.error('Please paste valid JSON configuration first');
      return;
    }
    try {
      const parsed = JSON.parse(toParse);
      if (typeof parsed === 'object' && parsed !== null) {
        updateStyles((prev) => ({
          ...prev,
          ...parsed,
          section: { ...prev.section, ...parsed.section },
          typography: { ...prev.typography, ...parsed.typography },
          border: { ...prev.border, ...parsed.border },
          background: { ...prev.background, ...parsed.background },
          layout: { ...prev.layout, ...parsed.layout },
          effects: { ...prev.effects, ...parsed.effects },
          motion: { ...prev.motion, ...parsed.motion },
          transform: { ...prev.transform, ...parsed.transform },
          responsive: { ...prev.responsive, ...parsed.responsive },
        }));
        toast.success('Design configuration imported successfully');
      }
    } catch {
      toast.error('Invalid JSON design format');
    }
  };

  // Helper to cycle margin values
  const cycleMarginValue = (
    current: string,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): string => {
    const sequence =
      axis === 'horizontal'
        ? ['', 'mx-2', 'mx-4', 'mx-6', 'mx-auto']
        : ['', 'my-2', 'my-4', 'my-6', 'my-8', 'my-12'];
    const idx = sequence.indexOf(current);
    return sequence[(idx + 1) % sequence.length] || '';
  };

  // Helper to cycle padding values
  const cyclePaddingValue = (
    current: string,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): string => {
    const sequence =
      axis === 'horizontal'
        ? ['', 'px-2', 'px-4', 'px-6', 'px-8', 'px-12']
        : ['', 'p-2', 'p-4', 'p-6', 'p-8', 'p-12'];
    const idx = sequence.indexOf(current);
    return sequence[(idx + 1) % sequence.length] || '';
  };

  return (
    <aside
      ref={asideRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      onKeyDown={handleInspectorKeyDown}
      className="fixed inset-y-0 right-0 z-[10010] flex w-full max-w-md flex-col border-l border-white/20 bg-slate-950/95 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right duration-200 pointer-events-auto"
    >
      {/* Drawer Header & Mode Switcher */}
      <InspectorHeader
        titleId={titleId}
        descId={descId}
        blockIndex={blockIndex}
        blockType={currentBlock.type}
        inspectorMode={inspectorMode}
        setInspectorMode={setInspectorMode}
        hasCopiedStyles={hasCopiedStyles}
        onCopyStyles={handleCopyStyles}
        onPasteStyles={handlePasteStyles}
        onResetStyles={handleResetStyles}
        onClose={requestClose}
        firstFocusRef={firstFocusRef}
        isBatchMode={isBatchMode}
        selectedCount={selectedBlockIndexes.length}
        blockLabel={currentBlockLabel}
        onLocate={onLocateBlock ? () => onLocateBlock(blockIndex) : undefined}
        onNavigate={isBatchMode ? undefined : handleNavigate}
        canNavigatePrevious={canNavigatePrevious}
        canNavigateNext={canNavigateNext}
      />

      {/*
        The page is the preview now. Say so while the draft is live, and say
        the part that matters: this is a draft, not a write. An operator who does
        not know the difference is one Esc away from a scare they did not earn.
        The last sentence is the honest part: the preview paints copy, classes,
        inline theme and the badge, but inline CSS on a block that will be
        wrapped, and the anchor id, only exist after the save.

        The gate is "something is painted", not "something is dirty". A copy
        draft on markup with no single root has nothing to paint, and a banner
        that claimed otherwise would be the bug this line exists to avoid.
      */}
      {(designDirty || previewContentHtml !== null) && onPreviewChange ? (
        <p
          data-testid="composer-live-preview-status"
          className="flex items-center gap-1.5 border-b border-emerald-400/20 bg-emerald-500/[0.07] px-5 py-1.5 text-[10px] font-semibold text-emerald-200"
        >
          <Eye size={11} className="shrink-0" aria-hidden="true" />
          <span>
            Previewing on the page — nothing is saved until you apply. Inline CSS and anchor id
            apply on save.
          </span>
        </p>
      ) : null}

      {/* A batch that lost a block says so, instead of quietly styling fewer. */}
      {removedTargetCount > 0 ? (
        <p
          role="status"
          className="flex items-start gap-1.5 border-b border-rose-400/30 bg-rose-500/10 px-5 py-2 text-[10px] leading-relaxed text-rose-200"
        >
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>
            {removedTargetCount === 1
              ? '1 of the blocks you chose is'
              : `${removedTargetCount} of the blocks you chose are`}{' '}
            no longer on the page and will not be styled.
          </span>
        </p>
      ) : null}

      {/* Batch styling applies design controls only: the content and code tabs
          are hidden, and this says why rather than leaving a silent omission. */}
      {isBatchMode ? (
        <div className="border-b border-accent-gold/20 bg-accent-gold/[0.06] px-5 py-2 text-[10px] leading-relaxed text-accent-gold">
          <p>
            Batch styling applies design controls to all {selectedBlockIndexes.length} blocks. Each
            block keeps its own copy, anchor id and code.
          </p>

          {/* The scope, not merely the size of it. */}
          {selectedBlockTargets.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Blocks this batch will style">
              {selectedBlockTargets.slice(0, 4).map((target) => (
                <li
                  key={target.index}
                  data-testid="batch-target"
                  className="inline-flex max-w-[190px] items-center gap-1 rounded-full border border-accent-gold/30 bg-slate-950/40 px-2 py-0.5"
                >
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-accent-gold/80">
                    {target.type}
                  </span>
                  <span className="truncate text-[10px] text-slate-200">{target.label}</span>
                </li>
              ))}
              {selectedBlockTargets.length > 4 ? (
                <li className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  +{selectedBlockTargets.length - 4} more
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Tabs Navigation (Block Mode) */}
      {inspectorMode === 'block' && (
        <InspectorTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          excludedTabs={excludedTabs}
          idBase={tabIdBase}
        />
      )}

      {/* Live Mini Preview Box with Responsive Viewport Device Switcher */}
      <DevicePreviewFrame
        inspectorMode={inspectorMode}
        previewDevice={previewDevice}
        setPreviewDevice={setPreviewDevice}
        previewTheme={previewTheme}
        setPreviewTheme={setPreviewTheme}
        compiledClassNames={compiledClassNames}
        currentBlock={currentBlock}
        styles={styles}
      />

      {/* Tab Content Panels */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* ── Section / Row Mode Settings ───────────────────────────────── */}
        {inspectorMode === 'section' && (
          <SectionStudio
            styles={styles}
            setStyles={updateStyles}
            compiledClassNames={compiledClassNames}
          />
        )}

        {/* ── Block Mode Tabs ─────────────────────────────────────────── */}
        {inspectorMode === 'block' && (
          <>
            <ComposerTabPanel idBase={tabIdBase} tab="content" activeTab={activeTab}>
              <BlockContentStudio
                currentBlock={currentBlock}
                setCurrentBlock={updateCurrentBlock}
              />
            </ComposerTabPanel>

            <ComposerTabPanel idBase={tabIdBase} tab="presets" activeTab={activeTab}>
              <PresetStudio
                onApplyPreset={handleApplyPreset}
                styles={styles}
                setStyles={updateStyles}
              />
            </ComposerTabPanel>

            <ComposerTabPanel idBase={tabIdBase} tab="design" activeTab={activeTab}>
              <BoxModelStudio
                styles={styles}
                setStyles={updateStyles}
                currentBlock={currentBlock}
                isSidesLinked={isSidesLinked}
                setIsSidesLinked={setIsSidesLinked}
                cycleMarginValue={cycleMarginValue}
                cyclePaddingValue={cyclePaddingValue}
              />
            </ComposerTabPanel>

            <ComposerTabPanel idBase={tabIdBase} tab="typography" activeTab={activeTab}>
              <TypographyStudio styles={styles} setStyles={updateStyles} />
            </ComposerTabPanel>

            <ComposerTabPanel idBase={tabIdBase} tab="code" activeTab={activeTab}>
              <CodeStudio
                currentBlock={currentBlock}
                setCurrentBlock={setCurrentBlock}
                styles={styles}
                setStyles={updateStyles}
                customStyleInputId="block-custom-style-input"
                jsonConfigDraft={jsonConfigDraft}
                setJsonConfigDraft={setJsonConfigDraft}
                onExportJson={handleExportJson}
                onImportJson={handleImportJson}
              />
            </ComposerTabPanel>

            <ComposerTabPanel idBase={tabIdBase} tab="advanced" activeTab={activeTab}>
              {/*
                Say it while the id is being typed. The save guard still refuses
                the write; this is the warning that makes the refusal a surprise
                avoided rather than a click that did nothing.
              */}
              {anchorConflict ? (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200"
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>#{anchorIdValue}</strong> is already used by another block on this page.
                    Duplicate ids break in-page links — pick a different anchor id.
                  </span>
                </p>
              ) : null}

              {/*
                An anchor id identifies one element, so a batch never writes one.
                Offering the field anyway would invite a change that is silently
                dropped on apply; the field is absent and the reason is stated.
              */}
              {isBatchMode ? (
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] leading-relaxed text-slate-300">
                  Anchor ids identify one block, so they stay per block and are not part of a batch.
                </p>
              ) : null}

              <AdvancedMotionStudio
                styles={styles}
                setStyles={updateStyles}
                anchorIdInputId={isBatchMode ? undefined : 'block-anchor-id-input'}
                compiledClassNames={compiledClassNames}
              />
            </ComposerTabPanel>
          </>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <InspectorFooter
        inspectorMode={inspectorMode}
        onResetStyles={handleResetStyles}
        onClose={requestClose}
        onApply={handleApply}
        applyDisabled={applyDisabled}
        isBatchMode={isBatchMode}
        selectedCount={selectedBlockIndexes.length}
        keepOpenOnApply={keepOpenOnApply}
        onToggleKeepOpen={() => setKeepOpenOnApply((prev) => !prev)}
        onUndo={handleVcUndo}
        onRedo={handleVcRedo}
        canUndo={canVcUndo}
        canRedo={canVcRedo}
        dirty={dirty}
        changedGroups={changedGroups}
        onRevertGroup={revertChangedGroup}
        confirmDiscard={confirmDiscard}
        onConfirmDiscard={handleConfirmDiscard}
        onDismissDiscard={handleDismissDiscard}
      />
    </aside>
  );
}
