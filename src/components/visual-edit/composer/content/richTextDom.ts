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

/** What the format strip should show as pressed for the current selection. */
export interface SelectionFormat {
  /** Inline tags every selected character carries, or the caret sits inside. */
  commands: InlineTagCommand[];
  /** Whether every selected character is linked, or the caret sits in a link. */
  link: boolean;
}

export const EMPTY_SELECTION_FORMAT: SelectionFormat = { commands: [], link: false };

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

/** Every text node touched by the range, in document order. */
function textNodesInRange(editor: HTMLElement, range: Range): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && range.intersectsNode(node)) {
      nodes.push(node as Text);
    }
    node = walker.nextNode();
  }
  return nodes;
}

/**
 * The matching tags that carry every selected character.
 *
 * A collapsed range answers for the caret's tag, which is what makes Bold
 * pressed while typing inside a bold run. A non-collapsed selection only counts
 * when every character in it has the tag; a selection that starts inside bold
 * and ends outside it has no active bold, so applying bold is an explicit
 * choice rather than a silent nesting of the existing run.
 */
function tagsCarryingRange(editor: HTMLElement, range: Range, tagName: string): HTMLElement[] {
  if (range.collapsed) {
    const tag = elementFor(range.startContainer)?.closest(tagName) as HTMLElement | null;
    return tag && editor.contains(tag) ? [tag] : [];
  }

  const tags: HTMLElement[] = [];
  for (const node of textNodesInRange(editor, range)) {
    const tag = node.parentElement?.closest(tagName) as HTMLElement | null;
    if (!tag || !editor.contains(tag)) return [];
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** The links that carry every selected character, or the caret's link. */
function anchorsCarryingRange(editor: HTMLElement, range: Range): HTMLAnchorElement[] {
  if (range.collapsed) {
    const anchor = closestAnchor(editor, range);
    return anchor ? [anchor] : [];
  }

  const anchors: HTMLAnchorElement[] = [];
  for (const node of textNodesInRange(editor, range)) {
    const anchor = node.parentElement?.closest('a') as HTMLAnchorElement | null;
    if (!anchor || !editor.contains(anchor)) return [];
    if (!anchors.includes(anchor)) anchors.push(anchor);
  }
  return anchors;
}

/** Every link the range touches, for removing a link from part of a run. */
function anchorsIntersectingRange(editor: HTMLElement, range: Range): HTMLAnchorElement[] {
  if (range.collapsed) {
    const anchor = closestAnchor(editor, range);
    return anchor ? [anchor] : [];
  }
  return [...editor.querySelectorAll<HTMLAnchorElement>('a')].filter((anchor) =>
    range.intersectsNode(anchor)
  );
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

  const active = tagsCarryingRange(editor, range, tagName);
  if (active.length > 0) {
    // The strip says this run is already formatted, so the command turns the
    // format off. A caret inside the run is the same case — unwrapping is what
    // stops a second tag being nested inside the first.
    let restored: Range | null = null;
    for (const tag of active) {
      if (!tag.isConnected) continue;
      const next = unwrapTag(tag);
      if (next) restored = next;
    }
    focusRange(editor, restored ?? rangeAtEnd(editor));
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

/**
 * Read the formatting the current selection carries.
 *
 * This is the single place the toolbar's pressed state comes from. Keeping it
 * beside the range and tag primitives means the editor never has to infer a
 * tag from the HTML it just rendered, and it answers for a caret as well as a
 * selection — the state a visual editor has to show while typing.
 */
export function readSelectionFormat(editor: HTMLElement): SelectionFormat {
  const range = selectionRangeInEditor(editor);
  if (!range) return EMPTY_SELECTION_FORMAT;

  const commands = (Object.keys(TAG_FOR_COMMAND) as InlineTagCommand[]).filter(
    (command) => tagsCarryingRange(editor, range, TAG_FOR_COMMAND[command]).length > 0
  );
  const anchors = anchorsCarryingRange(editor, range);

  return { commands, link: anchors.length > 0 };
}

/**
 * Remove every link the selection touches while keeping its text and children.
 *
 * Unwrapping, not deleting, is the point: a link is inline formatting like
 * bold, so the block's copy has to survive with only the anchor stripped. The
 * rest of the block HTML — bold, italic, surrounding text — is untouched.
 */
export function unlinkSelection(editor: HTMLElement): boolean {
  const range = selectionRangeInEditor(editor) ?? rangeAtEnd(editor);
  const anchors = anchorsIntersectingRange(editor, range);
  if (anchors.length === 0) return false;

  let restored: Range | null = null;
  for (const anchor of anchors) {
    if (!anchor.isConnected) continue;
    const next = unwrapTag(anchor);
    if (next) restored = next;
  }
  focusRange(editor, restored ?? rangeAtEnd(editor));
  return true;
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
