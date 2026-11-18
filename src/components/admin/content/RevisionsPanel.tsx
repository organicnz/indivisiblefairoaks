'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ContentRevision } from '@/lib/actions/content';
import type { EditorFields } from './editor-fields';

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

export function RevisionsPanel({
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
      className="rounded-2xl border border-border bg-surface-card p-5 shadow-xs"
    >
      <h2 className="mb-3 font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
        Version history
      </h2>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
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
                className="rounded-xl border border-border bg-surface-muted px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-foreground">
                    {date}
                    {revision.title && (
                      <span className="ml-2 text-xs text-muted-foreground">“{revision.title}”</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        revision.status === 'publish'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {revision.status ?? 'draft'}
                    </span>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {revision.type ?? 'page'}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === revision.id ? null : revision.id)}
                    aria-expanded={expandedId === revision.id}
                    className="text-xs font-medium text-primary dark:text-primary-on-dark underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {changes.length === 0
                      ? 'No changes from what’s on screen'
                      : `${changes.length} change${changes.length === 1 ? '' : 's'} from what’s on screen`}
                  </button>
                  {!confirming && (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(revision.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      Restore
                    </button>
                  )}
                </div>
                {expanded && (
                  <dl className="mt-2 space-y-1 rounded-lg bg-surface-card px-3 py-2 text-xs">
                    {changes.length === 0 ? (
                      <p className="text-muted-foreground">
                        Restoring this version would change nothing.
                      </p>
                    ) : (
                      changes.map((change) => (
                        <div key={change.field} className="flex flex-wrap gap-x-2">
                          <dt className="font-bold text-foreground">{change.field}:</dt>
                          <dd className="text-muted-foreground">
                            <s>{change.from}</s> →{' '}
                            <span className="font-medium text-foreground">{change.to}</span>
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
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-card focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
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
