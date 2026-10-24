'use client';

import {
  Bold,
  Code,
  Eraser,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
  Unlink,
} from 'lucide-react';
import { Fragment, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

/**
 * The inline formatting vocabulary, in one place.
 *
 * There are two editing surfaces that offer inline formatting — the floating
 * pill over a `contentEditable` section, and the toolbar above the section
 * modal's paragraph textarea — and they had been written twice, as eleven
 * hand-copied buttons each, with different titles for the same command. That is
 * how "Insert link (⌘K)" and "Insert Link (⌘K)" end up as two strings, and it is
 * how a command gets added to one surface and silently goes missing from the
 * other.
 *
 * The two surfaces still *apply* a command differently (`execCommand` on a DOM
 * selection versus wrapping a textarea's `selectionStart`) — that is a real
 * difference in the medium, not duplication — so the component owns the button
 * set and the call site owns the application. `applyInlineFormatCommand` is the
 * DOM-selection implementation, shared by the pill and the keyboard shortcuts.
 */

export type InlineFormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'highlight'
  | 'bulletList'
  | 'orderedList'
  | 'link'
  | 'unlink'
  | 'clear'
  | 'h2'
  | 'h3'
  | 'paragraph';

interface CommandSpec {
  label: string;
  /** Shown in the button's `title`, e.g. "Bold (⌘B)". */
  title: string;
  /** Icon for the button; commands that render a word or glyph omit it. */
  icon?: typeof Bold;
  /** Literal text for commands whose control is a word (H2, H3, ¶). */
  glyph?: string;
  /** Which visual run the command belongs to; a separator is drawn between runs. */
  group: 'text' | 'list' | 'link' | 'block';
}

const COMMANDS: Record<InlineFormatCommand, CommandSpec> = {
  bold: { label: 'Bold', title: 'Bold (⌘B)', icon: Bold, group: 'text' },
  italic: { label: 'Italic', title: 'Italic (⌘I)', icon: Italic, group: 'text' },
  underline: { label: 'Underline', title: 'Underline (⌘U)', icon: Underline, group: 'text' },
  strikethrough: {
    label: 'Strikethrough',
    title: 'Strikethrough',
    icon: Strikethrough,
    group: 'text',
  },
  code: { label: 'Inline Code', title: 'Inline code snippet', icon: Code, group: 'text' },
  highlight: { label: 'Highlight', title: 'Highlight selection', icon: Highlighter, group: 'text' },
  bulletList: { label: 'Bullet list', title: 'Bullet list', icon: List, group: 'list' },
  orderedList: { label: 'Numbered list', title: 'Numbered list', icon: ListOrdered, group: 'list' },
  link: { label: 'Insert link', title: 'Insert link (⌘K)', icon: LinkIcon, group: 'link' },
  unlink: { label: 'Remove link', title: 'Remove link', icon: Unlink, group: 'link' },
  clear: { label: 'Clear formatting', title: 'Clear formatting', icon: Eraser, group: 'link' },
  h2: { label: 'Heading 2', title: 'Format as Heading 2', glyph: 'H2', group: 'block' },
  h3: { label: 'Heading 3', title: 'Format as Heading 3', glyph: 'H3', group: 'block' },
  paragraph: { label: 'Paragraph', title: 'Format as Paragraph', glyph: '¶', group: 'block' },
};

const VARIANT_STYLES = {
  /** Dark chrome, floating over the page. */
  pill: {
    icon: 13,
    button:
      'rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer',
    glyphButton:
      'rounded px-1.5 py-0.5 text-slate-300 font-bold hover:bg-white/15 hover:text-white transition-colors cursor-pointer text-[10px]',
    separator: 'mx-0.5 h-3.5 w-px bg-white/20',
  },
  /** Light chrome, inside a modal's form. */
  panel: {
    icon: 14,
    button: 'p-1.5 rounded hover:bg-border text-foreground transition-colors',
    glyphButton:
      'px-1.5 py-1 rounded hover:bg-border text-foreground font-bold text-[11px] transition-colors',
    separator: 'mx-1 h-5 w-px bg-border',
  },
} as const;

/** Wraps or unwraps the active DOM selection with an inline element. */
export function wrapSelectionWithTag(tagName: string, className?: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  if (!selectedText) return;

  const parent = range.commonAncestorContainer.parentElement;
  if (parent && parent.tagName.toLowerCase() === tagName.toLowerCase()) {
    const textNode = document.createTextNode(parent.textContent || '');
    parent.replaceWith(textNode);
    return;
  }

  const el = document.createElement(tagName);
  if (className) el.className = className;
  el.textContent = selectedText;
  range.deleteContents();
  range.insertNode(el);
}

/**
 * Applies a command to the current DOM selection.
 *
 * `formatBlock` is the one call that needs the try/catch: Chromium wants
 * `'<h2>'` and Safari rejected that form historically, so both spellings are
 * attempted. Everything else is a single `execCommand`.
 */
export function applyInlineFormatCommand(command: InlineFormatCommand) {
  switch (command) {
    case 'code':
      wrapSelectionWithTag(
        'code',
        'px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs'
      );
      return;
    case 'highlight':
      wrapSelectionWithTag('mark', 'bg-amber-400/25 text-inherit px-1 rounded');
      return;
    case 'link': {
      const url = window.prompt('Enter link URL (e.g. https://... or /about):');
      if (url) document.execCommand('createLink', false, url);
      return;
    }
    case 'h2':
    case 'h3':
    case 'paragraph': {
      const tag = command === 'paragraph' ? 'p' : command;
      try {
        document.execCommand('formatBlock', false, `<${tag}>`);
      } catch {
        document.execCommand('formatBlock', false, tag);
      }
      return;
    }
    default: {
      const execName =
        command === 'strikethrough'
          ? 'strikeThrough'
          : command === 'bulletList'
            ? 'insertUnorderedList'
            : command === 'orderedList'
              ? 'insertOrderedList'
              : command === 'clear'
                ? 'removeFormat'
                : command;
      document.execCommand(execName, false);
    }
  }
}

interface InlineFormatToolbarProps {
  variant: 'pill' | 'panel';
  commands: readonly InlineFormatCommand[];
  onCommand: (command: InlineFormatCommand) => void;
  /** Rendered after the last command (counters, hints, status). */
  trailing?: ReactNode;
  className?: string;
}

export function InlineFormatToolbar({
  variant,
  commands,
  onCommand,
  trailing,
  className,
}: InlineFormatToolbarProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-1'}>
      {commands.map((command, index) => {
        const spec = COMMANDS[command];
        const previous = index > 0 ? COMMANDS[commands[index - 1]] : null;
        const Icon = spec.icon;
        /* The pill lives over a contentEditable region, so the mouse-down has
           to be cancelled or the selection collapses before the command runs.
           The modal's toolbar targets a textarea by id and does not have that
           problem, so it keeps the ordinary click. */
        const activation =
          variant === 'pill'
            ? {
                onMouseDown: (e: ReactMouseEvent) => {
                  e.preventDefault();
                  onCommand(command);
                },
              }
            : { onClick: () => onCommand(command) };

        return (
          <Fragment key={command}>
            {previous && previous.group !== spec.group && (
              <span className={styles.separator} aria-hidden="true" />
            )}
            <button
              type="button"
              {...activation}
              className={Icon ? styles.button : styles.glyphButton}
              title={spec.title}
              aria-label={spec.label}
            >
              {Icon ? <Icon size={styles.icon} /> : spec.glyph}
            </button>
          </Fragment>
        );
      })}
      {trailing}
    </div>
  );
}
