'use client';

import {
  BookmarkPlus,
  Download,
  Edit2,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMImportModal } from '@/components/admin/crm/CRMImportModal';
import { CRMPager } from '@/components/admin/crm/CRMPager';
import {
  type CRMContact,
  type CRMSegment,
  deleteCRMSegment,
  exportCRMContacts,
  saveCRMSegment,
  triggerHistoricalCRMSync,
} from '@/lib/actions/crm';
import {
  type ConsentFilter,
  type ContactFilters,
  filterArgs,
  filterParams,
  filtersFromSegment,
  hasActiveFilters as hasAnyFilters,
  pageRange,
  splitActiveValues,
  totalPages,
} from '@/lib/crm-filters';

interface Props {
  initialContacts: CRMContact[];
  totalCount: number;
  currentQuery: string;
  currentStatus: string;
  currentDistrict: string;
  currentTag: string;
  currentConsent: ConsentFilter;
  currentPage: number;
  pageSize: number;
  existingTags: string[];
  /**
   * The tag scan hit its row ceiling, so a tag present in the database may have no
   * chip here. On this page that is not a display gap: the filter bar is how the
   * constituents carrying that tag are found at all, so an absent chip reads as
   * "this chapter has no such tag".
   */
  tagsMayBeIncomplete?: boolean;
  segments: CRMSegment[];
  /**
   * True when the server cut the segment list at its cap. An unreachable
   * segment is also undeletable — the chips below are the only delete path —
   * so the flag renders rather than staying a quiet boolean.
   */
  segmentsTruncated?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active_volunteer: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  organizer: 'bg-purple-100 text-purple-800 border-purple-300',
  choir: 'bg-blue-100 text-blue-800 border-blue-300',
  donor: 'bg-amber-100 text-amber-800 border-amber-300',
  supporter: 'bg-slate-100 text-slate-700 border-slate-300',
  inactive: 'bg-rose-100 text-rose-700 border-rose-300',
};

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Split a multi-value filter param into its parts.
 *
 * Named for what it does rather than what it is applied to: it is called on
 * `status` and `district` as well as on `tag`, which is what let a reader of the
 * old call sites believe `status` was being tag-parsed. The behaviour is
 * identical for all three.
 */

