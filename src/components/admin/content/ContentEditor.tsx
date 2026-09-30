'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  History,
  Loader2,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  type ContentRevision,
  deleteContent,
  duplicateContent,
  getContentForEdit,
  getContentRevisions,
  restoreContentRevision,
  saveContent,
  setContentStatus,
} from '@/lib/actions/content';
import { type Block, isTransient, parseHtml, serializeBlocks } from '@/lib/blocks';
import { CONTENT_TYPES, type ContentType, readingStats, slugifyTitle } from '@/lib/content';
import { clearDraft, isWorthRecovering, readDraft, writeDraft } from '@/lib/draft-recovery';
import {
  canRedo,
  canUndo,
  type History as EditorHistory,
  EMPTY_HISTORY,
  record as recordHistory,
  redo as redoHistory,
  undo as undoHistory,
} from '@/lib/editor-history';
import { htmlToExcerpt } from '@/lib/sanitize';
import { BlockEditor } from './BlockEditor';

export interface ContentEditorInitial {
  id?: number;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  status: string;
  body: string | null;
  featuredImage: string | null;
}

interface Props {
  initial: ContentEditorInitial;
  /** Rendered on the server so the search preview has no hydration mismatch. */
  siteHost: string;
}

/** The shape compared to detect unsaved edits. Defined once so save, publish,
 *  restore and the indicator can never disagree about what "saved" means. */
interface EditorFields {
  title: string;
  slug: string;
  excerpt: string;
  type: ContentType;
  status: 'publish' | 'draft';
  featuredImage: string;
  body: string;
}

/** The failure branch of a save, so `persist` keeps a narrow union return type. */
type SaveFailure = { success: false; error: string };

function snapshotOf(fields: EditorFields): string {
  return JSON.stringify(fields);
}

function fieldsFromRow(row: {
  title: string;
  slug: string;
  excerpt: string | null;
  type: string | null;
  status: string | null;
  featured_image: string | null;
  body: string | null;
}): EditorFields {
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    type: (row.type as ContentType) ?? 'page',
    status: row.status === 'publish' ? 'publish' : 'draft',
    featuredImage: row.featured_image ?? '',
    body: row.body ?? '',
  };
}

