/**
 * The prefix `saveContent` puts on a refused concurrent write.
 *
 * Shared by both editors so they cannot disagree about which failures are
 * conflicts (retrying is futile; reloading is the answer) versus ordinary
 * failures. The action owns the full message at `src/lib/actions/content.ts`.
 */
export const STALE_SAVE_CONFLICT_PREFIX = 'Someone else saved this page';

export function isStaleConflict(message: string | undefined): boolean {
  return typeof message === 'string' && message.startsWith(STALE_SAVE_CONFLICT_PREFIX);
}
