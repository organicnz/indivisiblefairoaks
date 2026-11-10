// @vitest-environment jsdom-same-realm
import { afterEach, describe, expect, it } from 'vitest';
import {
  insertLink,
  runTextareaFormatCommand,
  wrapSelection,
} from '@/components/visual-edit/textareaFormat';

function makeTextarea(id: string, value: string): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.id = id;
  ta.value = value;
  document.body.appendChild(ta);
  return ta;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('wrapSelection', () => {
  it('wraps the selected text in the given tags', () => {
    const ta = makeTextarea('ta1', 'Hello world');
    ta.selectionStart = 6;
    ta.selectionEnd = 11;

    wrapSelection('ta1', '<strong>', '</strong>');

    expect(ta.value).toBe('Hello <strong>world</strong>');
  });

  it('inserts empty tags when nothing is selected', () => {
    const ta = makeTextarea('ta2', 'Hello world');
    ta.selectionStart = 5;
    ta.selectionEnd = 5;

    wrapSelection('ta2', '<em>', '</em>');

    expect(ta.value).toBe('Hello<em></em> world');
  });

  it('is a no-op when the textarea does not exist', () => {
    expect(() => wrapSelection('nonexistent', '<b>', '</b>')).not.toThrow();
  });
});

describe('runTextareaFormatCommand', () => {
  it('wraps text in <strong> for bold', () => {
    const ta = makeTextarea('ta3', 'Bold me');
    ta.selectionStart = 0;
    ta.selectionEnd = 4;

    runTextareaFormatCommand('ta3', 'bold');

    expect(ta.value).toBe('<strong>Bold</strong> me');
  });

  it('wraps text in <em> for italic', () => {
    const ta = makeTextarea('ta4', 'Italic me');
    ta.selectionStart = 0;
    ta.selectionEnd = 6;

    runTextareaFormatCommand('ta4', 'italic');

    expect(ta.value).toBe('<em>Italic</em> me');
  });

  it('wraps text in <code> for code', () => {
    const ta = makeTextarea('ta5', 'Code here');
    ta.selectionStart = 0;
    ta.selectionEnd = 4;

    runTextareaFormatCommand('ta5', 'code');

    expect(ta.value).toBe('<code>Code</code> here');
  });

  it('wraps text in <s> for strikethrough', () => {
    const ta = makeTextarea('ta6', 'Strike this');
    ta.selectionStart = 0;
    ta.selectionEnd = 6;

    runTextareaFormatCommand('ta6', 'strikethrough');

    expect(ta.value).toBe('<s>Strike</s> this');
  });
});

describe('insertLink', () => {
  it('inserts an anchor tag with the supplied URL and text', () => {
    const ta = makeTextarea('ta7', 'Click here');
    ta.selectionStart = 0;
    ta.selectionEnd = 5;

    expect(insertLink('ta7', 'https://example.com', 'Visit')).toBe(true);

    expect(ta.value).toBe('<a href="https://example.com">Visit</a> here');
  });

  it('uses the selected text when no label is supplied', () => {
    const ta = makeTextarea('ta8', 'Click here');
    ta.selectionStart = 0;
    ta.selectionEnd = 5;

    expect(insertLink('ta8', '/events')).toBe(true);

    expect(ta.value).toBe('<a href="/events">Click</a> here');
  });

  it('escapes attribute-breaking URL characters and link text', () => {
    const ta = makeTextarea('ta9', 'Original');
    ta.selectionStart = 0;
    ta.selectionEnd = 8;

    expect(insertLink('ta9', 'https://example.com/?q="x"', '<Visit & learn>')).toBe(true);

    expect(ta.value).toBe(
      '<a href="https://example.com/?q=&quot;x&quot;">&lt;Visit &amp; learn&gt;</a>'
    );
  });

  it('rejects unsafe URLs without changing the textarea', () => {
    const ta = makeTextarea('ta10', 'Original');
    ta.selectionStart = 0;
    ta.selectionEnd = 8;

    expect(insertLink('ta10', 'javascript:alert(1)', 'Visit')).toBe(false);

    expect(ta.value).toBe('Original');
  });

  it('returns false when the textarea no longer exists', () => {
    expect(insertLink('missing', 'https://example.com', 'Visit')).toBe(false);
  });
});
