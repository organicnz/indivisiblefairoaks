import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';

/**
 * Three ways the editor could quietly do the wrong thing to a volunteer's work.
 *
 * The theme is reporting, not mechanics. Every one of these produced a
 * *successful-looking* result: the page went offline as asked, the save button
 * simply stopped responding, the toast cheerfully said "Published". None of them
 * is distinguishable from the editor working correctly, and two cost real work.
 *
 * **The Status dropdown.** `status` is part of the document snapshot, so a
 * control that only called `setStatus` — local state — flipped `dirty`, and the
 * autosave effect fired `persist(status)` 2.5 seconds later with the new status.
 * Choosing "Draft" for a live page took it off the site, with no confirmation
 * and no toast. It never called the guarded `handleSetStatus` the Publish button
 * uses, because that function used to be a no-argument toggle and a toggle
 * cannot express "the author picked Draft".
 *
 * **A save that never came back.** `handleSave` awaited `persist` and set
 * `saving = false` on the next line — which is not a guaranteed statement, since
 * a rejected promise skips it — and `saving` is what disables the Save button. A
 * dropped connection mid-save therefore left the editor permanently unable to
 * save itself, and the only recovery was a reload, which discards the document.
 * The autosave path had the same shape with no `.catch()` at all, so its
 * indicator sat on "Saving…" for the rest of the session while nothing was
 * written.
 *
 * **A publish that reported itself as unsaved.** `persist` snapshotted
 * `fields`, whose `status` is the value from *before* the write, so `dirty`
 * stayed true after a successful publish: the toast said "Published", the
 * indicator contradicted it in red, `beforeunload` warned about stored work, and
 * the autosave effect wrote the identical document again — a second
 * `content_revisions` row for a revision that changed nothing.
 *
 * Every test below fails against the code that shipped with these three bugs.
 * Read them as a description of what a volunteer is entitled to be told.
 */

