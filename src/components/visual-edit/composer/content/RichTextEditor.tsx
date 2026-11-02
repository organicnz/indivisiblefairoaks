'use client';

import { ChevronDown, ChevronUp, Code2, Eye, Plus, Trash2 } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type InlineFormatCommand,
  InlineFormatToolbar,
} from '@/components/visual-edit/InlineFormatToolbar';
import { stripTags } from '@/lib/blocks';
import {
  applyInlineFormat,
  currentLinkHref,
  EMPTY_SELECTION_FORMAT,
  focusRange,
  INLINE_TEXT_COMMANDS,
  type InlineTextCommand,
  insertLineBreakAtSelection,
  insertLinkAtSelection,
  insertPlainTextAtSelection,
  normalizeLinkTarget,
  placeCaretAtEnd,
  rangeAtEnd,
  readSelectionFormat,
  rememberSelection,
  type SelectionFormat,
  selectionRangeInEditor,
  unlinkSelection,
} from './richTextDom';

/** The imperative actions a toolbar offers to the editor it formats. */
export interface RichTextActions {
  applyCommand: (command: InlineTextCommand) => void;
}

/** A stable ref the toolbar fills, so keyboard shortcuts can use the same path. */
export interface RichTextActionsRef {
  current: RichTextActions | null;
}

function isInlineTextCommand(command: InlineFormatCommand): command is InlineTextCommand {
  return (INLINE_TEXT_COMMANDS as readonly InlineFormatCommand[]).includes(command);
}

function textStats(html: string): { words: number; chars: number } {
  const text = stripTags(html);
  const trimmed = text.trim();
  return {
    words: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
    chars: text.length,
  };
}

function shortcutFor(event: ReactKeyboardEvent<HTMLElement>): InlineTextCommand | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  switch (event.key.toLowerCase()) {
    case 'b':
      return 'bold';
    case 'i':
      return 'italic';
    case 'u':
      return 'underline';
    case 'k':
      return 'link';
    default:
      return null;
  }
}

interface LinkDialogProps {
  initialHref: string;
  onApply: (href: string) => string | null;
  onCancel: () => void;
}

/**
 * A small link form instead of `window.prompt`.
 *
 * The dialog is inline rather than absolute: the inspector is a narrow rail and
 * a floating panel would be clipped by its scroll container. The URL is
 * validated before it can enter the block's HTML, and the selection was
 * captured before this input took focus.
 */
