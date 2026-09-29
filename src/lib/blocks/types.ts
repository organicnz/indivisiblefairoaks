/**
 * Block model for the visual content editor.
 *
 * The editor is a *view* over the HTML that already lives in `content.body`.
 * Nothing is stored as JSON: the column is TEXT, and six consumers already read
 * it as HTML — the `[slug]` renderer, the OG image, the sitemap, full-text
 * search's generated `tsvector`, and two Supabase Edge Functions. Changing the
 * storage format would mean rewriting all of them for no benefit.
 *
 * The consequence is that the block model is bounded by what `sanitizeWPContent`
 * permits, which is a genuinely tight allowlist:
 *
 *   - `data-*` attributes are NOT allowed, so block identity and variant travel
 *     in `class`, which is. Hence the `cw-` (content widget) prefix. It avoids
 *     every prefix the sanitizer strips (wp-, elementor-, freshio-, woocommerce,
 *     yith-).
 *   - `iframe` is stripped, so there is deliberately no embed block. An editor
 *     button that cannot survive its own sanitizer is a fake control.
 *   - Three or more *directly adjacent* anchors are deleted as link spam, so
 *     button blocks each carry a wrapper element. See `BUTTON_WRAPPER_CLASS`.
 */

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'quote'
  | 'callout'
  | 'code'
  | 'image'
  | 'divider'
  | 'table'
  | 'button'
  | 'unsupported';

export const CALLOUT_TONES = ['info', 'action', 'warning'] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Levels offered in the editor. A page already renders an h1 from its title. */
export const INSERTABLE_HEADING_LEVELS: HeadingLevel[] = [2, 3, 4];

export const BLOCK_CLASS = 'cw';
export const CALLOUT_CLASS = `${BLOCK_CLASS}-callout`;
export const LIST_CLASS = `${BLOCK_CLASS}-list`;
export const QUOTE_CLASS = `${BLOCK_CLASS}-quote`;
export const CODE_CLASS = `${BLOCK_CLASS}-code`;
export const FIGURE_CLASS = `${BLOCK_CLASS}-figure`;
export const DIVIDER_CLASS = `${BLOCK_CLASS}-divider`;
export const TABLE_CLASS = `${BLOCK_CLASS}-table`;
export const BUTTON_CLASS = `${BLOCK_CLASS}-button`;
/**
 * Each button block is wrapped so that consecutive buttons are never three
 * directly adjacent anchors — `sanitizeWPContent` deletes that run as link spam,
 * which would silently eat a row of calls to action.
 */
export const BUTTON_WRAPPER_CLASS = `${BLOCK_CLASS}-action`;

interface BlockBase {
  id: string;
}

export type Block =
  | (BlockBase & { type: 'paragraph'; html: string })
  | (BlockBase & { type: 'heading'; level: HeadingLevel; html: string })
  | (BlockBase & { type: 'bulletList'; items: string[] })
  | (BlockBase & { type: 'orderedList'; items: string[] })
  | (BlockBase & { type: 'quote'; html: string })
  | (BlockBase & { type: 'callout'; tone: CalloutTone; html: string })
  | (BlockBase & { type: 'code'; text: string })
  | (BlockBase & {
      type: 'image';
      src: string;
      alt: string;
      caption: string;
      width: number | null;
      height: number | null;
    })
  | (BlockBase & { type: 'divider' })
  | (BlockBase & { type: 'table'; head: string[]; rows: string[][] })
  | (BlockBase & { type: 'button'; label: string; href: string })
  /**
   * Markup the model has no editor for — a `<figure>` with a nested table, a
   * definition list, something the migration left behind. Preserved verbatim and
   * rendered read-only so that opening a page in the editor and saving it does
   * not delete content it cannot represent.
   */
  | (BlockBase & { type: 'unsupported'; html: string });

let blockSeq = 0;

/** Monotonic ids: unique within a session, which is all React keys require. */
export function nextBlockId(): string {
  blockSeq += 1;
  return `b${blockSeq.toString(36)}`;
}

/** Test seam so generated markup is byte-comparable across runs. */
export function resetBlockIds(): void {
  blockSeq = 0;
}
