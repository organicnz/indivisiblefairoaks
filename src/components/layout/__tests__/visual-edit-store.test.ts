// @vitest-environment jsdom-same-realm
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerVisualEditExitGuard,
  setVisualEditMode,
  syncVisualEditMode,
  toggleVisualEditMode,
} from '@/components/layout/visual-edit-store';
import { VISUAL_EDIT_STORAGE_KEY } from '@/lib/visual-edit-mode';

/**
 * The mode is shared by the header, the command palette and the editor rail.
 * If any of them can turn it off while the overlay owns a draft, the draft is
 * gone before its Save/Cancel decision can run. The guard is the common veto.
 */
describe('visual edit exit guard', () => {
  afterEach(() => {
    registerVisualEditExitGuard(null);
    setVisualEditMode(false);
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('keeps the mode on when the mounted editor vetoes leaving', () => {
    setVisualEditMode(true);
    const guard = vi.fn(() => false);
    registerVisualEditExitGuard(guard);

    toggleVisualEditMode();

    expect(guard).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(VISUAL_EDIT_STORAGE_KEY)).toBe('1');
  });

  it('allows the exit once the editor releases the veto', () => {
    setVisualEditMode(true);
    const guard = vi.fn(() => true);
    registerVisualEditExitGuard(guard);

    toggleVisualEditMode();

    expect(guard).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(VISUAL_EDIT_STORAGE_KEY)).toBeNull();
  });

  it('does not consult the exit guard when turning the mode on', () => {
    const guard = vi.fn(() => false);
    registerVisualEditExitGuard(guard);

    setVisualEditMode(true);

    expect(guard).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(VISUAL_EDIT_STORAGE_KEY)).toBe('1');
  });

  it('does not let a URL preference override the mounted editor veto', () => {
    setVisualEditMode(true);
    const guard = vi.fn(() => false);
    registerVisualEditExitGuard(guard);
    window.history.replaceState({}, '', '/?visual-edit=0');

    syncVisualEditMode('/');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(VISUAL_EDIT_STORAGE_KEY)).toBe('1');
  });
});