function LinkDialog({ initialHref, onApply, onCancel }: LinkDialogProps) {
  const [href, setHref] = useState(initialHref);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <form
      role="dialog"
      aria-label="Insert link"
      onSubmit={(event) => {
        event.preventDefault();
        const message = onApply(href);
        if (message) setError(message);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
      className="space-y-2 border-b border-white/10 bg-slate-950/95 px-2.5 py-2"
    >
      <label
        htmlFor={inputId}
        className="block text-[10px] font-bold uppercase tracking-wider text-slate-300"
      >
        Link URL
      </label>
      <input
        id={inputId}
        autoFocus
        type="text"
        value={href}
        onChange={(event) => {
          setHref(event.target.value);
          if (error) setError(null);
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        placeholder="https://example.org/page or /page"
        className="w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-accent-gold/60 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[10px] font-medium text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-accent-gold px-2.5 py-1 text-[10px] font-black text-ink-strong transition-colors hover:bg-accent-gold/90"
        >
          {initialHref ? 'Update link' : 'Insert link'}
        </button>
      </div>
    </form>
  );
}

interface RichTextToolbarProps {
  getEditor: () => HTMLElement | null;
  /** Receives the editor the command ran in, so a list can commit the right item. */
  onCommit: (editor: HTMLElement) => void;
  actionsRef?: RichTextActionsRef;
  className?: string;
}

/**
 * The format strip and its link dialog, shared by the single-block editor and
 * the list editor. `getEditor` is the one difference: a block has one editor,
 * a list has one per item and the focused item is the target.
 */
function RichTextToolbar({ getEditor, onCommit, actionsRef, className }: RichTextToolbarProps) {
  const [link, setLink] = useState<{ editor: HTMLElement; initialHref: string } | null>(null);
  const [selectionFormat, setSelectionFormat] = useState<SelectionFormat>(EMPTY_SELECTION_FORMAT);
  const capturedRange = useRef<Range | null>(null);
  const getEditorRef = useRef(getEditor);
  getEditorRef.current = getEditor;

  const syncSelectionFormat = useCallback(() => {
    const editor = getEditorRef.current();
    setSelectionFormat(editor ? readSelectionFormat(editor) : EMPTY_SELECTION_FORMAT);
  }, []);

  useEffect(() => {
    const update = () => syncSelectionFormat();
    document.addEventListener('selectionchange', update);
    document.addEventListener('mouseup', update, true);
    document.addEventListener('keyup', update, true);
    document.addEventListener('input', update, true);
    update();
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('mouseup', update, true);
      document.removeEventListener('keyup', update, true);
      document.removeEventListener('input', update, true);
    };
  }, [syncSelectionFormat]);

  const openLink = useCallback((editor: HTMLElement) => {
    const range = selectionRangeInEditor(editor) ?? rangeAtEnd(editor);
    capturedRange.current = range.cloneRange();
    setLink({ editor, initialHref: currentLinkHref(editor, range) });
  }, []);

  const applyLink = useCallback(
    (value: string): string | null => {
      const href = normalizeLinkTarget(value);
      if (!href) {
        return 'Use an http(s), mailto:, tel:, or relative link.';
      }
      if (!link) return 'The link editor is no longer open.';
      if (!link.editor.isConnected) return 'The editor is no longer on the page.';

      insertLinkAtSelection(link.editor, href, capturedRange.current);
      onCommit(link.editor);
      capturedRange.current = null;
      setLink(null);
      syncSelectionFormat();
      return null;
    },
    [link, onCommit, syncSelectionFormat]
  );

  const closeLink = useCallback(() => {
    const target = link;
    const range = capturedRange.current;
    capturedRange.current = null;
    setLink(null);
    if (!target?.editor.isConnected) return;
    focusRange(target.editor, range ?? rangeAtEnd(target.editor));
    syncSelectionFormat();
  }, [link, syncSelectionFormat]);

  const handleCommand = useCallback(
    (command: InlineFormatCommand) => {
      if (command === 'unlink') {
        const editor = getEditor();
        if (!editor || !unlinkSelection(editor)) return;
        onCommit(editor);
        syncSelectionFormat();
        return;
      }
      if (!isInlineTextCommand(command)) return;
      const editor = getEditor();
      if (!editor) return;
      if (command === 'link') {
        openLink(editor);
        return;
      }
      applyInlineFormat(editor, command);
      onCommit(editor);
      syncSelectionFormat();
    },
    [getEditor, onCommit, openLink, syncSelectionFormat]
  );

  const commands = useMemo(
    () =>
      selectionFormat.link ? [...INLINE_TEXT_COMMANDS, 'unlink' as const] : INLINE_TEXT_COMMANDS,
    [selectionFormat.link]
  );

  const activeCommands = useMemo(
    () =>
      selectionFormat.link
        ? [...selectionFormat.commands, 'link' as const]
        : selectionFormat.commands,
    [selectionFormat]
  );

  const actions = useMemo<RichTextActions>(
    () => ({ applyCommand: (command) => handleCommand(command) }),
    [handleCommand]
  );

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actions, actionsRef]);

  return (
    <>
      <InlineFormatToolbar
        variant="pill"
        commands={commands}
        activeCommands={activeCommands}
        onCommand={handleCommand}
        className={
          className ??
          'flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-slate-900/70 px-2 py-1.5'
        }
      />
      {link ? (
        <LinkDialog initialHref={link.initialHref} onApply={applyLink} onCancel={closeLink} />
      ) : null}
    </>
  );
}

interface EditableInlineProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  editorRef?: RefObject<HTMLDivElement | null>;
  dataListIndex?: number;
  onFormatShortcut?: (command: InlineTextCommand) => void;
  onEnter?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onBackspace?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}

/**
 * One uncontrolled `contentEditable` whose HTML is the value the block owns.
 *
 * React must not re-render `innerHTML` on every keystroke: that resets the
 * caret. The DOM is the live editing surface, and the sync effect runs only
 * when the parent value changes for a reason the editor did not emit — undo,
 * redo, a block swap or the raw-HTML toggle. The editor never keeps a second
 * copy of the HTML, so autosave, live preview and history all see the same
 * `block.html` they saw from the textarea.
 */
