// @vitest-environment jsdom-same-realm
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentSurface } from '@/components/content/ContentSurface';
import { VISUAL_EDIT_CONTENT_ID_ATTR } from '@/lib/visual-edit-document';

/**
 * The one element that emits a CMS body is also the element that secures it.
 *
 * The sanitizer used to be a call-site convention: `[slug]` happened to call
 * `sanitizeWPContent` before passing a string in, so the boundary held for that
 * page and existed only as a comment for the next one. These tests pin the
 * behaviour where it now lives — if the call is removed, the component renders
 * a script tag and fails here rather than in production.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContentSurface', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (element: ReactElement) => {
    await act(async () => {
      root.render(element);
    });
  };

  it('sanitizes the body it renders, even when the caller passes it raw', async () => {
    await render(
      <ContentSurface html={'<p>Join us Saturday.</p><script>alert(1)</script>'} contentId={23} />
    );

    expect(container.textContent).toContain('Join us Saturday.');
    expect(container.querySelector('script')).toBeNull();
  });

  it('drops a removed container with its body rather than leaking the copy', async () => {
    await render(<ContentSurface html={'<p>Intro</p><form><p>Secret field copy</p></form>'} />);

    expect(container.textContent).toContain('Intro');
    expect(container.textContent).not.toContain('Secret field copy');
  });

  it('marks the visual-edit root and the row the composer should address', async () => {
    await render(<ContentSurface html="<p>Copy</p>" contentId={23} />);

    const surface = container.querySelector('[data-visual-edit-root]');
    expect(surface).not.toBeNull();
    expect(surface?.getAttribute(VISUAL_EDIT_CONTENT_ID_ATTR)).toBe('23');
  });

  it('omits the row marker on a public page, which edits by pathname', async () => {
    await render(<ContentSurface html="<p>Copy</p>" />);

    const surface = container.querySelector('[data-visual-edit-root]');
    expect(surface).not.toBeNull();
    expect(surface?.hasAttribute(VISUAL_EDIT_CONTENT_ID_ATTR)).toBe(false);
  });
});
