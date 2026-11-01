import type { InlineFormatCommand } from '../../InlineFormatToolbar';

/**
 * The inline commands the visual content editor offers.
 *
 * `link` is included because it opens a dialog rather than wrapping a tag;
 * the tag commands are handled by `applyInlineFormat`.
 */
export const INLINE_TEXT_COMMANDS = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'link',
] as const satisfies readonly InlineFormatCommand[];

export type InlineTextCommand = (typeof INLINE_TEXT_COMMANDS)[number];

export type InlineTagCommand = Exclude<InlineTextCommand, 'link'>;

const TAG_FOR_COMMAND: Record<InlineTagCommand, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strikethrough: 's',
  code: 'code',
};

/** The element a node lives in, for the selection helpers below. */
function elementFor(node: Node): HTMLElement | null {
  if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement;
  return node.parentElement;
}

/**
 * The last range the admin made in each editor.
 *
 * Tabbing from the text to the format strip moves DOM focus, and a browser may
 * drop the live selection at that point. Remembering the range on the gestures
 * that create one — mouse-up, key-up, input, blur — lets a keyboard activation
 * format the text the admin selected rather than the caret at the end.
 */
const lastRanges = new WeakMap<HTMLElement, Range>();

function rangeStillBelongsTo(editor: HTMLElement, range: Range): boolean {
  return (
    editor.contains(range.commonAncestorContainer) && range.commonAncestorContainer.isConnected
  );
}

/** Record a range as this editor's selection for a later toolbar activation. */
export function rememberSelection(editor: HTMLElement, range?: Range | null): void {
  const selected = range ?? selectionRangeInEditor(editor);
  if (!selected || !rangeStillBelongsTo(editor, selected)) return;
  lastRanges.set(editor, selected.cloneRange());
}

/**
 * The current selection, but only when it belongs to this editor.
 *
 * A toolbar click uses `mousedown` with `preventDefault`, so the selection is
 * still the one the admin made when this runs. If focus has moved to the
 * toolbar, the last range the editor remembered is used instead. A selection
 * that starts in a different field is refused rather than silently moved into
 * this editor.
 */
export function selectionRangeInEditor(editor: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      lastRanges.set(editor, range.cloneRange());
      return range;
    }
  }

  const remembered = lastRanges.get(editor);
  if (remembered && rangeStillBelongsTo(editor, remembered)) return remembered.cloneRange();
  return null;
}

/** A collapsed range at the end of the editor's content. */
export function rangeAtEnd(editor: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}

/** Focus the editor and put the selection back where the command left it. */
export function focusRange(editor: HTMLElement, range: Range): void {
  editor.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
  lastRanges.set(editor, range.cloneRange());
}

/** Place the caret at the end, for a newly added list item or escaped link. */
export function placeCaretAtEnd(editor: HTMLElement): void {
  focusRange(editor, rangeAtEnd(editor));
}

/** The same-tag ancestor whose whole contents the range selects, if any. */
function fullySelectedTag(editor: HTMLElement, range: Range, tagName: string): HTMLElement | null {
  const element = elementFor(range.commonAncestorContainer);
  const tag = element?.closest(tagName) as HTMLElement | null;
  if (!tag || !editor.contains(tag)) return null;
  // Toggle off only when the whole run is selected. A partial selection inside
  // a bold run should be wrapped again, not remove bold from text outside it.
  return range.toString() === (tag.textContent ?? '') ? tag : null;
}

/** Move a tag's children into its parent and return a range over them. */
function unwrapTag(tag: HTMLElement): Range | null {
  const parent = tag.parentNode;
  if (!parent) return null;
  const first = tag.firstChild;
  const last = tag.lastChild;
  while (tag.firstChild) parent.insertBefore(tag.firstChild, tag);
  parent.removeChild(tag);
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  return range;
}

/**
 * Apply one inline tag command to the editor's selection.
 *
 * `execCommand` is deliberately not used here. It is inconsistent across
 * browsers, unavailable in jsdom, and its output depends on the browser's
 * editing engine rather than the block model. A Range gives us the same
 * `strong` / `em` / `u` / `s` / `code` vocabulary the sanitizer allows, and the
 * resulting HTML is the value the block draft receives.
 */
