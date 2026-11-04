// @vitest-environment jsdom-same-realm

import { afterEach, describe, expect, it } from 'vitest';
import { readComposerContentId, VISUAL_EDIT_CONTENT_ID_ATTR } from '@/lib/visual-edit-document';

/**
 * The composer workspace's row address.
 *
 * The overlay resolves a document from the path, which is correct while the URL
 * names the row. The workspace is the case where it does not — `/compose/13`
 * has no slug — so the row id in the markup is the only thing that can say
 * which body is on screen. Reading the wrong number would load a different
 * page's copy while painting this page, which is the same class of failure the
 * block-id work fixed for moves.
 */

const ATTR = VISUAL_EDIT_CONTENT_ID_ATTR;

function pageWithRoot(html: string): HTMLElement {
  const main = document.createElement('main');
  main.innerHTML = html;
  document.body.appendChild(main);
  return main;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readComposerContentId', () => {
  it('reads the id from the visual-edit root', () => {
    pageWithRoot(`<div data-visual-edit-root ${ATTR}="13"></div>`);
    expect(readComposerContentId(document)).toBe(13);
  });

  it('reads an id on a descendant of the visual-edit root', () => {
    pageWithRoot(`<div data-visual-edit-root><div ${ATTR}="7"><p>Copy</p></div></div>`);
    expect(readComposerContentId(document)).toBe(7);
  });

  it('ignores a marker outside the visual-edit root', () => {
    pageWithRoot(`<div ${ATTR}="99"></div><div data-visual-edit-root></div>`);
    expect(readComposerContentId(document)).toBeNull();
  });

  it('falls back to the document before the page has rendered a root', () => {
    document.body.innerHTML = `<div ${ATTR}="5"></div>`;
    expect(readComposerContentId(document)).toBe(5);
  });

  it.each(['0', '-3', '12px', '0x10', '1.5', ''])('rejects %j', (raw) => {
    pageWithRoot(`<div data-visual-edit-root ${ATTR}="${raw}"></div>`);
    expect(readComposerContentId(document)).toBeNull();
  });

  it('returns null for a missing root and for null', () => {
    expect(readComposerContentId(null)).toBeNull();
    expect(readComposerContentId(undefined)).toBeNull();
  });
});
