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

/** Insert a link at the current cursor position in a textarea. */
export function insertLink(textareaId: string): void {
  const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!textarea) return;
  const url = prompt('Enter link URL:');
  if (!url) return;
  const text = prompt('Enter link text:', 'Link') || 'Link';
  const linkHtml = `<a href="${url}">${text}</a>`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentText = textarea.value;
  textarea.value = currentText.slice(0, start) + linkHtml + currentText.slice(end);
  textarea.focus();
  const newPos = start + linkHtml.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Apply an inline-format command to a textarea's selected text. */
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
  } else if (command === 'link') {
    insertLink(textareaId);
  }
}