export function applyInlineFormat(editor: HTMLElement, command: InlineTagCommand): void {
  const tagName = TAG_FOR_COMMAND[command];
  const range = selectionRangeInEditor(editor) ?? rangeAtEnd(editor);

  const existing = fullySelectedTag(editor, range, tagName);
  if (existing) {
    const next = unwrapTag(existing);
    focusRange(editor, next ?? rangeAtEnd(editor));
    return;
  }

  const tag = document.createElement(tagName);
  if (range.collapsed) {
    range.insertNode(tag);
    const caret = document.createRange();
    caret.setStart(tag, 0);
    caret.collapse(true);
    focusRange(editor, caret);
    return;
  }

  tag.appendChild(range.extractContents());
  range.insertNode(tag);
  const selected = document.createRange();
  selected.selectNodeContents(tag);
  focusRange(editor, selected);
}

/** The link containing the range's start, when it belongs to this editor. */
function closestAnchor(editor: HTMLElement, range: Range): HTMLAnchorElement | null {
  const element = elementFor(range.startContainer);
  const anchor = element?.closest('a') as HTMLAnchorElement | null;
  if (anchor && editor.contains(anchor)) return anchor;
  return null;
}

/** The href of the link under the selection, for prefilling the link dialog. */
export function currentLinkHref(editor: HTMLElement, range: Range): string {
  return closestAnchor(editor, range)?.getAttribute('href') ?? '';
}

/** Focus immediately after an inserted or updated anchor. */
function focusAfter(editor: HTMLElement, node: Node): void {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  focusRange(editor, range);
}

/**
 * Validate the value the admin typed into the link dialog.
 *
 * The sanitizer permits http, https, mailto and tel links, and relative links
 * are part of the site's own navigation. Everything else is rejected before it
 * can enter block.html; `javascript:` is the case that matters.
 */
export function normalizeLinkTarget(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  if (/^(?:javascript|data|vbscript|file):/i.test(href)) return null;
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith('/') || href.startsWith('#') || /^\.{1,2}\//.test(href)) return href;
  return null;
}

/**
 * Insert or update a link over the captured selection.
 *
 * The range is captured before the dialog opens, because focusing the URL
 * input destroys the live selection. If there was no selection, the href is
 * also the link text — the useful default for a pasted URL.
 */
export function insertLinkAtSelection(
  editor: HTMLElement,
  href: string,
  capturedRange: Range | null
): void {
  const range = capturedRange ?? selectionRangeInEditor(editor) ?? rangeAtEnd(editor);
  const existing = closestAnchor(editor, range);
  if (existing) {
    existing.setAttribute('href', href);
    focusAfter(editor, existing);
    return;
  }

  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  if (range.collapsed) {
    anchor.textContent = href;
  } else {
    anchor.appendChild(range.extractContents());
  }
  range.insertNode(anchor);
  focusAfter(editor, anchor);
}

/** Insert plain text, turning newlines into `<br>` rather than block markup. */
export function insertPlainTextAtSelection(editor: HTMLElement, text: string): void {
  if (!text) return;
  const range = selectionRangeInEditor(editor) ?? rangeAtEnd(editor);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (index > 0) fragment.appendChild(document.createElement('br'));
    if (line) fragment.appendChild(document.createTextNode(line));
  }
  if (!fragment.firstChild) return;

  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (!last) return;
  const after = document.createRange();
  after.setStartAfter(last);
  after.collapse(true);
  focusRange(editor, after);
}

/** Add a line break without letting the browser create a `<div>` wrapper. */
export function insertLineBreakAtSelection(editor: HTMLElement): void {
  const range = selectionRangeInEditor(editor) ?? rangeAtEnd(editor);
  const br = document.createElement('br');
  range.deleteContents();
  range.insertNode(br);
  const after = document.createRange();
  after.setStartAfter(br);
  after.collapse(true);
  focusRange(editor, after);
}