export function CRMContactList({
  initialContacts,
  totalCount,
  currentQuery,
  currentStatus,
  currentDistrict,
  currentTag,
  currentConsent,
  currentPage,
  pageSize,
  existingTags,
  tagsMayBeIncomplete = false,
  segments,
  segmentsTruncated = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingSegment, setSavingSegment] = useState(false);
  const [showSaveSegment, setShowSaveSegment] = useState(false);
  const [segmentName, setSegmentName] = useState('');

  const [query, setQuery] = useState(currentQuery);
  const [status, setStatus] = useState(currentStatus || 'all');
  const [district, setDistrict] = useState(currentDistrict || 'all');
  const [tag, setTag] = useState(currentTag || 'all');
  const [consent, setConsent] = useState<ConsentFilter>(currentConsent || 'all');

  // Tags to offer in the filter: schema-known tags plus whatever is active now.
  const tagOptions = [...new Set([...existingTags, ...splitActiveValues(currentTag)])].sort(
    (a, b) => a.localeCompare(b)
  );

  const totalRows = totalPages(totalCount, pageSize);
  const [firstRow, lastRow] = pageRange(currentPage, pageSize, totalCount);

  // The uncommitted form state — what the user has typed or picked but not yet
  // applied. Only the submit handler uses this.
  const draftFilters = (): ContactFilters => ({ query, status, district, tag, consent });

  // The pager must continue the result set the user is actually looking at, which
  // is the one the server ran — not the uncommitted form state. Paging off the
  // draft silently jumped to a different set whenever a filter was typed but not
  // yet applied.
  const appliedFilters = (): ContactFilters => ({
    query: currentQuery,
    status: currentStatus,
    district: currentDistrict,
    tag: currentTag,
    consent: currentConsent,
  });

  const applyFilters = (next: ContactFilters) => {
    const params = filterParams(next);
    startTransition(() => {
      router.push(`/admin/crm?${params.toString()}`);
    });
  };

  const handleFilterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    applyFilters(draftFilters());
  };

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      const res = await triggerHistoricalCRMSync();
      if (res.success) {
        toast.success(`Sync completed! ${res.syncedCount ?? 0} historical records updated.`);
        router.refresh();
      } else {
        toast.error(`Sync error: ${res.error}`);
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    if (!totalCount) {
      toast.error('No constituents to export');
      return;
    }
    setExporting(true);
    try {
      // Off the *applied* filters, not the draft, for the same reason the pager
      // is: the export must be the set on screen. And `consent` has to be here:
      // exporting from the "Opted out of email" view used to produce a file of
      // every contact, which is both wrong and the one export a chapter takes
      // off-platform.
      const res = await exportCRMContacts(filterArgs(appliedFilters()));
      if (res.error || !res.csv) {
        toast.error(res.error || 'Export failed');
        return;
      }
      downloadCsv(
        res.csv,
        `indivisible-crm-constituents-${new Date().toISOString().split('T')[0]}.csv`
      );
      /*
       * Truncation is a warning, not a success message.
       *
       * This file is the chapter's only off-platform copy of its constituent
       * data. "Exported 10,000 constituents" for a 12,341-row filter reads as
       * complete, and the file itself carries nothing that says otherwise — so the
       * toast is the only place the shortfall can be named, and it has to name
       * both numbers. A backup that is quietly short is discovered at restore
       * time, to a volunteer, with no way to know what is missing.
       *
       * A plain `toast.success` with a second line for the cap would be worse: the
       * green tick is what gets read.
       */
      if (res.truncated) {
        toast.warning(
          `Exported ${res.count.toLocaleString()} of ${res.matchedCount.toLocaleString()} — the file is incomplete`,
          {
            description:
              'This export hit its row limit, so it does not contain every matching constituent. Narrow the filters and export again, or raise CRM_EXPORT_LIMIT.',
          }
        );
      } else {
        toast.success(`Exported ${res.count} constituents to CSV`);
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSegment = async () => {
    const name = segmentName.trim();
    if (!name) {
      toast.error('Segment name is required');
      return;
    }
    setSavingSegment(true);
    try {
      // Off the *applied* filters, not the local form state. Saving from the
      // draft let a volunteer save a segment that differs from the one on screen
      // — the button sits beside the filter bar, so the segment reads as "what
      // I am looking at". Consent is included for the same reason it is included
      // in the URL: an opt-out audit is a filter, so it has to be saveable.
      const filters = appliedFilters();
      const res = await saveCRMSegment({
        name,
        query: filters.query.trim(),
        statuses: splitActiveValues(filters.status),
        districts: splitActiveValues(filters.district),
        tags: splitActiveValues(filters.tag),
        consent: filters.consent === 'all' ? undefined : filters.consent,
      });

      if (res.success) {
        toast.success(`Segment "${name}" saved`);
        setSegmentName('');
        setShowSaveSegment(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save segment');
      }
    } catch {
      toast.error('Failed to save segment');
    } finally {
      setSavingSegment(false);
    }
  };

  const handleApplySegment = (segment: CRMSegment) => {
    const next = filtersFromSegment(segment);
    setQuery(next.query);
    setStatus(next.status);
    setDistrict(next.district);
    setTag(next.tag);
    setConsent(next.consent);
    applyFilters(next);
  };

  const handleDeleteSegment = async (segment: CRMSegment) => {
    // No confirm() here: the ConfirmAction only calls this from its inline
    // confirm step.
    const res = await deleteCRMSegment(segment.id);
    if (res.success) {
      toast.success('Segment deleted');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete segment');
    }
  };

  const hasActiveFilters = hasAnyFilters(draftFilters(), appliedFilters());

  return (
    <div className="space-y-6">
      {/* Control / Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <form
          onSubmit={handleFilterSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3"
        >
          {/* Search Query */}
          <div className="lg:col-span-2 relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, city, notes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm bg-slate-50/50"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by engagement status"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
            >
              <option value="all">All Engagement Statuses</option>
              <option value="active_volunteer">Active Volunteers</option>
              <option value="choir">Resistance Choir</option>
              <option value="donor">Grassroots Donors</option>
              <option value="organizer">Organizers</option>
              <option value="supporter">Supporters</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* District Filter */}
          <div>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              // The Tag and Consent selects below already had these; Status and
              // District did not, so a screen reader announced two bare combo
              // boxes in a row with nothing to say what either filtered.
              aria-label="Filter by district"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
            >
              <option value="all">All Districts</option>
              <option value="CA-06">CA-06 (Sacramento/Carmichael)</option>
              <option value="CA-03">CA-03 (Fair Oaks/Sierra)</option>
              <option value="CA-07">CA-07</option>
              <option value="Other">Other Districts</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              aria-label="Filter by tag"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
            >
              <option value="all">All Tags</option>
              {tagOptions.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
              {tag !== 'all' && !tagOptions.includes(tag) && <option value={tag}>#{tag}</option>}
            </select>
            {/*
   Sits under the select rather than in the empty state, because the empty state
   only appears *after* the organiser has already concluded the tag does not
   exist. "0 constituents" and "this tag is not in the list because the list is
   partial" look identical otherwise, and the reader has no reason to doubt the
   list.

   Deliberately not an error colour. Nothing failed, and a chapter with a large
   directory is an ordinary situation rather than a fault.
*/}
            {tagsMayBeIncomplete && (
              <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                This directory is large enough that the tag list is partial. If a tag is missing,
                search by name above — a tag with no entry here does not mean no constituent has it.
              </p>
            )}
          </div>

          {/* Consent Filter */}
          <div>
            <select
              value={consent}
              onChange={(e) => setConsent(e.target.value as ConsentFilter)}
              aria-label="Filter by email consent"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
            >
              <option value="all">All Consent States</option>
              <option value="opted_out">Opted Out of Email</option>
              <option value="opted_in">Agreed to Email</option>
              {/*
                The third state is reachable and filterable since the column became
                nullable. It was not before, which meant an organiser asking "who
                have we never actually asked?" had no way to find out — the only
                question the directory could answer was who had said no.
              */}
              <option value="unasked">Never Asked</option>
            </select>
          </div>

          {/* Apply Button */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
            >
              {isPending ? 'Filtering...' : 'Apply Filters'}
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared: ContactFilters = {
                  query: '',
                  status: 'all',
                  district: 'all',
                  tag: 'all',
                  consent: 'all',
                };
                setQuery('');
                setStatus('all');
                setDistrict('all');
                setTag('all');
                setConsent('all');
                applyFilters(cleared);
              }}
              className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Quick Segment Filter Pills + saved segments */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
            Quick Segments:
          </span>
          {[
            { label: 'All', s: 'all', d: 'all' },
            { label: 'Volunteers', s: 'active_volunteer', d: 'all' },
            { label: 'Resistance Choir', s: 'choir', d: 'all' },
            { label: 'Donors', s: 'donor', d: 'all' },
            { label: 'Organizers', s: 'organizer', d: 'all' },
            { label: 'CA-06 Local', s: 'all', d: 'CA-06' },
            { label: 'CA-03 Local', s: 'all', d: 'CA-03' },
          ].map((pill) => {
            const isActive =
              (pill.s === 'all' || status === pill.s) &&
              (pill.d === 'all' || district === pill.d) &&
              (pill.s !== 'all' || pill.d !== 'all' || (status === 'all' && district === 'all'));

            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => {
                  /*
                   * A pill changes the status and district and leaves the rest of
                   * the filter alone — that is what makes it a quick filter
                   * rather than a reset. It builds on `appliedFilters()`, the
                   * set the server actually ran, and not on `draftFilters()`:
                   * the pager, the export and save-as-segment all read the
                   * applied set, and the pill was the one path that could act
                   * on unsubmitted form state. Type a name, do not press Apply,
                   * click a pill — the typed name used to go out with it.
                   *
                   * The visible controls follow the applied set too, so what is
                   * on screen is what was sent.
                   */
                  const next = { ...appliedFilters(), status: pill.s, district: pill.d };
                  setQuery(next.query);
                  setStatus(next.status);
                  setDistrict(next.district);
                  setTag(next.tag);
                  setConsent(next.consent);
                  applyFilters(next);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Saved segments */}
        {segments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
              Saved:
            </span>
            {segmentsTruncated && (
              <span
                role="status"
                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"
              >
                Showing the 500 most recent — older saved segments exist but are not listed here.
              </span>
            )}
            {segments.map((seg) => (
              <span
                key={seg.id}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold"
              >
                <button
                  type="button"
                  onClick={() => handleApplySegment(seg)}
                  className="hover:underline"
                  title="Apply this segment filter"
                >
                  {seg.name}
                </button>
                <ConfirmAction
                  label={`Delete segment ${seg.name}`}
                  message={`Delete saved segment "${seg.name}"?`}
                  danger
                  idleClassName="p-0.5 hover:text-red-600 transition-colors"
                  onConfirm={() => void handleDeleteSegment(seg)}
                >
                  <X size={11} aria-hidden="true" />
                </ConfirmAction>
              </span>
            ))}
          </div>
        )}

        {/* Save current filter as segment */}
        {showSaveSegment ? (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveSegment();
                }
                if (e.key === 'Escape') setShowSaveSegment(false);
              }}
              placeholder="Segment name (e.g. CA-06 choir)"
              maxLength={60}
              autoFocus
              className="px-3 py-1.5 rounded-lg border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-xs w-56"
            />
            <button
              type="button"
              onClick={handleSaveSegment}
              disabled={savingSegment}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {savingSegment ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowSaveSegment(false)}
              className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSaveSegment(true)}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-primary transition-colors disabled:opacity-40 disabled:hover:text-slate-400"
            title="Save the current filter combination as a reusable segment"
          >
            <BookmarkPlus size={12} /> Save current filter as segment
          </button>
        )}

        {/*
          Action header. No count here any more: this row and the pager each
          printed their own version of the same fact, and on an empty result they
          disagreed about what zero meant. The count belongs to the bottom of the
          table, beside the thing it describes.
        */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting || !totalCount}
              title="Export ALL filtered constituents to CSV (not just this page)"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              title="Import constituents from CSV (existing emails are skipped)"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
            >
              <Upload size={13} />
              Import CSV
            </button>

            <button
              type="button"
              onClick={handleSyncData}
              disabled={syncing}
              title="Sync historical contacts from contact_submissions, profiles & orders"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync History'}
            </button>

            <Link
              href="/admin/crm/broadcasts"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold transition-colors"
            >
              <Mail size={13} />
              New Broadcast Blast
            </Link>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white hover:bg-primary-light rounded-xl font-bold transition-colors shadow-xs"
            >
              <Plus size={14} />
              Add Constituent
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/*
          `tabIndex={0}` on the scroll container, per the WAI-ARIA Scrollable
          Region pattern. Chrome and Firefox stopped focusing an `overflow-x-auto`
          element by default, so without it a keyboard user cannot scroll the
          table sideways at all — and this table has seven columns. `role="region"`
          with a name is what gives that focus a purpose; a bare `tabIndex` on a
          non-interactive element is a focus trap with nothing to do. The repo
          already does this in `ContentList.tsx` and `BlockEditor.tsx`.
        */}
        {/*
          A `<section>`, not a `<div role="region">` — same role, no ARIA to
          keep in sync, and it is what `ContentList.tsx` and `BlockEditor.tsx`
          already use for this pattern. The accessible name is the caption below,
          so the region is "Constituent directory, page N" to a screen reader and
          has a heading-like boundary in the document outline.
        */}
        <section
          className="overflow-x-auto"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
          tabIndex={0}
          // Named, not implied by the caption below: a `<caption>` names the
          // *table*, and this `<section>` is the scroll container wrapping it. A
          // scroll region needs its own name for a screen reader to announce
          // "region, Constituent directory, scrollable" when focus lands here.
          aria-label="Constituent directory, scrollable"
        >
          <table className="w-full text-left border-collapse">
            {/*
              A caption, because a seven-column table with no caption is announced
              as an unlabelled grid. Visually hidden rather than visible: the
              panel heading already names the table, and a visible caption would
              say it twice.
            */}
            <caption className="sr-only">
              Constituents matching the current filters, page {currentPage}
            </caption>
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <th scope="col" className="py-3.5 px-4">
                  Constituent
                </th>
                <th scope="col" className="py-3.5 px-4">
                  District / City
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Status
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Tags &amp; Roles
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Contributions
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Last Active
                </th>
                <th scope="col" className="py-3.5 px-4 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {initialContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold">No constituents matched your search criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing filters or click &ldquo;Sync History&rdquo; to pull from form
                      submissions.
                    </p>
                  </td>
                </tr>
              ) : (
                initialContacts.map((contact) => {
                  const fullName =
                    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
                    contact.email.split('@')[0];
                  const statusClass = STATUS_COLORS[contact.status] || STATUS_COLORS.supporter;

                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/crm/${contact.id}`}
                          className="font-bold text-secondary hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          {fullName}
                          <ExternalLink
                            size={11}
                            className="opacity-0 group-hover:opacity-60 transition-opacity"
                          />
                        </Link>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span className="truncate">{contact.email}</span>
                          {/*
                            Both non-audience states get a badge, and they are
                            different badges.

                            Only `true` used to render one, so a "never asked"
                            contact — which was not in any broadcast audience and
                            could not say so — looked identical to one who had
                            agreed. An organiser auditing opt-outs needs to tell
                            those apart: one is a person who said no, the other is
                            a person nobody has ever asked.

                            The visible text is the badge; the consequence is
                            `sr-only`, because `title` is a tooltip and is not
                            reliably exposed to a screen reader.
                          */}
                          {contact.do_not_email === true && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-black uppercase leading-none"
                              title="Do not email — excluded from broadcasts"
                            >
                              opt-out
                              <span className="sr-only"> — excluded from broadcasts</span>
                            </span>
                          )}
                          {contact.do_not_email === null && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-black uppercase leading-none"
                              title="Never asked — not in any broadcast audience"
                            >
                              unasked
                              <span className="sr-only">
                                {' '}
                                — never asked for email, excluded from broadcasts
                              </span>
                            </span>
                          )}
                        </div>
                        {contact.phone && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {contact.phone}
                          </div>
                        )}
                      </td>

                      {/* District & City */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {contact.district || 'CA-06'}
                        </span>
                        {contact.city && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{contact.city}</div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusClass}`}
                        >
                          {contact.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {contact.tags.length === 0 ? (
                            <span className="text-slate-300 text-[10px]">—</span>
                          ) : (
                            contact.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium"
                              >
                                #{t}
                              </span>
                            ))
                          )}
                          {contact.tags.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px]">
                              +{contact.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Contributions */}
                      <td className="py-3.5 px-4 font-mono">
                        {contact.total_donated_cents > 0 ? (
                          <span className="text-emerald-600 font-bold">
                            ${(contact.total_donated_cents / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">$0.00</span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {contact.last_contacted_at
                          ? new Date(contact.last_contacted_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : new Date(contact.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                      </td>

                      {/* Action Links */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingContact(contact)}
                            className="p-1.5 text-slate-400 hover:text-secondary rounded-lg hover:bg-slate-100 transition-colors"
                            // `aria-label`, not just `title`. `title` is a tooltip:
                            // it is not reliably exposed as the accessible name,
                            // and this control has no other name at all — so a
                            // screen reader announced "button". Naming it by
                            // person also makes a list of six identical rows
                            // distinguishable.
                            aria-label={`Edit ${fullName}`}
                            title="Edit Contact"
                          >
                            <Edit2 size={13} aria-hidden="true" />
                          </button>
                          <Link
                            href={`/admin/crm/${contact.id}`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-primary hover:text-white rounded-lg text-[11px] font-bold text-slate-600 transition-colors"
                          >
                            View 360
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <div className="px-6 pb-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          {/*
            The count lives here, at the bottom, beside the pager — not in the
            action header above the table.
          */}
          <p className="text-xs font-bold text-slate-500">
            {totalCount === 0 ? (
              'No constituents'
            ) : (
              <>
                Showing{' '}
                <span className="text-secondary font-black">
                  {firstRow}–{lastRow}
                </span>{' '}
                of <span className="text-secondary font-black">{totalCount}</span> constituents
                {totalRows > 1 && (
                  <span className="text-slate-400">
                    {' '}
                    · page {currentPage} of {totalRows}
                  </span>
                )}
              </>
            )}
          </p>
          <CRMPager
            page={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            basePath="/admin/crm"
            // The *applied* filters, not the draft — paging off unsaved form
            // state jumped to a different result set whenever a filter had been
            // typed but not submitted. `filterParams` also keeps `consent` in
            // the link, which is the filter most worth preserving across pages.
            params={filterParams(appliedFilters())}
          />
        </div>
      </div>

      {/* Modals */}
      {isNewModalOpen && (
        <CRMContactEditorModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
      )}

      {isImportOpen && (
        <CRMImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      )}

      {editingContact && (
        <CRMContactEditorModal
          contact={editingContact}
          isOpen={!!editingContact}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}