function EditableInline({
  id,
  value,
  onChange,
  ariaLabelledBy,
  ariaLabel,
  placeholder,
  className,
  minHeightClassName = 'min-h-6',
  editorRef,
  dataListIndex,
  onFormatShortcut,
  onEnter,
  onBackspace,
}: EditableInlineProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const resolvedRef = editorRef ?? localRef;
  const lastValue = useRef<string | null>(null);
  const showPlaceholder = !stripTags(value).trim();

  useLayoutEffect(() => {
    const editor = resolvedRef.current;
    if (!editor) return;
    if (lastValue.current === value) return;
    lastValue.current = value;
    if (editor.innerHTML !== value) editor.innerHTML = value;
  }, [resolvedRef, value]);

  return (
    <div className="relative">
      {showPlaceholder && placeholder ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 truncate text-slate-400"
        >
          {placeholder}
        </span>
      ) : null}
      {/* biome-ignore lint/a11y/useSemanticElements: a contentEditable rich-text surface has no form-element equivalent, and role="textbox" is what gives it an accessible role. */}
      <div
        id={id}
        ref={resolvedRef}
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        aria-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-list-index={dataListIndex}
        onInput={(event) => {
          rememberSelection(event.currentTarget);
          onChange(event.currentTarget.innerHTML);
        }}
        onKeyUp={(event) => rememberSelection(event.currentTarget)}
        onMouseUp={(event) => rememberSelection(event.currentTarget)}
        onBlur={(event) => rememberSelection(event.currentTarget)}
        onClick={(event) => {
          // A link is copy being edited, not a destination to follow.
          if ((event.target as HTMLElement).closest('a')) event.preventDefault();
        }}
        onKeyDown={(event) => {
          const shortcut = shortcutFor(event);
          if (shortcut) {
            event.preventDefault();
            onFormatShortcut?.(shortcut);
            return;
          }
          if (event.key === 'Backspace' && !event.nativeEvent.isComposing) {
            if (onBackspace) {
              onBackspace(event);
              if (event.defaultPrevented) return;
            }
          }
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (onEnter) {
              onEnter(event);
              return;
            }
            insertLineBreakAtSelection(event.currentTarget);
            onChange(event.currentTarget.innerHTML);
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData?.getData('text/plain');
          if (!text) return;
          insertPlainTextAtSelection(event.currentTarget, text);
          onChange(event.currentTarget.innerHTML);
        }}
        onDrop={(event) => {
          // Dropped HTML can contain tags the block model does not own; plain
          // paste is the supported path for imported copy.
          event.preventDefault();
        }}
        className={`relative z-10 outline-none ${minHeightClassName} ${className ?? ''}`.trim()}
      />
    </div>
  );
}

export interface RichTextBlockEditorProps {
  /** Optional id for the editable/raw field; keeps caller-provided selectors. */
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant: 'paragraph' | 'heading' | 'quote';
}

const VARIANT_STYLES: Record<RichTextBlockEditorProps['variant'], string> = {
  paragraph: 'text-sm leading-relaxed text-slate-100',
  heading: 'text-xl font-black leading-tight text-white',
  quote: 'border-l-2 border-accent-gold/60 pl-3 text-sm italic leading-relaxed text-slate-100',
};

const VARIANT_ROWS: Record<RichTextBlockEditorProps['variant'], number> = {
  paragraph: 6,
  heading: 3,
  quote: 4,
};

interface RawModeToggleProps {
  raw: boolean;
  ariaLabel: string;
  title: string;
  onToggle: () => void;
}

/** The visual/raw switch, so both editors cannot drift apart on its chrome. */
function RawModeToggle({ raw, ariaLabel, title, onToggle }: RawModeToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={raw}
      aria-label={ariaLabel}
      title={title}
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
        raw
          ? 'border-accent-gold/50 bg-accent-gold/15 text-accent-gold'
          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {raw ? <Eye size={11} /> : <Code2 size={11} />}
      <span>{raw ? 'Visual' : 'HTML'}</span>
    </button>
  );
}

/**
 * The visual editor for a block whose model value is inline HTML.
 *
 * Paragraphs, headings and quotes differ in typography, not in editing: all
 * three store an inline-HTML string, so one component gives them the same
 * toolbar, shortcuts, link flow and raw-HTML escape hatch.
 */
