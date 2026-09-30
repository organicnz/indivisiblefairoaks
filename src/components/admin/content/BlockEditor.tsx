'use client';

import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Link2,
  Lock,
  Plus,
  Trash2,
  Type as TypeIcon,
  X,
} from 'lucide-react';
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
import {
  type Block,
  CALLOUT_TONES,
  type CalloutTone,
  type HeadingLevel,
  INSERTABLE_HEADING_LEVELS,
  isTextualBlock,
  nextBlockId,
  stripTags,
} from '@/lib/blocks';
import {
  BLOCK_DEFINITIONS,
  type BlockKind,
  definitionFor,
  INLINE_FORMATS,
  searchBlocks,
} from './block-definitions';
import { ContentImageInput } from './ContentImageInput';
import { LinkPopover } from './LinkPopover';

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
}

const HEADING_LEVEL_NAMES: Record<number, string> = {
  2: 'Section (H2)',
  3: 'Subhead (H3)',
  4: 'Minor (H4)',
};

/** Debounce is short enough to feel live and long enough not to thrash re-renders. */
const INPUT_DEBOUNCE_MS = 120;

export function BlockEditor({ blocks, onChange }: Props) {
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
      onChange(
        blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
        intent
      );
    },
    [blocks, onChange]
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
      const next = [...blocks];
      next.splice(index, 0, block);
      onChange(next);
      return block;
    },
    [blocks, onChange]
  );

  const removeAt = useCallback(
    (index: number) => {
      const next = blocks.filter((_, i) => i !== index);
      // Never leave the document with zero blocks — the author would have
      // nowhere to click and typing would do nothing.
      onChange(next.length ? next : [{ id: nextBlockId(), type: 'paragraph', html: '' }]);
      const fallback = next[Math.min(index, next.length - 1)];
      if (fallback) pendingFocus.current = fallback.id;
    },
    [blocks, onChange]
  );

  /** Move a block to an absolute position. Shared by the drag and the buttons. */
  const moveTo = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= blocks.length || from === to) return;
      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [blocks, onChange]
  );

  const move = useCallback(
    (index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= blocks.length) return;
      const next = [...blocks];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      onChange(next);
    },
    [blocks, onChange]
  );

  const duplicateAt = useCallback(
    (index: number) => {
      const source = blocks[index];
      if (!source) return;
      // A fresh id is required: two blocks sharing an id would share a DOM node
      // in the ref map, and the second one's edits would overwrite the first.
      const copy = { ...source, id: nextBlockId() } as Block;
      const next = [...blocks];
      next.splice(index + 1, 0, copy);
      onChange(next);
    },
    [blocks, onChange]
  );

  const convert = useCallback(
    (index: number, kind: BlockKind, tone: CalloutTone = 'info') => {
      const current = blocks[index];
      if (!current) return;
      const replacement = makeBlock(kind, tone);
      // Carry the author's words across the conversion — losing them because
      // they pressed the wrong arrow key is the fastest way to lose trust.
      if (isTextualBlock(current) && isTextualBlock(replacement)) {
        (replacement as { html: string }).html = current.html;
      }
      const next = [...blocks];
      next[index] = replacement;
      onChange(next);
      pendingFocus.current = replacement.id;
      setSlash(null);
    },
    [blocks, makeBlock, onChange]
  );

  // ── Slash menu ──────────────────────────────────────────────────────────
  const openSlash = useCallback(
    (index: number) => {
      const el = blockRefs.current.get(blocks[index]?.id ?? '');
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
    [blocks]
  );

  const applySlashChoice = useCallback(
    (def: { kind: BlockKind; tones?: readonly { tone: CalloutTone }[] }) => {
      if (!slash) return;
      const tone = def.tones?.[0]?.tone ?? 'info';
      const current = blocks[slash.index];
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
    [blocks, convert, insertAt, makeBlock, slash]
  );

  const closeSlash = useCallback(() => setSlash(null), []);

  // ── Keyboard handling ───────────────────────────────────────────────────

  const onEditableKeyDown = (event: KeyboardEvent<HTMLElement>, block: Block, index: number) => {
    // Escape closes the menu without touching the document.
    if (event.key === 'Escape' && slash) {
      event.preventDefault();
      closeSlash();
      return;
    }

    if (slash && slash.index === index) {
      const results = searchBlocks(slash.query);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const choice = results[activeIndex];
        if (choice) {
          event.preventDefault();
          applySlashChoice(choice);
        }
        return;
      }
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

  // Coalesce rapid keystrokes into one model update.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleUpdate = (block: Block, html: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Read the latest `blocks` through a ref-free path: recompute from the
      // current props at flush time by locating the block again.
      onChange(
        blocks.map((b) => (b.id === block.id ? ({ ...b, html } as Block) : b)),
        `type:${block.id}`
      );
    }, INPUT_DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

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
          const def = definitionFor(
            (block.type === 'unsupported' ? 'paragraph' : block.type) as BlockKind
          );
          return (
            <li
              key={block.id}
              className={`group relative rounded-xl border px-2 py-1 transition-colors focus-within:border-slate-300 ${
                dropIndex === index && dragIndex !== index
                  ? 'border-primary bg-blue-50'
                  : 'border-transparent hover:border-slate-200'
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
              {/* Block chrome */}
              <div className="absolute -left-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openSlash(index)}
                  aria-label={`Change ${def.label} block`}
                  title="Add or change block"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
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
                  aria-label={`Reorder ${def.label} block`}
                  aria-describedby="block-reorder-help"
                  title="Drag to reorder, or Alt+Arrow Up/Down"
                  className="cursor-grab rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
              </div>

              <div className="absolute -right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move block up"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                  aria-label="Move block down"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateAt(index)}
                  aria-label="Duplicate block"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label="Delete block"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>

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
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
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

interface BodyProps {
  block: Block;
  index: number;
  registerRef: (id: string) => (el: HTMLElement | null) => void;
  onInput: (event: FormEvent<HTMLElement>, block: Block) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, block: Block, index: number) => void;
  /** Third argument is the undo intent; see the `onChange` prop for its meaning. */
  onUpdate: (id: string, patch: Partial<Block>, intent?: string | null) => void;
  onApplyInline: (command: string, value?: string) => void;
  onOpenLinkEditor: () => void;
  onCloseLinkEditor: () => void;
  linkEditorOpen: boolean;
  restoreSelection: () => void;
  onPickBlock: (kind: BlockKind, tone: CalloutTone) => void;
}

const INLINE_CLASS =
  'min-h-[1.75rem] w-full rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function InlineToolbar({
  onApply,
  onOpenLinkEditor,
  onCloseLinkEditor,
  linkEditorOpen,
  restoreSelection,
}: {
  onApply: (command: string, value?: string) => void;
  onOpenLinkEditor: () => void;
  onCloseLinkEditor: () => void;
  linkEditorOpen: boolean;
  restoreSelection: () => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {INLINE_FORMATS.map((format) => {
        const Icon = format.icon;
        return (
          <button
            key={format.command}
            type="button"
            // `onMouseDown` + preventDefault keeps the selection: a mousedown that
            // moves focus first would collapse the Range before the command ran.
            onMouseDown={(e) => {
              e.preventDefault();
              onApply(format.command);
            }}
            aria-label={format.label}
            title={`${format.label} (${format.key})`}
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon size={14} />
          </button>
        );
      })}
      <button
        type="button"
        onMouseDown={(e) => {
          // Stash the selection before the popover takes focus, then let it open.
          e.preventDefault();
          onOpenLinkEditor();
        }}
        aria-label="Add or edit link"
        aria-expanded={linkEditorOpen}
        title="Add or edit link (Ctrl+K)"
        className={`rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
          linkEditorOpen
            ? 'bg-white text-primary'
            : 'text-slate-600 hover:bg-white hover:text-primary'
        }`}
      >
        <Link2 size={14} />
      </button>
      {/*
        Keyboard route for a link, since the mouse route needs a selection the
        author can only make with a pointer.
      */}
      {linkEditorOpen && (
        <div className="min-w-0 flex-1">
          <LinkPopover
            onApply={(href) => {
              onApply('createLink', href);
              onCloseLinkEditor();
            }}
            onRemove={onCloseLinkEditor}
            restoreSelection={restoreSelection}
          />
        </div>
      )}
    </div>
  );
}

function BlockTypeMenu({
  block,
  onPick,
}: {
  block: Block;
  onPick: (kind: BlockKind, tone: CalloutTone) => void;
}) {
  const [open, setOpen] = useState(false);
  const def = definitionFor((block.type === 'unsupported' ? 'paragraph' : block.type) as BlockKind);
  const Icon = def.icon;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon size={13} aria-hidden="true" />
        {def.label}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close block menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-float">
            {BLOCK_DEFINITIONS.map((entry) => {
              const EntryIcon = entry.icon;
              return (
                <button
                  key={entry.kind}
                  type="button"
                  onClick={() => {
                    onPick(entry.kind, entry.tones?.[0]?.tone ?? 'info');
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                >
                  <EntryIcon
                    size={15}
                    className="mt-0.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-secondary">
                      {entry.label}
                    </span>
                    <span className="block text-xs text-slate-500">{entry.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function BlockBody({
  block,
  index,
  registerRef,
  onInput,
  onKeyDown,
  onUpdate,
  onApplyInline,
  onOpenLinkEditor,
  onCloseLinkEditor,
  linkEditorOpen,
  restoreSelection,
  onPickBlock,
}: BodyProps) {
  const editableProps = {
    ref: registerRef(block.id),
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: true,
    className: INLINE_CLASS,
    onInput: (e: FormEvent<HTMLElement>) => onInput(e, block),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, block, index),
    role: 'textbox',
    'aria-multiline': true,
  };

  if (block.type === 'unsupported') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
          <Lock size={13} aria-hidden="true" />
          Unsupported markup — preserved, not editable
        </p>
        <p className="mt-1.5 text-sm text-amber-900">
          This block uses markup the editor has no control for. It is kept exactly as written so
          saving does not delete it, but you cannot edit it here.
        </p>
        <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-white/70 p-2 text-xs text-amber-900">
          {block.html}
        </pre>
      </div>
    );
  }

  if (block.type === 'divider') {
    return (
      <div className="flex items-center gap-3 px-3 py-3">
        <hr className="cw-divider my-0 flex-1" />
        <BlockTypeMenu block={block} onPick={onPickBlock} />
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <div className="mb-3">
          <ContentImageInput
            label="Image"
            hint="JPEG, PNG, WebP or GIF, up to 5MB"
            value={block.src}
            onChange={(src) => onUpdate(block.id, { src } as Partial<Block>)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Alt text
            <input
              type="text"
              value={block.alt}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { alt: e.target.value } as Partial<Block>,
                  `type:alt:${block.id}`
                )
              }
              placeholder="Describe the image for screen readers"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Caption
            <input
              type="text"
              value={block.caption}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { caption: e.target.value } as Partial<Block>,
                  `type:caption:${block.id}`
                )
              }
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>
        {/*
          Alt text is not optional politeness here: the image block is the only
          way a photo reaches a page, and a missing alt attribute is announced as
          a filename by every screen reader. Nudge rather than block, because the
          serializer is shared with content the editor did not author.
        */}
        {block.src && !block.alt.trim() && (
          <p className="mt-2 text-[11px] font-medium text-accent-gold">
            Add alt text so this image is described to screen reader users.
          </p>
        )}
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <textarea
          value={block.text}
          onChange={(e) =>
            onUpdate(block.id, { text: e.target.value } as Partial<Block>, `type:text:${block.id}`)
          }
          rows={4}
          spellCheck={false}
          aria-label="Code block content"
          className="w-full rounded-lg border border-slate-200 bg-secondary px-3 py-2 font-mono text-sm text-ink-on-dark focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
    );
  }

  if (block.type === 'button') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Label
            <input
              type="text"
              value={block.label}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { label: e.target.value } as Partial<Block>,
                  `type:label:${block.id}`
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Destination
            <input
              type="text"
              value={block.href}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { href: e.target.value } as Partial<Block>,
                  `type:href:${block.id}`
                )
              }
              placeholder="/contact"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>
        {/*
          Links are limited to this site's own domains. `sanitizeWPContent` already
          drops untrusted hrefs, so an out-of-domain URL here would appear to work
          in the editor and then silently vanish on publish.
        */}
        {block.href && !isSafeHref(block.href) && (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-red">
            This link will be removed on publish — use a path like /contact, or a link to
            indivisiblefairoaks.org.
          </p>
        )}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <div className="overflow-x-auto">
          <table className="cw-table">
            <thead>
              <tr>
                {/* A table cell is a fully controlled <input>: it holds no
                    internal state, so the column index is a correct and stable
                    key. The lint flags any index key, hence the suppression. */}
                {block.head.map((cell, colIndex) => (
                  /* biome-ignore lint/suspicious/noArrayIndexKey: controlled input, no internal state */
                  <th key={`h-${colIndex}`}>
                    <input
                      type="text"
                      value={stripTags(cell)}
                      aria-label={`Column ${colIndex + 1} heading`}
                      onChange={(e) => {
                        const head = [...block.head];
                        head[colIndex] = e.target.value;
                        onUpdate(block.id, { head } as Partial<Block>);
                      }}
                      className="w-full min-w-24 rounded border border-slate-200 bg-white px-2 py-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </th>
                ))}
                <th className="w-10">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate(block.id, { head: [...block.head, 'New column'] } as Partial<Block>)
                    }
                    aria-label="Add column"
                    className="rounded px-1.5 py-1 text-slate-500 transition-colors hover:bg-white hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Rows hold controlled inputs only — see the header above. */}
              {block.rows.map((row, rowIndex) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: controlled inputs, no internal state */
                <tr key={`r-${rowIndex}`}>
                  {block.head.map((_, colIndex) => (
                    /* biome-ignore lint/suspicious/noArrayIndexKey: controlled input, no internal state */
                    <td key={`c-${colIndex}`}>
                      <input
                        type="text"
                        value={stripTags(row[colIndex] ?? '')}
                        aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}`}
                        onChange={(e) => {
                          const rows = block.rows.map((r) => [...r]);
                          while (rows[rowIndex].length < block.head.length) rows[rowIndex].push('');
                          rows[rowIndex][colIndex] = e.target.value;
                          onUpdate(block.id, { rows } as Partial<Block>);
                        }}
                        className="w-full min-w-24 rounded border border-slate-200 bg-white px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate(block.id, {
                          rows: [
                            ...block.rows,
                            Array.from({ length: block.head.length }, () => ''),
                          ],
                        } as Partial<Block>)
                      }
                      aria-label={`Add row ${rowIndex + 2}`}
                      className="rounded px-1.5 py-1 text-slate-500 transition-colors hover:bg-white hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.rows.length > 0 && (
          <button
            type="button"
            onClick={() => onUpdate(block.id, { rows: block.rows.slice(0, -1) } as Partial<Block>)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 size={12} aria-hidden="true" />
            Remove last row
          </button>
        )}
      </div>
    );
  }

  if (block.type === 'bulletList' || block.type === 'orderedList') {
    const ListTag = block.type === 'orderedList' ? 'ol' : 'ul';
    return (
      <div className="rounded-xl">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <ListTag className="cw-editor-canvas cw-list" ref={registerRef(block.id) as never}>
          {/* An index is a list item's identity. These <li> hold no React
              state — the DOM is the source of truth for their content by
              design — so there is no per-item state to mis-associate. */}
          {block.items.map((_item, itemIndex) => (
            <li
              /* biome-ignore lint/suspicious/noArrayIndexKey: no React state on these items */
              key={`${block.id}-${itemIndex}`}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const items = [...block.items];
                items[itemIndex] = e.currentTarget.innerHTML;
                onUpdate(block.id, { items } as Partial<Block>);
              }}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              className="min-h-[1.5rem] rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          ))}
        </ListTag>
      </div>
    );
  }

  // Textual blocks: paragraph, heading, quote, callout. Each is spelled out
  // rather than built with createElement, so the heading level and the callout
  // tone stay statically checked instead of cast.
  return (
    <div className="rounded-xl">
      <div className="flex flex-wrap items-center gap-2">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        {block.type === 'heading' && (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Level
            <select
              value={String(block.level)}
              onChange={(e) =>
                onUpdate(block.id, {
                  level: Number(e.target.value) as HeadingLevel,
                } as Partial<Block>)
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary"
            >
              {INSERTABLE_HEADING_LEVELS.map((level) => (
                <option key={level} value={String(level)}>
                  {HEADING_LEVEL_NAMES[level]}
                </option>
              ))}
            </select>
          </label>
        )}
        {block.type === 'callout' && (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Tone
            <select
              value={block.tone}
              onChange={(e) =>
                onUpdate(block.id, { tone: e.target.value as CalloutTone } as Partial<Block>)
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary"
            >
              {CALLOUT_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone[0].toUpperCase() + tone.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <InlineToolbar
        onApply={onApplyInline}
        onOpenLinkEditor={onOpenLinkEditor}
        onCloseLinkEditor={onCloseLinkEditor}
        linkEditorOpen={linkEditorOpen}
        restoreSelection={restoreSelection}
      />
      {/*
        The block classes live on a wrapper so the editable element itself can
        carry only the editor's own focus/padding styling. One `.cw` class
        carries the article rhythm (`> * + *` margins), so a wrapper that also
        holds the contenteditable child would double the spacing.
      */}
      {block.type === 'paragraph' && (
        <div className="cw-editor-canvas">
          <p {...editableProps} />
        </div>
      )}
      {block.type === 'heading' && (
        <div className="cw-editor-canvas">
          <HeadingTag level={block.level} {...editableProps} />
        </div>
      )}
      {block.type === 'quote' && (
        <blockquote className="cw-quote cw-editor-canvas">
          <p {...editableProps} />
        </blockquote>
      )}
      {block.type === 'callout' && (
        <div className={`cw-callout cw-callout--${block.tone} cw-editor-canvas`}>
          <p {...editableProps} />
        </div>
      )}
    </div>
  );
}

/** `h2`/`h3`/`h4` chosen from the level, so the markup matches the model. */
function HeadingTag({ level, ...rest }: { level: HeadingLevel } & HTMLAttributes<HTMLElement>) {
  if (level === 2) return <h2 {...rest} />;
  if (level === 3) return <h3 {...rest} />;
  return <h4 {...rest} />;
}

/** Mirrors the sanitizer's trusted-domain rule so the editor can warn early. */
export function isSafeHref(href: string): boolean {
  const value = href.trim().toLowerCase();
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return (
      url.hostname === 'indivisiblefairoaks.org' ||
      url.hostname.endsWith('.indivisiblefairoaks.org')
    );
  } catch {
    return false;
  }
}

function SlashMenu({
  query,
  results,
  activeIndex,
  position,
  onPick,
  onQueryChange,
  onClose,
}: {
  query: string;
  results: ReturnType<typeof searchBlocks>;
  activeIndex: number;
  position: { top: number; left: number };
  onPick: (def: (typeof BLOCK_DEFINITIONS)[number]) => void;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div>
      {/* Backdrop: dismisses on any outside click. Without it the menu can only
          be left with Escape or a selection, which is not discoverable. */}
      <button
        type="button"
        aria-label="Close block menu"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="dialog"
        aria-label="Insert block"
        className="fixed z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-float"
        style={{ top: position.top, left: position.left }}
      >
        <div className="mb-1 flex items-center gap-2 border-b border-slate-100 px-2 pb-2">
          <TypeIcon size={14} className="text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Search blocks…"
            aria-label="Search blocks"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close block menu"
            className="rounded p-0.5 text-slate-400 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/*
          A div with role="listbox" rather than a <ul>: the options are buttons
          driven by arrow keys, which is the combobox/listbox pattern. Putting
          that role on a <ul> replaces list semantics wholesale and the a11y
          linter is right to object.
        */}
        <div role="listbox" aria-label="Block types" className="max-h-72 overflow-y-auto">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              No blocks match “{query}”.
            </p>
          )}
          {results.map((def, index) => {
            const Icon = def.icon;
            return (
              <button
                key={def.kind}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                // mousedown + preventDefault keeps the caret in the block the menu
                // was opened from; a plain click would blur it first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(def);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none ${
                  index === activeIndex ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                }`}
              >
                <Icon size={16} className="shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-secondary">{def.label}</span>
                  <span className="block truncate text-xs text-slate-500">{def.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
