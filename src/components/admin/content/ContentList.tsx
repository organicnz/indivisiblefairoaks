'use client';

import { ArrowUpDown, FilePlus2, FileText, Loader2, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { type ContentListRow, deleteContent, setContentStatus } from '@/lib/actions/content';
import { CONTENT_TYPES } from '@/lib/content';

const STATUS_BADGE: Record<string, string> = {
  publish: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
};

const TYPE_BADGE: Record<string, string> = {
  page: 'bg-surface-muted text-slate-700 border-slate-200',
  post: 'bg-blue-50 text-blue-800 border-blue-200',
  action: 'bg-amber-50 text-amber-800 border-amber-200',
  event: 'bg-purple-50 text-purple-800 border-purple-200',
};

interface Props {
  initialRows: ContentListRow[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
}

export function ContentList({ initialRows, initialTotal, initialPage, pageSize }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  // The list is driven entirely by the URL so a filtered view is shareable and
  // survives a refresh. Local input only seeds the search box.
  const status = searchParams.get('status') ?? 'all';
  const type = searchParams.get('type') ?? 'all';
  const q = searchParams.get('q') ?? '';

  const push = useCallback(
    (next: { status?: string; type?: string; q?: string }) => {
      const params = new URLSearchParams();
      const merged = { status, type, q, ...next };
      if (merged.status !== 'all') params.set('status', merged.status);
      if (merged.type !== 'all') params.set('type', merged.type);
      if (merged.q) params.set('q', merged.q);
      startTransition(() => router.push(`/admin/content?${params.toString()}`));
    },
    [q, router, status, type]
  );

  useEffect(() => {
    setQuery(q);
  }, [q]);

  const totalPages = Math.max(1, Math.ceil(initialTotal / pageSize));

  const handleToggle = async (row: ContentListRow) => {
    setBusyId(row.id);
    const next = row.status === 'publish' ? 'draft' : 'publish';
    const result = await setContentStatus(row.id, next);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(next === 'publish' ? `Published “${row.title}”` : `Moved to drafts`);
    router.refresh();
  };

  const handleDelete = async (row: ContentListRow) => {
    // No confirm() here: the row's ConfirmAction only calls this from its
    // inline confirm step, which already named the page and the consequence.
    setBusyId(row.id);
    const result = await deleteContent(row.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Page deleted');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-black uppercase tracking-tight text-secondary">
          Pages &amp; posts
        </h1>
        <Link
          href="/admin/content/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <FilePlus2 size={16} aria-hidden="true" />
          New page
        </Link>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-[2fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: query.trim() });
        }}
      >
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles and slugs…"
            aria-label="Search pages"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <select
          value={status}
          onChange={(e) => push({ status: e.target.value })}
          aria-label="Filter by status"
          className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="all">All statuses</option>
          <option value="publish">Published</option>
          <option value="draft">Drafts</option>
        </select>
        <select
          value={type}
          onChange={(e) => push({ type: e.target.value })}
          aria-label="Filter by type"
          className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="all">All types</option>
          {CONTENT_TYPES.map((option) => (
            <option key={option} value={option}>
              {option[0].toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {initialRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText size={32} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600">
              {q || status !== 'all' || type !== 'all'
                ? 'No pages match these filters.'
                : 'No pages yet.'}
            </p>
            <Link
              href="/admin/content/new"
              className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Create the first page
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">Pages and posts</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Title
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    <span className="inline-flex items-center gap-1">
                      <ArrowUpDown size={12} aria-hidden="true" />
                      Updated
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/content/${row.id}`}
                        className="font-semibold text-secondary underline-offset-2 hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {row.title}
                      </Link>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                        /{row.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          TYPE_BADGE[row.type ?? 'page'] ?? TYPE_BADGE.page
                        }`}
                      >
                        {row.type ?? 'page'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          STATUS_BADGE[row.status ?? 'draft'] ?? STATUS_BADGE.draft
                        }`}
                      >
                        {row.status === 'publish' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {busyId === row.id ? (
                          <Loader2
                            size={15}
                            className="animate-spin text-slate-400"
                            aria-label="Working"
                          />
                        ) : (
                          <>
                            <Link
                              href={`/${row.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-surface-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleToggle(row)}
                              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-surface-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {row.status === 'publish' ? 'Unpublish' : 'Publish'}
                            </button>
                            <ConfirmAction
                              label={`Delete ${row.title}`}
                              message={`Delete “${row.title}”? This cannot be undone.`}
                              danger
                              idleClassName="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary"
                              onConfirm={() => void handleDelete(row)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              <span className="sr-only">Delete {row.title}</span>
                            </ConfirmAction>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <p className={isPending ? 'opacity-60' : undefined}>
          {initialTotal === 0
            ? 'No results'
            : `${(initialPage - 1) * pageSize + 1}–${Math.min(
                initialPage * pageSize,
                initialTotal
              )} of ${initialTotal}`}
        </p>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <PageLink
              disabled={initialPage <= 1}
              page={initialPage - 1}
              label="Previous"
              params={{ status, type, q }}
            />
            <PageLink
              disabled={initialPage >= totalPages}
              page={initialPage + 1}
              label="Next"
              params={{ status, type, q }}
            />
          </div>
        )}
      </nav>
    </div>
  );
}

function PageLink({
  page,
  label,
  disabled,
  params,
}: {
  page: number;
  label: string;
  disabled: boolean;
  params: { status: string; type: string; q: string };
}) {
  const search = new URLSearchParams();
  if (params.status !== 'all') search.set('status', params.status);
  if (params.type !== 'all') search.set('type', params.type);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));

  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-slate-400">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/content?${search.toString()}`}
      className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label}
    </Link>
  );
}