export function RichTextBlockEditor({
  id: explicitId,
  label,
  value,
  onChange,
  placeholder = 'Write here…',
  variant,
}: RichTextBlockEditorProps) {
  const autoId = useId();
  const id = explicitId ?? autoId;
  const labelId = `${id}-label`;
  const editorRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<RichTextActions | null>(null);
  const [raw, setRaw] = useState(false);
  const { words, chars } = textStats(value);

  const handleShortcut = useCallback((command: InlineTextCommand) => {
    actionsRef.current?.applyCommand(command);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="block font-bold text-slate-300">
          {label}
        </span>
        <RawModeToggle
          raw={raw}
          ariaLabel={raw ? 'Edit visually' : 'Edit raw HTML'}
          title={raw ? 'Return to the visual editor' : 'Edit the saved HTML directly'}
          onToggle={() => setRaw((current) => !current)}
        />
      </div>

      {raw ? (
        <textarea
          id={id}
          aria-label={`${label} as HTML`}
          rows={VARIANT_ROWS[variant]}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-[11px] text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors focus-within:border-accent-gold/50 focus-within:ring-1 focus-within:ring-accent-gold/30">
          <RichTextToolbar
            getEditor={() => editorRef.current}
            onCommit={(editor) => onChange(editor.innerHTML)}
            actionsRef={actionsRef}
          />
          <div className="p-3">
            <EditableInline
              id={id}
              value={value}
              onChange={onChange}
              ariaLabelledBy={labelId}
              placeholder={placeholder}
              className={VARIANT_STYLES[variant]}
              minHeightClassName="min-h-16"
              editorRef={editorRef}
              onFormatShortcut={handleShortcut}
            />
          </div>
        </div>
      )}

      <p className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
        <span>
          {words} {words === 1 ? 'word' : 'words'} · {chars} {chars === 1 ? 'char' : 'chars'}
        </span>
        <span>{raw ? 'Raw HTML' : 'Visual editor'}</span>
      </p>
    </div>
  );
}

export interface RichTextListEditorProps {
  ordered: boolean;
  id?: string;
  label?: string;
  items: string[];
  onChange: (items: string[]) => void;
}

/**
 * A visual list editor built from one inline editor per item.
 *
 * The list container is not itself `contentEditable`: keeping each item its own
 * editor means Enter can add an item deliberately, every item can be removed
 * without browser-specific list surgery, and the toolbar has one obvious
 * target — the item the admin is typing in. `items` remains the only value the
 * block owns; the contentEditable DOM is a view of it.
 */
export function RichTextListEditor({
  ordered,
  id: explicitId,
  label = 'List Items',
  items,
  onChange,
}: RichTextListEditorProps) {
  const autoId = useId();
  const id = explicitId ?? autoId;
  const labelId = `${id}-label`;
  const listRef = useRef<HTMLUListElement | null>(null);
  const actionsRef = useRef<RichTextActions | null>(null);
  const pendingFocus = useRef<{ index: number; expectedLength: number } | null>(null);
  const [raw, setRaw] = useState(false);

  const safeItems = items.length > 0 ? items : [''];
  const keySeed = useRef(0);
  const itemKeysRef = useRef<string[]>([]);
  const itemKeys = useMemo(() => {
    const keys = itemKeysRef.current;
    if (keys.length === safeItems.length) return keys;
    const next = Array.from(
      { length: safeItems.length },
      (_, index) => keys[index] ?? `list-item-${keySeed.current++}`
    );
    itemKeysRef.current = next;
    return next;
  }, [safeItems.length]);

  const update = useCallback(
    (next: string[]) => {
      onChange(next.length > 0 ? next : ['']);
    },
    [onChange]
  );

  const setItem = useCallback(
    (index: number, html: string) => {
      const next = [...safeItems];
      next[index] = html;
      update(next);
    },
    [safeItems, update]
  );

  const getActiveEditor = useCallback((): HTMLElement | null => {
    const list = listRef.current;
    if (!list) return null;

    /*
     * The selection is the target, not focus. Tabbing to the format strip moves
     * focus out of the item the admin selected, and the toolbar must still
     * format that item rather than silently switching to item 1.
     */
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const node = selection.getRangeAt(0).commonAncestorContainer;
      const element =
        node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
      const editor = element?.closest<HTMLElement>('[contenteditable="true"]');
      if (editor && list.contains(editor)) return editor;
    }

    const active = document.activeElement;
    if (active instanceof HTMLElement && list.contains(active)) {
      const editor = active.closest<HTMLElement>('[contenteditable="true"]');
      if (editor) return editor;
    }
    return list.querySelector<HTMLElement>('[contenteditable="true"]') ?? null;
  }, []);

  const commitEditor = useCallback(
    (editor: HTMLElement) => {
      const index = Number(editor.dataset.listIndex);
      if (!Number.isInteger(index)) return;
      setItem(index, editor.innerHTML);
    },
    [setItem]
  );

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    // A refused update must not leave a target that a later edit consumes.
    if (safeItems.length !== pending.expectedLength) {
      pendingFocus.current = null;
      return;
    }
    const editors = listRef.current?.querySelectorAll<HTMLElement>('[contenteditable="true"]');
    const editor = editors?.[pending.index];
    if (!editor) return;
    pendingFocus.current = null;
    editor.focus({ preventScroll: true });
    placeCaretAtEnd(editor);
  }, [safeItems]);

  const addItem = useCallback(
    (after: number = safeItems.length) => {
      const next = [...safeItems];
      next.splice(after, 0, '');
      pendingFocus.current = { index: after, expectedLength: next.length };
      update(next);
    },
    [safeItems, update]
  );

  const removeItem = useCallback(
    (index: number) => {
      if (safeItems.length <= 1) return;
      const next = safeItems.filter((_, itemIndex) => itemIndex !== index);
      pendingFocus.current = {
        index: Math.min(index, next.length - 1),
        expectedLength: next.length,
      };
      update(next);
    },
    [safeItems, update]
  );

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= safeItems.length || fromIndex === toIndex) return;
      const next = [...safeItems];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      pendingFocus.current = {
        index: toIndex,
        expectedLength: next.length,
      };
      update(next);
    },
    [safeItems, update]
  );

  const handleEnter = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
      if (event.shiftKey) {
        const editor = event.currentTarget;
        insertLineBreakAtSelection(editor);
        setItem(index, editor.innerHTML);
        return;
      }
      addItem(index + 1);
    },
    [addItem, setItem]
  );

  const handleBackspace = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
      const editor = event.currentTarget;
      const text = stripTags(editor.innerHTML).trim();
      if (text === '' && safeItems.length > 1 && index > 0) {
        event.preventDefault();
        removeItem(index);
      }
    },
    [removeItem, safeItems.length]
  );

  const stats = safeItems.reduce(
    (total, item) => {
      const itemStats = textStats(item);
      return { words: total.words + itemStats.words, chars: total.chars + itemStats.chars };
    },
    { words: 0, chars: 0 }
  );

  return (
    <fieldset id={id} aria-labelledby={labelId} className="m-0 min-w-0 space-y-2 border-0 p-0">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="block font-bold text-slate-300">
          {label}
        </span>
        <RawModeToggle
          raw={raw}
          ariaLabel={raw ? 'Edit list visually' : 'Edit list items as HTML'}
          title={raw ? 'Return to the visual list editor' : 'Edit the list items as HTML'}
          onToggle={() => setRaw((current) => !current)}
        />
      </div>

      {raw ? (
        <textarea
          id={`${id}-raw`}
          aria-label="List items as HTML, one per line"
          rows={Math.max(4, safeItems.length + 1)}
          value={safeItems.join('\n')}
          onChange={(event) => update(event.target.value.split('\n'))}
          spellCheck={false}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-[11px] text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors focus-within:border-accent-gold/50 focus-within:ring-1 focus-within:ring-accent-gold/30">
          <RichTextToolbar
            getEditor={getActiveEditor}
            onCommit={commitEditor}
            actionsRef={actionsRef}
          />
          <div className="space-y-2 p-3">
            <ul
              ref={listRef}
              className={`m-0 space-y-1.5 pl-5 text-sm leading-relaxed text-slate-100 ${
                ordered ? 'list-decimal' : 'list-disc'
              }`}
            >
              {safeItems.map((item, index) => (
                <li key={itemKeys[index]}>
                  <div className="flex items-start gap-1.5">
                    <EditableInline
                      value={item}
                      onChange={(html) => setItem(index, html)}
                      ariaLabel={`List item ${index + 1}`}
                      dataListIndex={index}
                      placeholder={index === 0 ? 'Write the first item…' : undefined}
                      onFormatShortcut={(command) => actionsRef.current?.applyCommand(command)}
                      onEnter={(event) => handleEnter(event, index)}
                      onBackspace={(event) => handleBackspace(event, index)}
                      className="min-w-0 flex-1 text-sm leading-relaxed text-slate-100"
                    />
                    {safeItems.length > 1 && (
                      <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`Move list item ${index + 1} up`}
                          title={`Move list item ${index + 1} up`}
                          disabled={index === 0}
                          onClick={() => moveItem(index, index - 1)}
                          className="inline-flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move list item ${index + 1} down`}
                          title={`Move list item ${index + 1} down`}
                          disabled={index === safeItems.length - 1}
                          onClick={() => moveItem(index, index + 1)}
                          className="inline-flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronDown size={11} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove list item ${index + 1}`}
                      title={
                        safeItems.length <= 1
                          ? 'A list needs at least one item'
                          : `Remove list item ${index + 1}`
                      }
                      disabled={safeItems.length <= 1}
                      onClick={() => removeItem(index)}
                      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addItem()}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Plus size={11} />
              <span>Add list item</span>
            </button>
          </div>
        </div>
      )}

      <p className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
        <span>
          {stats.words} {stats.words === 1 ? 'word' : 'words'} · {stats.chars}{' '}
          {stats.chars === 1 ? 'char' : 'chars'}
        </span>
        <span>{raw ? 'Raw HTML, one item per line' : 'Visual editor'}</span>
      </p>
    </fieldset>
  );
}
