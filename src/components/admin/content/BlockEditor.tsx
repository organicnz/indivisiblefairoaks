'use client';

import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  type Block,
  type CalloutTone,
  cloneBlockWithFreshIds,
  isTextualBlock,
  nextBlockId,
  stripTags,
} from '@/lib/blocks';
import {
  type BlockKind,
  definitionFor,
  searchBlocks,
} from './block-definitions';
import { SlashMenu } from './SlashMenu';
import { BlockBody } from './BlockBody';
import { RowBlockCard } from './RowBlockCard';

interface Props {
  blocks: Block[];
  /**
   * `intent` is how the change should be grouped for undo: a string coalesces
   * consecutive edits of the same run, `null` makes it a step of its own.
   *
   * Only the editor knows which is which. A model update looks identical whether
   * it came from a keystroke or from the author deleting a block, and the parent
   * cannot guess — so an omitted intent is a discrete change, which is the safe
   * default: it can only mean "undo steps too fine", never "undo swallowed a
   * block you deleted".
   */
  onChange: (blocks: Block[], intent?: string | null) => void;
  /**
   * Where this document's visual composer opens, or null before the page has
   * been saved once.
   *
   * A row is a layout container and the only block this editor cannot edit: its
   * columns and nested blocks live in the composer. The dependency is passed in
   * rather than built here because the composer address is a property of the
   * document (a copy region opens its host page), not of the block.
   */
  composeHref?: string | null;
}


/** Debounce is short enough to feel live and long enough not to thrash re-renders. */
const INPUT_DEBOUNCE_MS = 120;

/**
 * Fold a set of pending keystrokes into a block array. Pure, and module-level so
 * the debounce, the structural operations and the tests all agree on it.
 */
function applyPendingHtml(base: Block[], updates: Map<string, string>): Block[] {
  if (updates.size === 0) return base;
  let next = base;
  for (const [id, html] of updates) {
    next = next.map((b) => (b.id === id ? ({ ...b, html } as Block) : b));
  }
  return next;
}

/**
 * The undo intent for one burst of keystrokes.
 *
 * Field-scoped, so typing in two blocks never merges into one undo step. Sorted
 * so the key describes the *set* of blocks rather than the order they were
 * clicked in, and — deliberately — so that a single block yields exactly
 * `type:<id>`, byte-identical to the key used before this became a map. That
 * keeps a continuous run of typing in one block coalescing into one undo step.
 */
function burstIntent(ids: Iterable<string>): string {
  return `type:${[...ids].sort().join(',')}`;
}

