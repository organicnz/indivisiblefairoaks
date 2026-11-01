/**
 * Which CMS row a page hands to the visual composer.
 *
 * The overlay has always resolved its document from the pathname: a `[slug]`
 * page is its row, and a coded page's editable unit is a copy region. That
 * works while the URL names the row, and fails for a row whose public path is
 * shadowed by a route or a legacy redirect — every migrated page today. The
 * dedicated composer workspace (`/compose/[id]`) is that missing surface, and
 * this attribute is how it names its row without teaching the overlay about
 * the admin route.
 *
 * Pure DOM, no React: the overlay, the page and the tests all read the same
 * rule, and the marker can be unit-tested without a component harness.
 */

/** The attribute the composer workspace puts on its addressable row. */
export const VISUAL_EDIT_CONTENT_ID_ATTR = 'data-visual-edit-content-id';

/** The `visual-edit` root marker, duplicated here to keep this module React-free. */
const VISUAL_EDIT_ROOT_ATTR = 'data-visual-edit-root';

/**
 * The positive integer row id declared under `root`, or null.
 *
 * Scoped to the visual-edit root rather than the whole document: a page can
 * contain other admin chrome that happens to carry an id, and the composer
 * must edit the row whose body it is painting, not whichever number appears
 * first in the DOM. When there is no marked root yet — the overlay mounts
 * before a page has rendered one — the whole document is searched, which is
 * what lets the workspace's first load resolve.
 *
 * Only a canonical positive integer is accepted. `Number('12px')` is NaN and
 * `Number('0x10')` is 16; a value that does not round-trip through
 * `String(id)` after trimming is a typo in the markup rather than an id, and
 * loading a different row would be worse than falling back to the slug.
 */
export function readComposerContentId(root: ParentNode | null | undefined): number | null {
  if (!root || typeof root.querySelector !== 'function') return null;

  const scope = root.querySelector(`[${VISUAL_EDIT_ROOT_ATTR}]`) ?? root;
  const element = scope as Element;
  const own =
    typeof element.getAttribute === 'function'
      ? element.getAttribute(VISUAL_EDIT_CONTENT_ID_ATTR)
      : null;
  const raw = (
    scope
      .querySelector(`[${VISUAL_EDIT_CONTENT_ID_ATTR}]`)
      ?.getAttribute(VISUAL_EDIT_CONTENT_ID_ATTR) ?? own
  )?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;

  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 && String(id) === raw ? id : null;
}
