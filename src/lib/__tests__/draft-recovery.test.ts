// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDraft,
  DRAFT_MAX_AGE_MS,
  draftKey,
  isWorthRecovering,
  readDraft,
  writeDraft,
} from '@/lib/draft-recovery';

const NOW = 1_800_000_000_000;

describe('draft recovery storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a draft', () => {
    writeDraft(7, '{"title":"Hello"}', NOW);
    expect(readDraft(7, NOW + 1000)).toEqual({
      snapshot: '{"title":"Hello"}',
      savedAt: NOW,
    });
  });

  it('keys by content id, so two open pages do not share a draft', () => {
    // An editor open on two different pages would otherwise offer one page's
    // text on the other.
    writeDraft(7, '{"title":"Seven"}', NOW);
    writeDraft(8, '{"title":"Eight"}', NOW);
    expect(readDraft(7, NOW)?.snapshot).toContain('Seven');
    expect(readDraft(8, NOW)?.snapshot).toContain('Eight');
  });

  it('returns null when nothing is stored', () => {
    expect(readDraft(7, NOW)).toBeNull();
  });

  it('discards a corrupt entry instead of throwing', () => {
    // The draft is a cache. A bad entry must not be able to break the editor.
    window.localStorage.setItem(draftKey(7), '{not json');
    expect(readDraft(7, NOW)).toBeNull();

    window.localStorage.setItem(draftKey(7), JSON.stringify({ snapshot: 42 }));
    expect(readDraft(7, NOW)).toBeNull();

    window.localStorage.setItem(draftKey(7), JSON.stringify({ nope: true }));
    expect(readDraft(7, NOW)).toBeNull();
  });

  it('discards and removes a draft older than a week', () => {
    // A week-old draft is not a rescue, and offering one is a confusing thing to
    // find in an editor.
    writeDraft(7, '{"title":"Ancient"}', NOW - DRAFT_MAX_AGE_MS - 1);
    expect(readDraft(7, NOW)).toBeNull();
    expect(window.localStorage.getItem(draftKey(7))).toBeNull();
  });

  it('keeps a draft just inside the window', () => {
    writeDraft(7, '{"title":"Recent"}', NOW - DRAFT_MAX_AGE_MS + 1000);
    expect(readDraft(7, NOW)?.snapshot).toContain('Recent');
  });

  it('clears a draft on request', () => {
    writeDraft(7, '{"title":"Bye"}', NOW);
    clearDraft(7);
    expect(readDraft(7, NOW)).toBeNull();
  });

  it('survives a storage quota failure without breaking the editor', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // A full quota must not break editing. The draft is a nicety; the editor is
    // the product.
    expect(() => writeDraft(7, 'x', NOW)).not.toThrow();
    setItem.mockRestore();
  });
});

describe('isWorthRecovering', () => {
  it('is false when nothing is stored', () => {
    expect(isWorthRecovering(null, '{"title":"Same"}', NOW)).toBe(false);
  });

  it('is false when the draft matches what the server sent', () => {
    // The author typed and undid their way back. "We recovered your work" for
    // that is noise.
    const snapshot = '{"title":"Same"}';
    expect(isWorthRecovering({ snapshot, savedAt: NOW }, snapshot, NOW)).toBe(false);
  });

  it('is true when the draft differs', () => {
    expect(
      isWorthRecovering(
        { snapshot: '{"title":"Different"}', savedAt: NOW },
        '{"title":"Same"}',
        NOW
      )
    ).toBe(true);
  });

  it('is false once the draft is too old, even if it differs', () => {
    const old = { snapshot: '{"title":"Ancient"}', savedAt: NOW - DRAFT_MAX_AGE_MS - 1 };
    expect(isWorthRecovering(old, '{"title":"Same"}', NOW)).toBe(false);
  });
});
