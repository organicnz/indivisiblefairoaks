/**
 * Visual edit mode — the pure half.
 *
 * The navbar's editorial button toggles a site-wide "visual editing" state. This
 * module owns the two things that state consists of — where it is persisted and
 * how a rendered page is divided into addressable sections — and nothing else.
 * It is deliberately free of React so both halves are unit-testable without a
 * component harness, and so the same rules the header button follows are the
 * rules the drawer row and the overlay follow.
 *
 * Two design constraints shaped it.
 *
 * **The mode is persisted, not per-navigation.** An admin turning on visual
 * editing expects it to still be on after following a link; component-local state in the
 * header drops the moment the header re-renders on a route change.
 *
 * **A section is read from the live DOM, never from the stored HTML.** The
 * public page renders a sanitized body blob into the document.
 * Re-parsing that string to insert wrappers would mean re-introducing markup the
 * sanitizer does not allow, and a mismatch would either vanish on the next save
 * or reach the reader. Reading the already-rendered children and highlighting a
 * node transiently cannot corrupt anything the database holds.
 */

/** Where the per-browser preference lives. Namespaced: localStorage is shared. */
export const VISUAL_EDIT_STORAGE_KEY = 'indivisible:visual-edit-mode';

/**
 * The query parameter that carries the mode in the URL.
 *
 * Purely additive: an admin can share a link with the mode already on, and the
 * param is stripped from the canonical URL rather than accumulated, so it can
 * never leak into an og:url or a sitemap entry.
 */
export const VISUAL_EDIT_PARAM = 'visual-edit';

/**
 * Read the persisted mode. Any storage that throws — Safari private browsing,
 * a quota error, a Storage object stubbed by a test — reads as off rather than
 * taking the page down.
 */
export function readVisualEditMode(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return storage?.getItem(VISUAL_EDIT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Write the persisted mode. Same contract as the read: a failing storage is a
 * preference that does not survive, not an error the operator must see.
 */
export function writeVisualEditMode(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
  enabled: boolean
): void {
  try {
    if (enabled) storage?.setItem(VISUAL_EDIT_STORAGE_KEY, '1');
    else storage?.removeItem(VISUAL_EDIT_STORAGE_KEY);
  } catch {
    // A preference that cannot be stored is a preference that resets on reload.
    // The mode still works for this navigation, which is the part the admin sees.
  }
}

/**
 * The mode as expressed by a URL, or null when the URL says nothing.
 *
 * Null rather than false on absence: "no opinion" and "explicitly off" are
 * different instructions, and collapsing them would make a shared `?visual-edit=0`
 * link indistinguishable from a URL that never mentioned it.
 */
export function visualEditModeFromSearchParams(
  search: string | URLSearchParams | null | undefined
): boolean | null {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? '');
  const raw = params.get(VISUAL_EDIT_PARAM);
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '' || normalized === '1' || normalized === 'true' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'off') {
    return false;
  }
  return null;
}

/**
 * Build a URL for the same pathname with the mode set or cleared.
 *
 * Every other parameter is preserved: an admin mid-filter should not lose the
 * filter because they toggled a mode.
 */
export function visualEditModeHref(pathname: string, enabled: boolean): string {
  const [path, existingQuery = ''] = pathname.split('?');
  const params = new URLSearchParams(existingQuery);
  if (enabled) params.set(VISUAL_EDIT_PARAM, '1');
  else params.delete(VISUAL_EDIT_PARAM);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * One addressable section of a rendered page.
 *
 * `index` is the position among the container's element children and is what the
 * overlay scrolls to. `label` is the section's heading text when it has one, so
 * the list an admin reads says something about the page rather than "Block 4".
 */
export interface PageSection {
  index: number;
  label: string;
}

/** The heading-most element a section announces itself with. */
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/**
 * Collect the sections of an already-rendered container.
 *
 * Only element children are counted, and only ones that carry a heading — an
 * element with no heading is not a section an admin can name, and listing it as
 * "Section 3" would be a control that does nothing. Text nodes from the HTML
 * blob are skipped rather than folded into the previous section.
 *
 * Returns `[]` for anything that is not a living DOM (a null container, a
 * detached node with no children), which the overlay reads as "nothing to edit
 * here" and hides itself.
 */
export function collectPageSections(root: ParentNode | null | undefined): PageSection[] {
  if (!root || typeof (root as ParentNode).querySelectorAll !== 'function') return [];
  const children = Array.from(root.children);
  const sections: PageSection[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!(child instanceof globalThis.HTMLElement) && !isElementLike(child)) continue;
    const label = sectionLabel(child);
    if (!label) continue;
    sections.push({ index, label });
  }
  return sections;
}

/**
 * Elements in every environment this runs in: jsdom gives a real
 * `globalThis.HTMLElement`, but a stubbed node in a test may not inherit it, and
 * rejecting it because of the constructor rather than the shape would make the
 * helper report "no sections" on a container full of them.
 */
function isElementLike(node: Node): boolean {
  return typeof (node as Element).tagName === 'string' && 'querySelector' in node;
}

/** The heading text of a section, truncated to something a list item can hold. */
const MAX_SECTION_LABEL = 80;

function sectionLabel(section: Element): string | null {
  const heading = section.querySelector(HEADING_SELECTOR);
  const text = collapse(heading?.textContent ?? '');
  if (text) return text.slice(0, MAX_SECTION_LABEL);

  // No heading: an element that is itself a heading is still a section.
  if (section.tagName === 'H1' || section.tagName === 'H2') {
    const own = collapse(section.textContent ?? '');
    return own ? own.slice(0, MAX_SECTION_LABEL) : null;
  }
  return null;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Visually highlight and smooth-scroll to an addressable page section.
 */
export function highlightPageSection(
  element: HTMLElement | null | undefined,
  options?: { durationMs?: number; reduceMotion?: boolean }
): void {
  if (!element || typeof element.animate !== 'function') return;
  const reduceMotion =
    options?.reduceMotion ??
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const duration = options?.durationMs ?? (reduceMotion ? 500 : 1600);
  const accent =
    (typeof window !== 'undefined' &&
      getComputedStyle(document.documentElement).getPropertyValue('--accent-gold').trim()) ||
    '#f59e0b';

  element.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'center',
  });

  element.animate(
    [
      { boxShadow: `0 0 0 0 ${accent}` },
      { boxShadow: `0 0 0 4px ${accent}` },
      { boxShadow: `0 0 0 0 ${accent}` },
    ],
    { duration, easing: 'ease-out' }
  );
}