export function ContentEditor({ initial, siteHost }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  // A slug is only auto-derived while the author has not taken it over. An
  // existing page starts "touched" so saving never renames a live URL by
  // accident, however the title is edited afterwards.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? '');
  const [type, setType] = useState<ContentType>((initial.type as ContentType) ?? 'page');
  const [status, setStatus] = useState<'publish' | 'draft'>(
    initial.status === 'publish' ? 'publish' : 'draft'
  );
  const [featuredImage, setFeaturedImage] = useState(initial.featuredImage ?? '');
  const [blocks, setBlocks] = useState<Block[]>(() => parseHtml(initial.body ?? ''));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);

  /**
   * Autosave.
   *
   * The unsaved-changes warning is necessary but not sufficient: it protects a
   * deliberate navigation and nothing else. A browser crash, a closed laptop, a
   * dropped connection or a mis-click in another tab loses everything, and on a
   * long page that is a real afternoon of someone's work.
   *
   * Three rules, each of which exists to prevent autosave making things worse:
   *
   *   1. It never changes a page's publish state. It re-persists the document
   *      with the status it already has, so it cannot take a live page down and
   *      cannot put a draft up. Publishing stays a deliberate act.
   *   2. It never creates a page from nothing. A title with no body is not a
   *      page, and a directory full of empty rows is worse than no autosave.
   *   3. It backs off, and stops entirely on a failure, so a server error does
   *      not become a retry loop hammering the database every few seconds.
   */
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // The serialized body is derived, never tracked separately — so the save path
  // and the preview below cannot drift from what the blocks actually contain.
  const body = useMemo(() => serializeBlocks(blocks), [blocks]);
  const stats = useMemo(() => readingStats(body), [body]);
  const derivedExcerpt = useMemo(() => htmlToExcerpt(body, 155), [body]);

  // Unsaved-changes state is *derived* by comparing the document against the
  // last known persisted state, rather than flipped to true by an effect. A flag
  // set on every keystroke has to be reset on every save, and any path that
  // forgets — a failed request, a restore, a server-side status change — leaves
  // the editor claiming unsaved work that is already stored.
  const fields = useMemo<EditorFields>(
    () => ({ title, slug, excerpt, type, status, featuredImage, body }),
    [body, excerpt, featuredImage, slug, status, title, type]
  );
  const snapshot = useMemo(() => snapshotOf(fields), [fields]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  /**
   * Undo/redo.
   *
   * Snapshot-based, and only the two directions are held — the live fields stay
   * the present, so there is no second copy of the document to drift out of sync
   * with what the author sees. The snapshot string is the same one that decides
   * whether the page is dirty, so "undo restored a document" and "the page is
   * clean" can never mean different things.
   *
   * History is recorded by diffing the snapshot, because by the time any effect
   * can observe a change the model has already been replaced: the handler that
   * caused it holds the *next* value, not the one being replaced. Reading the
   * previous value from a ref is what makes undo return here rather than to
   * wherever this hook happened to mount.
   *
   * `coalesceKey` is set by the handler that caused the change, because only it
   * knows the intent. Typing in a block and deleting a block are both "the model
   * changed", but one is a keystroke and the other is a decision, and undo has to
   * tell them apart.
   */
  const [undoStack, setUndoStack] = useState<EditorHistory>(EMPTY_HISTORY);
  const previousSnapshot = useRef(snapshot);
  const coalesceKey = useRef<string | null>(null);
  /**
   * Set when a change is one we made ourselves — an undo, a redo, a restored
   * draft. Without it, any snapshot that does not round-trip to the identical
   * string (a draft written by an older version, say) is recorded as a fresh
   * edit, and the author gets two steps to undo where they expect one.
   */
  const appliedByUs = useRef(false);

  useEffect(() => {
    // Both refs are read into locals first, and the ref is advanced before the
    // state is set. A functional updater runs later, during the re-render, by
    // which time this effect has already overwritten the refs — so reading them
    // from inside the updater compares the new snapshot with itself, finds no
    // change, and records nothing. Undo then has an empty stack and silently
    // does nothing, which is the worst shape a broken feature can take.
    const previous = previousSnapshot.current;
    if (appliedByUs.current) {
      appliedByUs.current = false;
      previousSnapshot.current = snapshot;
      return;
    }
    if (previous === snapshot) return;
    const key = coalesceKey.current;
    previousSnapshot.current = snapshot;
    coalesceKey.current = null;
    setUndoStack((h) => recordHistory(h, previous, snapshot, key));
  }, [snapshot]);

  const applySnapshot = useCallback((value: string) => {
    const fields = JSON.parse(value) as EditorFields;
    setTitle(fields.title);
    setSlug(fields.slug);
    setExcerpt(fields.excerpt);
    setType(fields.type);
    setStatus(fields.status);
    setFeaturedImage(fields.featuredImage);
    setBlocks(parseHtml(fields.body));
  }, []);

  /**
   * Both directions read the stack directly rather than through a functional
   * update, because restoring the document is a setState of its own and a
   * functional updater is not a place to put one — React may run it twice, and
   * the second run would apply the snapshot to a document already restored.
   */
  const handleUndo = useCallback(() => {
    const result = undoHistory(undoStack, snapshot);
    if (!result) return;
    // Flag the ref before the state lands, so the recording effect knows this
    // change was ours and does not push an entry for the undo itself.
    appliedByUs.current = true;
    previousSnapshot.current = result.restore;
    applySnapshot(result.restore);
    setUndoStack(result.history);
  }, [applySnapshot, snapshot, undoStack]);

  const handleRedo = useCallback(() => {
    const result = redoHistory(undoStack, snapshot);
    if (!result) return;
    appliedByUs.current = true;
    previousSnapshot.current = result.restore;
    applySnapshot(result.restore);
    setUndoStack(result.history);
  }, [applySnapshot, snapshot, undoStack]);

  /** Note the intent of an edit before it is committed. */
  const noteEdit = useCallback((key: string | null) => {
    coalesceKey.current = key;
  }, []);

  /**
   * Local draft recovery.
   *
   * Autosave leaves a 2.5s window where the document exists only in this tab.
   * A crash inside that window loses it, and `content_revisions` cannot help
   * because it records persisted states. So a copy is kept in localStorage as the
   * author types and offered back when they return.
   *
   * It is never applied automatically. A recovered draft is a claim — the author
   * decides, and the alternative is a local copy silently reverting a colleague's
   * newer edit.
   */
  const [recovered, setRecovered] = useState<{ snapshot: string; savedAt: number } | null>(null);

  /**
   * What the server sent at mount. Held in a ref so the one-time recovery check
   * compares against it without depending on a value that changes on every
   * keystroke — which is both the honest dependency and the correct semantics:
   * the question is "does this draft differ from the page I was given", not
   * "does it differ from what I have typed since".
   */
  const serverSnapshot = useRef(snapshot);

  useEffect(() => {
    if (!initial.id) return;
    // Offered on arrival only. Re-checking on every render would re-prompt for a
    // draft the author is already looking at.
    const draft = readDraft(initial.id);
    if (isWorthRecovering(draft, serverSnapshot.current)) setRecovered(draft);
  }, [initial.id]);

  useEffect(() => {
    if (!initial.id || recovered) return;
    if (!dirty) {
      clearDraft(initial.id);
      return;
    }
    const timer = setTimeout(() => writeDraft(initial.id as number, snapshot), 400);
    return () => clearTimeout(timer);
  }, [dirty, initial.id, recovered, snapshot]);

  const acceptRecovery = useCallback(() => {
    if (!recovered) return;
    // Pushed as one undoable step, so accepting by mistake is recoverable rather
    // than merely regrettable.
    const restored = recovered.snapshot;
    appliedByUs.current = true;
    previousSnapshot.current = restored;
    setUndoStack((h) => recordHistory(h, snapshot, restored, null));
    applySnapshot(restored);
    setRecovered(null);
  }, [applySnapshot, recovered, snapshot]);

  const discardRecovery = useCallback(() => {
    setRecovered(null);
    if (initial.id) clearDraft(initial.id);
  }, [initial.id]);

  /**
   * A failed autosave belongs to the document that produced it, so it records the
   * snapshot it was written against. The next edit produces a different snapshot
   * and the failure stops applying — no clearing effect, and no way for a stale
   * error to be showing against content that has since changed.
   */
  const [saveFailure, setSaveFailure] = useState<{ snapshot: string; message: string } | null>(
    null
  );
  const activeSaveFailure = saveFailure?.snapshot === snapshot ? saveFailure.message : null;

  const handleSaveRef = useRef<() => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;

      // Cmd/Ctrl+S: the browser's "save the page" dialog is never what an author
      // means inside an editor.
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveRef.current();
        return;
      }

      // Undo/redo are intercepted rather than left to the browser. Inside a
      // contenteditable the native version walks the DOM's own edit history,
      // which knows nothing about the block model — it would undo a character
      // the model no longer has, and silently disagree with what is on screen.
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoRef.current();
        else undoRef.current();
        return;
      }
      // Cmd+Y is the Windows spelling of redo; both are expected to work.
      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /**
   * The one path a block edit takes into the document, so the intent for undo
   * is captured at the same moment the model changes. Routing it through
   * `setBlocks` directly would leave the editor unable to tell a keystroke from
   * a block deletion.
   */
  const handleBlocksChange = useCallback(
    (next: Block[], intent: string | null = null) => {
      noteEdit(intent);
      setBlocks(next);
    },
    [noteEdit]
  );

  const onTitleChange = useCallback(
    (value: string) => {
      noteEdit('type:title');
      setTitle(value);
      if (!slugTouched) setSlug(slugifyTitle(value));
    },
    [noteEdit, slugTouched]
  );

  /**
   * The one write path. Both the Save button and autosave go through it, so they
   * cannot diverge in what they persist or in how they report failure.
   */
  const persist = useCallback(
    async (
      nextStatus: 'publish' | 'draft'
    ): Promise<
      { success: true; data: { id: number }; status: 'publish' | 'draft' } | SaveFailure
    > => {
      const result = await saveContent({
        id: initial.id,
        title: title.trim(),
        slug,
        excerpt: excerpt.trim() || null,
        type,
        status: nextStatus,
        body,
        featuredImage: featuredImage.trim() || null,
        metadata: {},
      });
      if (result.success) {
        setSavedSnapshot(snapshotOf(fields));
        setStatus(nextStatus);
        return { success: true, data: result.data, status: nextStatus };
      }
      return { success: false, error: result.error };
    },
    [body, excerpt, featuredImage, fields, initial.id, slug, title, type]
  );

  const handleSave = useCallback(
    async (nextStatus?: 'publish' | 'draft') => {
      if (saving) return;
      if (!title.trim()) {
        setError('Give the page a title before saving.');
        return;
      }
      // A document that is still just the placeholder block has no content.
      // Writing it would create a live, empty page, so say so instead.
      if (blocks.length === 1 && isTransient(blocks[0])) {
        setError('Add some content before saving.');
        return;
      }
      setSaving(true);
      setError(null);
      const result = await persist(nextStatus ?? status);
      setSaving(false);

      if (!result.success) {
        setError(result.error);
        setSaveFailure({ snapshot, message: result.error });
        toast.error(result.error);
        return;
      }
      setSaveFailure(null);
      toast.success(result.status === 'publish' ? 'Published' : 'Draft saved');
      if (!initial.id) {
        router.replace(`/admin/content/${result.data.id}`);
      }
      router.refresh();
    },
    [blocks, initial.id, persist, router, saving, snapshot, status, title]
  );

  // Cmd+S reaches the same guarded path as the button.
  useEffect(() => {
    handleSaveRef.current = () => {
      void handleSave();
    };
  }, [handleSave]);

  useEffect(() => {
    undoRef.current = handleUndo;
    redoRef.current = handleRedo;
  }, [handleRedo, handleUndo]);

  /**
   * Autosave, one debounced write behind the last edit.
   *
   * The delay matters as much as the write: the block editor emits a model
   * change per keystroke, and saving each one would mean a database write and a
   * new revision per character. Idle time is also the natural boundary — an
   * author who stopped typing has stopped changing their mind.
   *
   * It persists with the document's *current* status and never changes it. An
   * earlier version hardcoded `draft` here, which meant that editing a live
   * page and pausing for two seconds quietly took it offline — the worst
   * possible failure for a feature whose entire purpose is to be uneventful.
   * Taking a page down stays a deliberate act, via the Save button.
   */
  useEffect(() => {
    // Nothing worth saving yet. A title with no body is not a page.
    if (!title.trim() || (blocks.length === 1 && isTransient(blocks[0]))) return;
    // Only an existing page is autosaved. Creating a row from a half-typed title
    // and then navigating away would leave an empty page behind.
    if (!initial.id) return;
    if (!dirty) return;
    // A failed write keeps failing until the author changes something, so stop
    // hammering the database and surface the reason instead.
    if (activeSaveFailure) return;

    const timer = setTimeout(() => {
      setSaveState('saving');
      void persist(status).then((result) => {
        setSaveState(result.success ? 'saved' : 'idle');
        setSaveFailure(result.success ? null : { snapshot, message: result.error });
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [activeSaveFailure, blocks, dirty, initial.id, persist, snapshot, status, title]);

  const handleDelete = useCallback(async () => {
    if (!initial.id) return;
    // No confirm() here: the ConfirmAction below only calls this from its
    // inline confirm step, which already named the page and the consequence.
    const result = await deleteContent(initial.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Page deleted');
    router.push('/admin/content');
    router.refresh();
  }, [initial.id, router]);

  const handleDuplicate = useCallback(async () => {
    if (!initial.id) return;
    const result = await duplicateContent(initial.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Duplicated as a draft');
    router.push(`/admin/content/${result.data.id}`);
    router.refresh();
  }, [initial.id, router]);

  const handleToggleStatus = useCallback(async () => {
    const next = status === 'publish' ? 'draft' : 'publish';
    if (!initial.id) {
      // An unsaved new page has no server row to flip, so hold the change in
      // local state and let Save carry it through.
      setStatus(next);
      return;
    }
    const result = await setContentStatus(initial.id, next);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setStatus(next);
    setSavedSnapshot(snapshotOf({ ...fields, status: next }));
    toast.success(next === 'publish' ? 'Published' : 'Moved to drafts');
    router.refresh();
  }, [fields, initial.id, router, status]);

  const loadRevisions = useCallback(async () => {
    if (!initial.id) return;
    const result = await getContentRevisions(initial.id);
    if (result.success) setRevisions(result.data.revisions);
    else toast.error(result.error);
  }, [initial.id]);

  const handleRestore = useCallback(
    async (revisionId: number) => {
      if (!initial.id) return;
      // No confirm() here: the panel only calls this from its inline confirm
      // step, which already showed what the restore will change. A native
      // dialog would be a second, blinder question on top of an informed one —
      // and it cannot be automated, so the restore path would go untested.
      const result = await restoreContentRevision(initial.id, revisionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      // Re-read rather than patching local state: a restore writes title, slug
      // and body together, and the editor has to reflect all of it.
      const reloaded = await getContentForEdit(initial.id);
      if (reloaded) {
        setTitle(reloaded.title);
        setSlug(reloaded.slug);
        setExcerpt(reloaded.excerpt ?? '');
        setType((reloaded.type as ContentType) ?? 'page');
        setStatus(reloaded.status === 'publish' ? 'publish' : 'draft');
        setFeaturedImage(reloaded.featured_image ?? '');
        setBlocks(parseHtml(reloaded.body ?? ''));
      }
      const history = await getContentRevisions(initial.id);
      if (history.success) setRevisions(history.data.revisions);
      if (reloaded) setSavedSnapshot(snapshotOf(fieldsFromRow(reloaded)));
      toast.success('Version restored');
      router.refresh();
    },
    [initial.id, router]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/content"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-dark focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          All pages
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            One indicator, and it never lies. Autosave writes a draft 2.5s after
            the last keystroke, so the honest report is which of those is true
            right now — including when autosave failed, which is the case that
            matters most and the one a plain "saved" tick would hide.
          */}
          {/*
            Undo and redo are buttons as well as shortcuts. A keyboard-only
            feature is a feature nobody discovers, and a discoverable one also
            tells the author whether there is anything to take back — which a
            shortcut cannot.
          */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo(undoStack)}
              title="Undo (Ctrl/Cmd+Z)"
              aria-label="Undo"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-secondary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Undo2 size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo(undoStack)}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              aria-label="Redo"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-secondary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Redo2 size={15} aria-hidden="true" />
            </button>
          </div>

          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 text-xs ${
              activeSaveFailure
                ? 'font-semibold text-accent-red'
                : dirty || saveState === 'saving'
                  ? 'font-semibold text-accent-gold'
                  : 'text-slate-500'
            }`}
          >
            {activeSaveFailure ? (
              <>
                <AlertCircle size={13} aria-hidden="true" />
                Autosave failed
              </>
            ) : saveState === 'saving' ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : dirty ? (
              <>
                <AlertCircle size={13} aria-hidden="true" />
                Unsaved changes
              </>
            ) : (
              <>
                <Check size={13} aria-hidden="true" />
                {initial.id ? 'All changes saved' : 'Not saved yet'}
              </>
            )}
          </span>
          {initial.id && (
            <>
              <button
                type="button"
                onClick={handleToggleStatus}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {status === 'publish' ? 'Move to draft' : 'Publish'}
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Copy size={15} aria-hidden="true" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => setShowRevisions((v) => !v)}
                aria-expanded={showRevisions}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <History size={15} aria-hidden="true" />
                History
              </button>
              <ConfirmAction
                label={`Delete ${title}`}
                message={`Delete “${title}”? This cannot be undone.`}
                danger
                idleClassName="rounded-xl border border-slate-200 p-2 text-accent-red transition-colors hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-primary"
                onConfirm={() => void handleDelete()}
              >
                <Trash2 size={15} aria-hidden="true" />
                <span className="sr-only">Delete page</span>
              </ConfirmAction>
            </>
          )}
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={15} aria-hidden="true" />
            )}
            Save
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-accent-red bg-rose-50 px-4 py-3 text-sm font-medium text-accent-red"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/*
        A failed autosave is the one state a small indicator cannot carry on its
        own: the reason matters (a slug clash is the author's to fix, a
        transient database error is not), and it stays on screen until the
        document changes.
      */}
      {/*
        A recovered draft is never applied on its own. The author may have
        returned to fix something on purpose, and silently replacing the page
        they came back to is how an editor loses trust once.
      */}
      {recovered && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-primary bg-blue-50 px-4 py-3"
        >
          <RotateCcw size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium text-secondary">
            Unsaved changes from{' '}
            {new Date(recovered.savedAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            were found in this browser.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardRecovery}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-primary"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={acceptRecovery}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary"
            >
              Restore them
            </button>
          </div>
        </div>
      )}

      {activeSaveFailure && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-red bg-rose-50 px-4 py-3"
        >
          <AlertCircle size={16} className="shrink-0 text-accent-red" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium text-accent-red">
            Autosave failed: {activeSaveFailure}
          </p>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg border border-accent-red px-3 py-1.5 text-xs font-bold text-accent-red transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      )}

      {showRevisions && initial.id && (
        <RevisionsPanel
          revisions={revisions}
          current={fields}
          onLoad={loadRevisions}
          onRestore={handleRestore}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <label
              htmlFor="content-title"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Title
            </label>
            <input
              id="content-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Page title"
              className="mt-1.5 w-full border-0 p-0 font-heading text-2xl font-black uppercase tracking-tight text-secondary outline-none placeholder:text-slate-300 focus-visible:ring-0"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Content</p>
              <p className="text-xs text-slate-400">
                {stats.words} {stats.words === 1 ? 'word' : 'words'}
                {stats.minutes > 0 && ` · ${stats.minutes} min read`}
              </p>
            </div>
            <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.7rem]">
                  /
                </kbd>
                to insert a block
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.7rem]">
                  {'Ctrl/⌘'} K
                </kbd>
                to add a link
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.7rem]">
                  {'Ctrl/⌘'} S
                </kbd>
                to save now
              </span>
            </p>
            <BlockEditor blocks={blocks} onChange={handleBlocksChange} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Page settings
            </h2>

            <label className="block text-xs font-medium text-slate-600">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'publish' | 'draft')}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="draft">Draft</option>
                <option value="publish">Published</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              Type
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContentType)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
              >
                {CONTENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              URL slug
              <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <span className="shrink-0 text-xs text-slate-400">/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              Featured image URL
              <input
                type="url"
                value={featuredImage}
                onChange={(e) => {
                  noteEdit('type:featuredImage');
                  setFeaturedImage(e.target.value);
                }}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
          </div>

          {/*
            A search-result preview, not a claim about Google's output — the
            layout mirrors the familiar blue-title / green-URL / grey-snippet
            shape so the author can sanity-check the title and description they
            are about to ship.
          */}
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Search preview
              </h2>
              <Eye size={14} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="truncate text-sm font-medium text-[#1a0dab]">
              {title || 'Untitled page'}
            </p>
            <p className="truncate text-xs text-[#0d6528]">
              {siteHost}/{slug || '…'}
            </p>
            <p className="text-xs leading-relaxed text-slate-600">
              {excerpt.trim() || derivedExcerpt || 'No summary yet.'}
            </p>
            {!excerpt.trim() && derivedExcerpt && (
              <button
                type="button"
                onClick={() => {
                  noteEdit(null);
                  setExcerpt(derivedExcerpt.replace(/…$/, ''));
                }}
                className="text-xs font-medium text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
              >
                Use the generated summary
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The document on screen, so a revision can say what restoring it would
 * change. `EditorFields` already is that shape — the same object the dirty
 * check compares — so the diff and the "unsaved changes" indicator can never
 * disagree about what "current" means.
 */
interface FieldChange {
  field: string;
  from: string;
  to: string;
}

function shorten(value: string, max = 60): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (!flat) return '—';
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Field-level diff between a stored revision and the document on screen.
 *
 * A restore that cannot say what it will change is a blind control: the
 * author clicks "Restore" on a timestamp and hopes. Timestamps all look alike
 * after a long editing session; the changed fields do not. URLs are reduced
 * to present/absent — the author needs to know the hero changes, not to read
 * a storage path.
 */
function diffRevision(revision: ContentRevision, current: EditorFields): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from: shorten(from), to: shorten(to) });
  };
  push('Title', current.title, revision.title ?? 'Untitled');
  push('Slug', current.slug, revision.slug ?? 'untitled');
  push('Status', current.status, revision.status ?? 'draft');
  push('Type', current.type, revision.type ?? 'page');
  push('Excerpt', current.excerpt, revision.excerpt ?? '');
  const currentHero = current.featuredImage ? 'present' : 'absent';
  const revisionHero = (revision as ContentRevision & { featured_image?: string | null })
    .featured_image
    ? 'present'
    : 'absent';
  if (currentHero !== revisionHero) {
    changes.push({ field: 'Hero image', from: currentHero, to: revisionHero });
  }
  if ((revision.body ?? '') !== current.body) {
    changes.push({
      field: 'Body',
      from: `${current.body.length.toLocaleString()} chars`,
      to: `${(revision.body ?? '').length.toLocaleString()} chars`,
    });
  }
  return changes;
}

function RevisionsPanel({
  revisions,
  current,
  onLoad,
  onRestore,
}: {
  revisions: ContentRevision[];
  current: EditorFields;
  onLoad: () => Promise<void>;
  onRestore: (id: number) => Promise<void>;
}) {
  useEffect(() => {
    void onLoad();
  }, [onLoad]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const confirmRestore = async (id: number) => {
    setRestoringId(id);
    try {
      await onRestore(id);
    } finally {
      setRestoringId(null);
      setConfirmingId(null);
    }
  };

  return (
    <section
      aria-label="Version history"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        Version history
      </h2>
      {revisions.length === 0 ? (
        <p className="text-sm text-slate-500">
          No earlier versions yet. A version is captured each time you save a change.
        </p>
      ) : (
        <ol className="space-y-2">
          {revisions.map((revision) => {
            const changes = diffRevision(revision, current);
            const expanded = expandedId === revision.id || confirmingId === revision.id;
            const confirming = confirmingId === revision.id;
            const restoring = restoringId === revision.id;
            const date = new Date(revision.created_at).toLocaleString();
            return (
              <li
                key={revision.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-700">
                    {date}
                    {revision.title && (
                      <span className="ml-2 text-xs text-slate-500">“{revision.title}”</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        revision.status === 'publish'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {revision.status ?? 'draft'}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {revision.type ?? 'page'}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === revision.id ? null : revision.id)}
                    aria-expanded={expandedId === revision.id}
                    className="text-xs font-medium text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {changes.length === 0
                      ? 'No changes from what’s on screen'
                      : `${changes.length} change${changes.length === 1 ? '' : 's'} from what’s on screen`}
                  </button>
                  {!confirming && (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(revision.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      Restore
                    </button>
                  )}
                </div>
                {expanded && (
                  <dl className="mt-2 space-y-1 rounded-lg bg-white px-3 py-2 text-xs">
                    {changes.length === 0 ? (
                      <p className="text-slate-500">Restoring this version would change nothing.</p>
                    ) : (
                      changes.map((change) => (
                        <div key={change.field} className="flex flex-wrap gap-x-2">
                          <dt className="font-bold text-slate-700">{change.field}:</dt>
                          <dd className="text-slate-500">
                            <s>{change.from}</s> →{' '}
                            <span className="font-medium text-secondary">{change.to}</span>
                          </dd>
                        </div>
                      ))
                    )}
                  </dl>
                )}
                {confirming && (
                  <fieldset className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                    <legend className="px-1 text-xs font-bold text-amber-900">
                      {`Confirm restoring the version from ${date}`}
                    </legend>
                    <p className="text-xs text-amber-900">
                      Restoring replaces the current page, including unsaved changes. The current
                      version is kept in history.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmRestore(revision.id)}
                        disabled={restoring}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        {restoring && (
                          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                        )}
                        {restoring ? 'Restoring…' : 'Confirm restore'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={restoring}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        Keep editing
                      </button>
                    </div>
                  </fieldset>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
