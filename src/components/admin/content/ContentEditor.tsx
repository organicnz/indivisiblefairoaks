'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  History,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (!slugTouched) setSlug(slugifyTitle(value));
    },
    [slugTouched]
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
      const targetStatus = nextStatus ?? status;
      const result = await saveContent({
        id: initial.id,
        title: title.trim(),
        slug,
        excerpt: excerpt.trim() || null,
        type,
        status: targetStatus,
        body,
        featuredImage: featuredImage.trim() || null,
        metadata: {},
      });
      setSaving(false);

      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setStatus(targetStatus);
      setSavedSnapshot(snapshot);
      toast.success(targetStatus === 'publish' ? 'Published' : 'Draft saved');
      if (!initial.id) {
        router.replace(`/admin/content/${result.data.id}`);
      }
      router.refresh();
    },
    [
      blocks,
      body,
      excerpt,
      featuredImage,
      initial.id,
      router,
      saving,
      slug,
      snapshot,
      status,
      title,
      type,
    ]
  );

  const handleDelete = useCallback(async () => {
    if (!initial.id) return;
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    const result = await deleteContent(initial.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Page deleted');
    router.push('/admin/content');
    router.refresh();
  }, [initial.id, router, title]);

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
      if (!confirm('Restore this version? The current version is kept in history.')) return;
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
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              dirty ? 'font-semibold text-accent-gold' : 'text-slate-500'
            }`}
          >
            {dirty ? (
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
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border border-slate-200 p-2 text-accent-red transition-colors hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Trash2 size={15} aria-hidden="true" />
                <span className="sr-only">Delete page</span>
              </button>
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

      {showRevisions && initial.id && (
        <RevisionsPanel revisions={revisions} onLoad={loadRevisions} onRestore={handleRestore} />
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
            <p className="mb-3 text-xs text-slate-500">
              Type{' '}
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.7rem]">
                /
              </kbd>{' '}
              on an empty line to insert a block. Enter adds the next one.
            </p>
            <BlockEditor blocks={blocks} onChange={setBlocks} />
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
                onChange={(e) => setFeaturedImage(e.target.value)}
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
                onClick={() => setExcerpt(derivedExcerpt.replace(/…$/, ''))}
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

function RevisionsPanel({
  revisions,
  onLoad,
  onRestore,
}: {
  revisions: ContentRevision[];
  onLoad: () => Promise<void>;
  onRestore: (id: number) => Promise<void>;
}) {
  useEffect(() => {
    void onLoad();
  }, [onLoad]);

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
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="text-sm text-slate-700">
                {new Date(revision.created_at).toLocaleString()}
                {revision.title && (
                  <span className="ml-2 text-xs text-slate-500">“{revision.title}”</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRestore(revision.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Restore
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