const saveContent = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const deleteContent = vi.hoisted(() => vi.fn());
const duplicateContent = vi.hoisted(() => vi.fn());
const getContentRevisions = vi.hoisted(() => vi.fn());
const restoreContentRevision = vi.hoisted(() => vi.fn());
const uploadContentImage = vi.hoisted(() => vi.fn());
const deleteContentImage = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  setContentStatus,
  deleteContent,
  duplicateContent,
  getContentRevisions,
  restoreContentRevision,
  uploadContentImage,
  deleteContentImage,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('The editor cannot silently lose, unpublish, or misreport a page', () => {
  let container: HTMLDivElement;
  let root: Root;

  const initial = {
    id: 7,
    slug: 'meeting-notes',
    title: 'Meeting notes',
    body: '<p>March agenda</p>',
    excerpt: '',
    type: 'post',
    status: 'publish' as const,
    featuredImage: '',
    publishedAt: '2026-09-30T12:00:00.000Z' as string | null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    for (const m of [
      saveContent,
      setContentStatus,
      deleteContent,
      duplicateContent,
      getContentRevisions,
      restoreContentRevision,
      uploadContentImage,
      deleteContentImage,
    ]) {
      m.mockReset();
    }
    saveContent.mockResolvedValue({
      success: true,
      data: { id: 7, updatedAt: '2026-10-01T00:00:00Z' },
    });
    setContentStatus.mockResolvedValue({ success: true, data: { id: 7 } });
    toast.error.mockReset();
    toast.success.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (overrides: Record<string, unknown> = {}) => {
    act(() => {
      root.render(
        <ContentEditor
          initial={{ ...initial, ...overrides } as typeof initial}
          siteHost="indivisiblefairoaks.org"
        />
      );
    });
  };

  /**
   * Edit the body, then let BlockEditor's ~120ms coalesce timer land.
   *
   * Marking the document dirty through the title instead sounds equivalent and
   * is not: the editor renders several text inputs, and only the body is the
   * document body. Both flip `dirty`, but only this one exercises the path a
   * volunteer takes when writing prose.
   */
  const editBody = async (html: string) => {
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    act(() => {
      editable.innerHTML = html;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
  };

  const buttonLabelled = (label: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    ) as HTMLButtonElement;

  const statusSelect = () => container.querySelector('select') as HTMLSelectElement;

  const bodyText = () => container.textContent ?? '';

  const click = (el: HTMLElement) => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const chooseStatus = (value: 'draft' | 'publish') => {
    const select = statusSelect();
    // React tracks the select's value on the DOM node, so assigning `.value`
    // directly is not observed. Go through the prototype setter — the same
    // reason the codebase's other editor tests reach for it on inputs.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value'
    )?.set;
    act(() => {
      setter?.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  // ---------------------------------------------------------------------
  // The Status dropdown. Two controls named one state, and only one
  // of them could reach the function allowed to change it.
  // ---------------------------------------------------------------------
  // The Status dropdown. Two controls named one state, and only one
  // of them could reach the function allowed to change it.
  // ---------------------------------------------------------------------

  it('routes the Status dropdown through the guard, not local state', async () => {
    // A live page, clean document. The narrow `setContentStatus` path is correct
    // here, and it is exactly the path the dropdown never reached: it only ever
    // called `setStatus`, which is local state.
    render();

    expect(statusSelect().value).toBe('publish');

    await act(async () => {
      chooseStatus('draft');
    });

    expect(setContentStatus).toHaveBeenCalledWith(7, 'draft');
  });

  it('applies a chosen status immediately, not 2.5s later', async () => {
    // The old dropdown did nothing on the click at all, so it read as broken
    // rather than as dangerous.
    render();

    await act(async () => {
      chooseStatus('draft');
    });

    expect(setContentStatus).toHaveBeenCalledTimes(1);
  });

  it('sends the status the author chose, not the one it began from', async () => {
    // A toggle would reach `draft` from `publish` by accident of the current
    // value rather than by the author's choice. Asserting the argument, not
    // just that something was called.
    render({ status: 'draft' });

    await act(async () => {
      chooseStatus('publish');
    });

    expect(setContentStatus).toHaveBeenCalledWith(7, 'publish');
  });

  it('carries unsaved work out with a status change, not the status alone', async () => {
    // The other half of routing the dropdown through the guard: unsaved work
    // has to travel with the status change, or the write drops it.
    render();
    await editBody('<p>Meeting notes — revised</p>');

    await act(async () => {
      chooseStatus('draft');
    });

    // The same rule the Publish button follows: if anything is unsaved, the whole
    // document goes out at the new status.
    expect(saveContent).toHaveBeenCalledTimes(1);
    const payload = saveContent.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.status).toBe('draft');
    // The body travelling with it is what separates this from a status-only write.
    expect(payload.body).toContain('Meeting notes — revised');
    expect(setContentStatus).not.toHaveBeenCalled();
  });

  it('never writes through the dropdown alone, not even after the delay', async () => {
    // The old dropdown's only write was the delayed autosave one, so a test
    // checking synchronously would have seen an editor that had done nothing at
    // all, and passed.
    render();

    await act(async () => {
      chooseStatus('draft');
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // One write, from the guarded path, and nothing 2.5s later.
    expect(setContentStatus).toHaveBeenCalledTimes(1);
    expect(saveContent).not.toHaveBeenCalled();
  });

  it('settles on the chosen status after the autosave delay passes', async () => {
    // The old dropdown read "Draft" while the page was still published.
    render();

    await act(async () => {
      chooseStatus('draft');
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(statusSelect().value).toBe('draft');
    expect(setContentStatus).toHaveBeenCalledWith(7, 'draft');
  });

  it('reports a failed status change rather than leaving the dropdown to explain', async () => {
    // The author asked to take a page offline, it did not happen, and the control
    // has to say so.
    render();
    setContentStatus.mockResolvedValue({ success: false, error: 'Nope' });

    await act(async () => {
      chooseStatus('draft');
    });

    expect(setContentStatus).toHaveBeenCalledTimes(1);
    // Without the toast the dropdown keeps the value the author picked, so a page
    // still live reads as a draft, and the failure is invisible.
    expect(toast.error).toHaveBeenCalledWith('Nope');
    // And the select, bound to the persisted status, snaps back rather than
    // lying.
    expect(statusSelect().value).toBe('publish');
  });

  // ---------------------------------------------------------------------
  // A failed manual save is not an autosave failure, and a stale version is
  // not an ordinary failure. The banner is shared by both write paths, so it
  // has to name the path that actually failed — and a colleague's newer save
  // has no working "try again".
  // ---------------------------------------------------------------------

  it('names a failed manual save as a save failure, not an autosave failure', async () => {
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockResolvedValue({ success: false, error: 'slug is already taken' });

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(bodyText()).toMatch(/Save failed: slug is already taken/);
    expect(bodyText()).not.toMatch(/Autosave failed/);
    const alert = container.querySelector('div[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Try again');
  });

  it('offers reload, not retry, when a colleague saved first', async () => {
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockResolvedValue({
      success: false,
      error:
        'Someone else saved this page while you were editing it. Reload to see their version, then reapply your changes.',
    });

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(bodyText()).toMatch(/Another editor saved this page/);
    expect(bodyText()).toMatch(/copy your unsaved text first/);
    const alert = container.querySelector('div[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Reload onto their version');
    expect(alert.textContent).not.toContain('Try again');
  });

  // ---------------------------------------------------------------------
  // A save that never came back. A rejected promise is not a failed result,
  // and only the returned failure was being handled.
  // ---------------------------------------------------------------------

  it('leaves the editor saveable after a rejected save, not stuck shut', async () => {
    // The headline failure. `setSaving(false)` sat on the line after the await —
    // not a guaranteed statement, since a rejection skips it — and `saving` is
    // what disables the button. One unreachable save left the editor
    // permanently unable to save, recoverable only by a reload that loses the
    // document.
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockRejectedValue(new Error('Failed to fetch'));

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(buttonLabelled('Save').disabled).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('surfaces the rejection as an error rather than swallowing it', async () => {
    // Silence is what made the original failure invisible: no toast, no
    // banner, and a button that simply stopped responding.
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockRejectedValue(new Error('Failed to fetch'));

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    expect(toast.error).toHaveBeenCalled();
    expect(bodyText()).toMatch(/not saved|could not reach/i);
  });

  it('keeps the document after a rejected save, so nothing is retyped', async () => {
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockRejectedValue(new Error('Failed to fetch'));

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    // A recoverable save is only recoverable if the text is still on
    // screen to save again.
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable.innerHTML).toContain('Half an afternoon of work');
    // And the author can retry immediately, rather than being locked out.
    expect(buttonLabelled('Save').disabled).toBe(false);
  });

  it('says the change was not saved, and to copy the text before reloading', async () => {
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockRejectedValue(new Error('Failed to fetch'));

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const message = String(toast.error.mock.calls[0]?.[0] ?? '');
    // Both halves matter. "Not saved" is the fact. "Copy it first" is what saves
    // the work, because the next move is a reload.
    expect(message).toMatch(/not saved/i);
    expect(message).toMatch(/copy it before/i);
    expect(bodyText()).toMatch(/copy it before/i);
  });

  it('stops claiming to be saving when autosave cannot reach the server', async () => {
    // Autosave waited 2.5s and then wrote nothing, silently: no failed
    // request to notice, only an indicator claiming otherwise for as long as the
    // tab stayed open. `void persist(...).then(...)` had no `.catch()`, so
    // `saveState` never left 'saving' and `activeSaveFailure` was never set.
    render();
    await editBody('<p>Typed into the block editor</p>');
    saveContent.mockRejectedValue(new Error('Failed to fetch'));

    await act(async () => {
      // Autosave waits 2.5s after the document goes dirty.
      vi.advanceTimersByTime(5000);
    });

    // Assert the write was attempted first: without it, "not saving…" passes
    // trivially on an editor that never tried to save at all.
    expect(saveContent).toHaveBeenCalled();
    expect(bodyText()).not.toMatch(/saving…/i);
    // The banner has to name the trap, not just the state.
    expect(bodyText()).toMatch(/copy it before/i);
  });

  it('tells the author to copy their text, not only that it failed', async () => {
    // "Failed to fetch" means nothing to a volunteer. The reflex on seeing
    // a failed save is to reload, and reload is what loses the work.
    render();
    await editBody('<p>Half an afternoon of work</p>');
    saveContent.mockRejectedValue(new Error('Failed to fetch'));

    await act(async () => {
      click(buttonLabelled('Save'));
    });

    const message = String(toast.error.mock.calls[0]?.[0] ?? '');
    expect(message).toMatch(/copy it before/i);
    // And on screen, not only in a toast that disappears.
    expect(bodyText()).toMatch(/copy it before/i);
  });

  // ---------------------------------------------------------------------
  // A publish that called itself unsaved, and then wrote the document twice.
  // ---------------------------------------------------------------------

  it('does not claim "unsaved changes" after a successful publish', async () => {
    // A dirty publish reaches `persist`, which is where the snapshot was wrong. A
    // clean one takes the narrow `setContentStatus` path, which already got it
    // right, so a clean start would prove nothing about the bug.
    render({ status: 'draft' });
    await editBody('<p>Meeting notes — revised</p>');

    await act(async () => {
      click(buttonLabelled('Publish'));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Published');
    // The contradiction: the toast said "Published" and the indicator then said
    // the work was still unsaved.
    expect(bodyText()).not.toMatch(/unsaved changes/i);
  });

  it('writes the document once when a publish stores it, not twice', async () => {
    // The phantom `dirty` re-armed the autosave effect, which wrote the document
    // again 2.5s later: a second `content_revisions` row per publish, and a
    // history panel that lied about how often the page was touched.
    render({ status: 'draft' });
    await editBody('<p>Meeting notes — revised</p>');

    await act(async () => {
      click(buttonLabelled('Publish'));
    });
    expect(saveContent).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Still exactly one write. The second is the tell that a successful save left
    // `dirty` true.
    expect(saveContent).toHaveBeenCalledTimes(1);
  });

  it('leaves the document dirty after a failed publish, never falsely clean', async () => {
    render({ status: 'draft' });
    await editBody('<p>Meeting notes — revised</p>');
    saveContent.mockResolvedValue({ success: false, error: 'Nope' });

    await act(async () => {
      click(buttonLabelled('Publish'));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    // Adopting the post-write status is correct only on the success branch. On
    // failure it would mark unsaved work as stored — the original class of bug,
    // in a new place.
    expect(toast.error).toHaveBeenCalledWith('Nope');
    expect(bodyText()).toMatch(/unsaved|nope/i);
  });
});
