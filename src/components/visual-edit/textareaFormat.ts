'use client';

/**
 * Textarea-based inline format utilities for the section editor modal.
 *
 * These operate on `<textarea>` elements by id, wrapping the current selection
 * in HTML tags. This is distinct from `InlineFormatToolbar`'s
 * `applyInlineFormatCommand`, which targets a live DOM selection
 * (`window.getSelection()`) on a `contentEditable` region.
 *
 * Free of React so the overlay imports them as plain functions rather than
 * stable callbacks. No hooks inside, so `useCallback` wrapping is unnecessary
 * at module scope.
 */

import { normalizeLinkTarget } from './composer/content/richTextDom';
import type { InlineFormatCommand } from './InlineFormatToolbar';

/** Wrap selected text in a textarea with prefix/suffix tags. */
export function wrapSelection(textareaId: string, prefix: string, suffix: string): void {
  const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end);
  const wrapped = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`;
  textarea.value = text.slice(0, start) + wrapped + text.slice(end);
  textarea.focus();
  const newPos = start + wrapped.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Escape a value before it becomes text or an attribute in inserted HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Insert a link at the current cursor position in a textarea.
 *
 * The URL must survive `normalizeLinkTarget`, and both the URL and label are
 * escaped before entering the HTML value. Returns false when the textarea is
 * gone or the URL is not a safe link target, so the caller can keep its dialog
 * open and explain the problem instead of silently discarding the edit.
 */
export function insertLink(textareaId: string, href: string, label = ''): boolean {
  const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!textarea) return false;
  const url = normalizeLinkTarget(href);
  if (!url) return false;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.slice(start, end).trim();
  const linkText = label.trim() || selectedText || 'Link';
  const linkHtml = `<a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a>`;
  textarea.value = textarea.value.slice(0, start) + linkHtml + textarea.value.slice(end);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  const newPos = start + linkHtml.length;
  textarea.setSelectionRange(newPos, newPos);
  return true;
}

/**
 * Apply an inline-format command to a textarea's selected text.
 *
 * Link commands are deliberately absent: they need the caller's dialog so the
 * URL can be validated and the selection captured before focus moves.
 */
export function runTextareaFormatCommand(textareaId: string, command: InlineFormatCommand): void {
  const tags: Partial<Record<InlineFormatCommand, [string, string]>> = {
    bold: ['<strong>', '</strong>'],
    italic: ['<em>', '</em>'],
    code: ['<code>', '</code>'],
    strikethrough: ['<s>', '</s>'],
    underline: ['<u>', '</u>'],
  };
  const tag = tags[command];
  if (tag) {
    wrapSelection(textareaId, tag[0], tag[1]);
  }
}