export function BlockEditor({ blocks, onChange, composeHref = null }: Props) {
  const [slash, setSlash] = useState<{
    index: number;
    query: string;
    top: number;
    left: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // The popover belongs to one block, so track which: a single shared boolean
  // would open the toolbar on whichever block happened to render first.
  const [linkEditorBlockId, setLinkEditorBlockId] = useState<string | null>(null);
  /**
   * Drag-to-reorder. `dragIndex` is the block being moved and `dropIndex` is
   * where it would land. The previous build rendered a grip icon inside a
   * decorative <span> — it looked draggable and did nothing, which is the
   * "no fake controls" rule in its purest form. The up/down buttons remain as
   * the keyboard path, because a drag handle is not reachable by keyboard and
   * reordering has to work for everyone.
   */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  /** Last HTML written into each block DOM, so input events that changed nothing
   *  do not push a new model value (and therefore a new revision) upstream. */
  const domHtml = useRef(new Map<string, string>());
  /**
   * The author's text selection, stashed before a toolbar popover takes focus.
   * Focusing an input collapses the Selection, so a link applied from a popover
   * would otherwise wrap nothing and insert the URL at the caret instead of the
   * words that were highlighted.
   */
  const savedRange = useRef<Range | null>(null);

  // ── DOM <-> model bridge ────────────────────────────────────────────────
  // Each block owns a contenteditable element. React renders the list once and
  // from then on the DOM is the source of truth while typing; React only
  // intervenes for structural changes (reorder, convert, delete). Re-rendering
  // a contenteditable from React mid-keystroke is what makes naive editors drop
  // the caret, so the inner HTML is never bound through JSX.

  const blockRefs = useRef(new Map<string, HTMLElement>());

  /**
   * A keystroke reaches the DOM instantly and the model on a debounce, so between
   * the two there are two candidate documents: `committed` is what the model
   * holds, `pendingHtml` is every keystroke not yet folded into it.
   *
   * **Every structural operation reads `liveBlocks()`, never the `blocks`
   * prop.** That single rule is what makes type-then-Enter safe, and it is not
   * an optimisation. The previous code shared one `setTimeout` across all
   * blocks and closed over the `blocks` array captured when the keystroke was
   * rendered, which failed three ways at once:
   *
   *   - typing in block A then block B inside one window *cancelled* A's
   *     flush, so A's last characters never reached the model;
   *   - pressing Enter inside the window fired an insert, and the pending flush
   *     then wrote the pre-Enter array back through `onChange` — silently
   *     deleting the paragraph the caret had just been moved into;
   *   - converting, duplicating or splitting a block read the stale `html` and
   *     carried across text the author could see but the model had not.
   *
   * Type-then-Enter is the single most common action in a block editor, so this
   * was the most common way to lose a sentence.
   */
  const committed = useRef<Block[]>(blocks);
  const pendingHtml = useRef(new Map<string, string>());
  const inputTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    committed.current = blocks;
  }, [blocks]);

  /** The model with every unflushed keystroke folded in. The only array to build from. */
  const liveBlocks = useCallback((): Block[] => {
    if (pendingHtml.current.size === 0) return committed.current;
    return applyPendingHtml(committed.current, pendingHtml.current);
  }, []);

  /** Detach the pending edits. Silent — the caller decides whether to emit them. */
  const takePending = useCallback((): Map<string, string> => {
    if (inputTimer.current) {
      clearTimeout(inputTimer.current);
      inputTimer.current = null;
    }
    const updates = new Map(pendingHtml.current);
    pendingHtml.current = new Map();
    return updates;
  }, []);

  /**
   * Run a structural operation against the live document.
   *
   * The pending keystrokes are folded into the base *without* a second
   * `onChange`. They are not separate history entries because they are not a
   * separate render: React batches the whole event, so from the model's point of
   * view this is one atomic transition. Emitting them separately would produce
   * two `onChange` calls whose second argument — the undo intent — is a single
   * ref, and the last writer would silently relabel the other's entry.
   */
  const structural = useCallback(
    (build: (current: Block[]) => Block[], intent: string | null = null): Block[] => {
      const base = applyPendingHtml(committed.current, takePending());
      const next = build(base);
      onChange(next, intent);
      return next;
    },
    [onChange, takePending]
  );

  /**
   * The writer half of the debounce, and the counterpart to `liveBlocks()`.
   *
   * A keystroke is recorded into `pendingHtml` and flushed up to
   * `INPUT_DEBOUNCE_MS` later. One shared timer is deliberate: the flush commits
   * *every* pending block in a single `onChange`, so a burst that spans two
   * blocks is one atomic model transition and one undo step. The old code
   * shared a timer but flushed only the last block, so the second block's
   * keystroke cancelled the first block's flush and silently dropped it.
   */
  const scheduleUpdate = (block: Block, html: string) => {
    pendingHtml.current.set(block.id, html);
    if (inputTimer.current) clearTimeout(inputTimer.current);
    inputTimer.current = setTimeout(() => {
      const updates = takePending();
      if (updates.size === 0) return;
      // Every block named in the intent, so two bursts touching different
      // blocks are never collapsed into a single undo entry while a run of
      // typing in one block stays one entry.
      onChange(applyPendingHtml(committed.current, updates), burstIntent(updates.keys()));
    }, INPUT_DEBOUNCE_MS);
  };

  // A pending flush must never survive the editor. Committing it during unmount
  // would call `onChange` on a parent that has already dropped the document, and
  // could resurrect a block the author had deleted on the way out.
  useEffect(
    () => () => {
      if (inputTimer.current) clearTimeout(inputTimer.current);
    },
    []
  );

  const registerBlock = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) blockRefs.current.set(id, el);
      else blockRefs.current.delete(id);
    },
    []
  );

  /** Push model HTML into the DOM for one block, leaving the caret alone when possible. */
  const writeBlockDom = useCallback((block: Block) => {
    const el = blockRefs.current.get(block.id);
    if (!el) return;
    const next = isTextualBlock(block) ? block.html : '';
    if (el.innerHTML === next) return;
    // The early return above is what protects the caret: while typing, the DOM
    // already holds the new value, so a model round trip is a no-op. innerHTML is
    // only ever replaced when the value genuinely differs, which happens on a
    // structural change (convert, duplicate) and never mid-keystroke.
    el.innerHTML = next;
    domHtml.current.set(block.id, next);
  }, []);

  // Sync the DOM whenever the model changes structurally.
  useLayoutEffect(() => {
    for (const block of blocks) {
      if (isTextualBlock(block)) writeBlockDom(block);
    }
    const live = new Set(blocks.map((b) => b.id));
    for (const id of domHtml.current.keys()) {
      if (!live.has(id)) domHtml.current.delete(id);
    }
  }, [blocks, writeBlockDom]);

  useEffect(() => {
    const wanted = pendingFocus.current;
    if (!wanted) return;
    // Only focus a block that survived the update. A block removed in the same
    // tick (Enter on a list's last empty item, say) must not steal the caret.
    if (!blocks.some((b) => b.id === wanted)) return;
    pendingFocus.current = null;
    const el = blockRefs.current.get(wanted);
    if (!el) return;
    el.focus();
    placeCaretAtEnd(el);
  }, [blocks]);

  const update = useCallback(
    (id: string, patch: Partial<Block>, intent: string | null = null) => {
      structural(
        (current) => current.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
        intent
      );
    },
    [structural]
  );

  // ── Block construction ──────────────────────────────────────────────────
  const makeBlock = useCallback((kind: BlockKind, tone: CalloutTone = 'info'): Block => {
    const id = nextBlockId();
    switch (kind) {
      case 'paragraph':
        return { id, type: 'paragraph', html: '' };
      case 'heading':
        return { id, type: 'heading', level: 2, html: '' };
      case 'bulletList':
        return { id, type: 'bulletList', items: [''] };
      case 'orderedList':
        return { id, type: 'orderedList', items: [''] };
      case 'quote':
        return { id, type: 'quote', html: '' };
      case 'callout':
        return { id, type: 'callout', tone, html: '' };
      case 'code':
        return { id, type: 'code', text: '' };
      case 'image':
        return { id, type: 'image', src: '', alt: '', caption: '', width: null, height: null };
      case 'divider':
        return { id, type: 'divider' };
      case 'table':
        return { id, type: 'table', head: ['Column 1', 'Column 2'], rows: [['', '']] };
      case 'button':
        return { id, type: 'button', label: 'Learn more', href: '/contact' };
    }
  }, []);

  const insertAt = useCallback(
    (index: number, block: Block) => {
      structural((current) => {
        const next = [...current];
        next.splice(index, 0, block);
        return next;
      });
      return block;
    },
    [structural]
  );

  const removeAt = useCallback(
    (index: number) => {
      const removed = structural((current) => {
        const next = current.filter((_, i) => i !== index);
        // Never leave the document with zero blocks — the author would have
        // nowhere to click and typing would do nothing.
        return next.length ? next : [{ id: nextBlockId(), type: 'paragraph', html: '' } as Block];
      });
      const fallback = removed[Math.min(index, removed.length - 1)];
      if (fallback) pendingFocus.current = fallback.id;
    },
    [structural]
  );

  /** Move a block to an absolute position. Shared by the drag and the buttons. */
  const moveTo = useCallback(
    (from: number, to: number) => {
      const latest = liveBlocks();
      if (to < 0 || to >= latest.length || from === to) return;
      structural((current) => {
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
    [structural, liveBlocks]
  );

  const move = useCallback(
    (index: number, delta: number) => {
      const latest = liveBlocks();
      const target = index + delta;
      if (target < 0 || target >= latest.length) return;
      moveTo(index, target);
    },
    [liveBlocks, moveTo]
  );

  const duplicateAt = useCallback(
    (index: number) => {
      const source = liveBlocks()[index];
      if (!source) return;
      // Fired from `liveBlocks()`, so the copy carries the words just typed
      // rather than the ones last saved. A row needs ids all the way down:
      // shallow-copying it gives the duplicate's columns and nested blocks the
      // original's addresses, which is the aliasing `cloneBlockWithFreshIds`
      // exists to prevent.
      const copy = cloneBlockWithFreshIds(source);
      structural((current) => {
        const next = [...current];
        next.splice(index + 1, 0, copy);
        return next;
      });
    },
    [structural, liveBlocks]
  );

  const convert = useCallback(
    (index: number, kind: BlockKind, tone: CalloutTone = 'info') => {
      const current = liveBlocks()[index];
      if (!current) return;
      // A row is a layout, not a leaf: converting it here would replace its
      // columns with a single paragraph. Every control that reaches this
      // function is hidden for a row, and this guard keeps a future one from
      // making the destructive path reachable again.
      if (current.type === 'row') return;
      const replacement = makeBlock(kind, tone);
      // Carry the author's words across the conversion — losing them because
      // they pressed the wrong arrow key is the fastest way to lose trust.
      // Sourced from `liveBlocks()`: converting inside the debounce window used
      // to carry the last *saved* words and silently revert what was on screen.
      if (isTextualBlock(current) && isTextualBlock(replacement)) {
        (replacement as { html: string }).html = current.html;
      }
      structural((current_) => {
        const next = [...current_];
        next[index] = replacement;
        return next;
      });
      pendingFocus.current = replacement.id;
      setSlash(null);
    },
    [structural, liveBlocks, makeBlock]
  );

  // ── Slash menu ──────────────────────────────────────────────────────────
  const openSlash = useCallback(
    (index: number) => {
      const el = blockRefs.current.get(liveBlocks()[index]?.id ?? '');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSlash({
        index,
        query: '',
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 320),
      });
      setActiveIndex(0);
    },
    [liveBlocks]
  );

  const applySlashChoice = useCallback(
    (def: { kind: BlockKind; tones?: readonly { tone: CalloutTone }[] }) => {
      if (!slash) return;
      const tone = def.tones?.[0]?.tone ?? 'info';
      const current = liveBlocks()[slash.index];
      // Typing "/quote" in an empty paragraph means "turn this line into a
      // quote", not "insert a second quote below it".
      if (current && current.type === 'paragraph' && stripTags(current.html).trim() === '') {
        convert(slash.index, def.kind, tone);
      } else {
        const created = insertAt(slash.index + 1, makeBlock(def.kind, tone));
        pendingFocus.current = created.id;
        setSlash(null);
      }
    },
    [liveBlocks, convert, insertAt, makeBlock, slash]
  );

  const closeSlash = useCallback(() => setSlash(null), []);

  // ── Keyboard handling ───────────────────────────────────────────────────

  const onEditableKeyDown = (event: KeyboardEvent<HTMLElement>, block: Block, index: number) => {
    // Escape closes the menu without touching the document. The rest of the
    // menu's keys are handled inside `SlashMenu` itself — see the note there on
    // why they cannot live here: opening the menu moves focus into the search
    // input, so a handler bound to this element would never see them.
    if (event.key === 'Escape' && slash) {
      event.preventDefault();
      closeSlash();
      return;
    }

    const isEmpty = isTextualBlock(block) && stripTags(block.html).trim() === '';

    if (event.key === 'Enter' && !event.shiftKey) {
      // In a list, Enter makes the next item and Enter on the last empty item
      // exits the list — the behaviour every word processor has trained people on.
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        event.preventDefault();
        const items = [...block.items];
        const last = items.length - 1;
        const caretInLast = isCaretInLastListItem(event.currentTarget as HTMLElement);
        if (caretInLast && stripTags(items[last] ?? '').trim() === '') {
          const next = [...blocks];
          next.splice(index + 1, 0, { id: nextBlockId(), type: 'paragraph', html: '' });
          onChange(next);
          pendingFocus.current = next[index + 1].id;
          return;
        }
        items.push('');
        update(block.id, { items } as Partial<Block>);
        focusLastListItem(event.currentTarget as HTMLElement);
        return;
      }

      if (isTextualBlock(block)) {
        event.preventDefault();
        const created = insertAt(index + 1, { id: nextBlockId(), type: 'paragraph', html: '' });
        pendingFocus.current = created.id;
        return;
      }
    }

    if (event.key === 'Backspace' && isEmpty) {
      // Backspace on an empty block removes it and returns the caret upward,
      // rather than leaving an invisible gap.
      event.preventDefault();
      removeAt(index);
      return;
    }

    // Ctrl/Cmd+K: the keyboard route to a link, since the toolbar route needs a
    // pointer selection. Stash the selection before the popover takes focus.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      stashSelection();
      setLinkEditorBlockId(block.id);
      return;
    }

    if (event.key === '/' && !slash && isEmpty) {
      const target = event.currentTarget as HTMLElement;
      const text = target.textContent ?? '';
      // Only open when "/" starts the line, so "and/or" does not pop the menu.
      if (text.trim() === '' || text === '/') {
        event.preventDefault();
        if (text === '/') target.textContent = '';
        openSlash(index);
      }
    }
  };

  const handleInput = (event: FormEvent<HTMLElement>, block: Block) => {
    const el = event.currentTarget;
    const html = el.innerHTML;
    if (domHtml.current.get(block.id) === html) return;
    domHtml.current.set(block.id, html);
    scheduleUpdate(block, html);
  };

  const stashSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0)
      savedRange.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const range = savedRange.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const applyInline = (command: string, value?: string) => {
    // execCommand is deprecated but remains the only cross-browser way to apply
    // inline marks across an arbitrary Range without shipping a full rich-text
    // engine. The deprecated API is stable in every engine we target; the
    // alternative is a dependency, which this project does not take.
    document.execCommand(command, false, value);
    stashSelection();
  };

  const slashResults = slash ? searchBlocks(slash.query) : [];

  return (
    <div ref={containerRef} className="space-y-1">
      <ul aria-label="Page content blocks" className="m-0 list-none p-0">
        {blocks.map((block, index) => {
          const isRow = block.type === 'row';
          const def = definitionFor(
            (block.type === 'unsupported' || isRow ? 'paragraph' : block.type) as BlockKind
          );
          const reorderLabel = isRow ? 'row' : def.label;
          return (
            <li
              key={block.id}
              className={`group relative rounded-xl border px-2 py-1 transition-colors focus-within:border-border ${
                dropIndex === index && dragIndex !== index
                  ? 'border-primary bg-blue-50'
                  : 'border-transparent hover:border-border'
              } ${dragIndex === index ? 'opacity-40' : ''}`}
              data-block-type={block.type}
              onDragOver={(e) => {
                if (dragIndex === null || dragIndex === index) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropIndex(index);
              }}
              onDragLeave={() => {
                if (dropIndex === index) setDropIndex(null);
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                moveTo(dragIndex, index);
                setDragIndex(null);
                setDropIndex(null);
              }}
            >
              {/*
                Block chrome.

                `hover-capable:` gates the reveal. Tailwind v4's `group-hover` is
                `@media (hover: hover)` underneath, so on a touch device the whole
                row stayed at `opacity: 0` while remaining clickable and still in
                the tab order — invisible controls an author could hit by accident
                and had to Tab to with no visual feedback. Reveal on hover-capable devices
                only, and on focus-within for everyone.

                `focus-within` is also what makes the drag grip reachable: it is
                inside this row, so without it a keyboard user would Tab to a
                button they cannot see.
              */}
              <div className="absolute -left-1 top-1 flex items-center gap-0.5 transition-opacity focus-within:opacity-100 hover-capable:opacity-0 hover-capable:group-hover:opacity-100">
                {/* A row has no leaf editor. The slash menu converts the block
                    it opened on, so offering it here would replace the whole
                    layout with a paragraph in one click. */}
                {!isRow && (
                  <button
                    type="button"
                    onClick={() => openSlash(index)}
                    aria-label="Insert or change block"
                    title="Add or change block"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(index);
                    e.dataTransfer.effectAllowed = 'move';
                    // Firefox will not start a drag without payload.
                    e.dataTransfer.setData('text/plain', block.id);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onKeyDown={(e) => {
                    // The handle is focusable, so it has to work from the
                    // keyboard too. Alt+Arrow is the conventional pairing and
                    // does not collide with the caret-moving arrows.
                    if (!e.altKey) return;
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      moveTo(index, index - 1);
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      moveTo(index, index + 1);
                    }
                  }}
                  aria-label={`Reorder ${reorderLabel} block`}
                  aria-describedby="block-reorder-help"
                  title="Drag to reorder, or Alt+Arrow Up/Down"
                  className="cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
              </div>

              {/* Same hover-capable gate and focus-within escape as the left cluster. */}
              <div className="absolute -right-1 top-1 flex items-center gap-0.5 transition-opacity focus-within:opacity-100 hover-capable:opacity-0 hover-capable:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move block up"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary dark:hover:text-primary-on-dark disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                  aria-label="Move block down"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary dark:hover:text-primary-on-dark disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateAt(index)}
                  aria-label="Duplicate block"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
                <ConfirmAction
                  label="Delete block"
                  message={`Delete ${block.type === 'row' ? 'Row' : block.type === 'unsupported' ? 'Block' : (definitionFor(block.type)?.label || 'Block')}?`}
                  confirmLabel="Delete"
                  cancelLabel="Cancel"
                  danger
                  idleClassName="rounded-md p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  onConfirm={() => removeAt(index)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </ConfirmAction>
              </div>

              {block.type === 'row' ? (
                <RowBlockCard block={block} composeHref={composeHref} />
              ) : (
                <BlockBody
                  block={block}
                  index={index}
                  registerRef={registerBlock}
                  onInput={handleInput}
                  onKeyDown={onEditableKeyDown}
                  onUpdate={update}
                  onApplyInline={applyInline}
                  onOpenLinkEditor={() => setLinkEditorBlockId(block.id)}
                  onCloseLinkEditor={() => setLinkEditorBlockId(null)}
                  linkEditorOpen={linkEditorBlockId === block.id}
                  restoreSelection={restoreSelection}
                  onPickBlock={(kind, tone) => convert(index, kind, tone)}
                />
              )}
            </li>
          );
        })}
      </ul>

      <p id="block-reorder-help" className="sr-only">
        Drag the handle to move this block, or focus it and press Alt with the up or down arrow key.
      </p>

      {slash && (
        <SlashMenu
          query={slash.query}
          results={slashResults}
          activeIndex={activeIndex}
          position={{ top: slash.top, left: slash.left }}
          onPick={applySlashChoice}
          onQueryChange={(query) => setSlash((s) => (s ? { ...s, query } : s))}
          onActiveIndexChange={setActiveIndex}
          onClose={closeSlash}
        />
      )}

      <button
        type="button"
        onClick={() => {
          const created = insertAt(blocks.length, {
            id: nextBlockId(),
            type: 'paragraph',
            html: '',
          });
          pendingFocus.current = created.id;
        }}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus size={16} aria-hidden="true" />
        Add a block
      </button>
    </div>
  );
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function isCaretInLastListItem(el: HTMLElement): boolean {
  const items = el.querySelectorAll('li');
  if (items.length === 0) return true;
  const selection = window.getSelection();
  if (!selection?.anchorNode) return true;
  return !!items[items.length - 1].contains(selection.anchorNode);
}

function focusLastListItem(el: HTMLElement) {
  const items = el.querySelectorAll('li');
  const last = items[items.length - 1];
  if (!last) return;
  last.setAttribute('contenteditable', 'true');
  placeCaretAtEnd(last);
}

export { isSafeHref } from './is-safe-href';
