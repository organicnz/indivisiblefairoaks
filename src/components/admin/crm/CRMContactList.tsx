'use client';

import {
  BookmarkPlus,
  Check,
  Download,
  Edit2,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
  bulkDeleteCRMContacts,
  bulkUpdateCRMContacts,
  deleteCRMContact,
  deleteCRMSegment,
  exportCRMContacts,
  saveCRMContact,
  saveCRMSegment,
  setCRMEmailConsent,
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
  parseConsentFilter,
  splitActiveValues,
  totalPages,
} from '@/lib/crm-filters';
import type { ConsentDecision, CRMContact, CRMSegment } from '@/types/crm';

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
  supporter: 'bg-surface-muted text-foreground border-border',
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
  const [renamingSegmentId, setRenamingSegmentId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renamingBusy, setRenamingBusy] = useState(false);

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

  const handleRenameSegment = async (segment: CRMSegment) => {
    const name = renameInput.trim();
    if (!name) {
      toast.error('Segment name is required');
      return;
    }
    if (name === segment.name) {
      setRenamingSegmentId(null);
      return;
    }
    // Parsed, not passed through: the column has no CHECK constraint, so a
    // stored value may not be one of the three literals. `filtersFromSegment`
    // (the apply path) resolves unknown the same way, so a rename preserves
    // the segment's *effective* filter instead of failing on — or silently
    // keeping — a value the schema would refuse.
    const consent = parseConsentFilter(segment.consent);
    setRenamingBusy(true);
    try {
      // Rename only: the stored filter set rides through untouched, so renaming
      // can never silently rewrite what the segment selects.
      const res = await saveCRMSegment({
        id: segment.id,
        name,
        query: segment.query ?? '',
        statuses: segment.statuses ?? [],
        districts: segment.districts ?? [],
        tags: segment.tags ?? [],
        consent: consent === 'all' ? undefined : consent,
      });
      if (res.success) {
        toast.success(`Segment renamed to "${name}"`);
        setRenamingSegmentId(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to rename segment');
      }
    } catch {
      toast.error('Failed to rename segment');
    } finally {
      setRenamingBusy(false);
    }
  };

  // Multi-selection state for bulk batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkDistrictInput, setBulkDistrictInput] = useState('');
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const allOnPageSelected =
    initialContacts.length > 0 && initialContacts.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      for (const c of initialContacts) next.delete(c.id);
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      for (const c of initialContacts) next.add(c.id);
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleInlineStatusChange = async (contact: CRMContact, nextStatus: string) => {
    setUpdatingStatusId(contact.id);
    try {
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        status: nextStatus as
          | 'active_volunteer'
          | 'supporter'
          | 'donor'
          | 'choir'
          | 'organizer'
          | 'inactive',
        tags: contact.tags,
      });
      if (res.success) {
        toast.success(`Updated status for ${contact.first_name || contact.email}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [updatingConsentId, setUpdatingConsentId] = useState<string | null>(null);
  const [addingTagContactId, setAddingTagContactId] = useState<string | null>(null);
  const [inlineTagInput, setInlineTagInput] = useState('');
  const [tagBusyContactId, setTagBusyContactId] = useState<string | null>(null);

  const handleSingleDelete = async (id: string, name: string) => {
    setDeletingContactId(id);
    try {
      const res = await deleteCRMContact(id);
      if (res.success) {
        toast.success(`Removed constituent ${name}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete constituent');
    } finally {
      setDeletingContactId(null);
    }
  };

  const handleInlineConsentChange = async (contact: CRMContact, next: ConsentDecision) => {
    setUpdatingConsentId(contact.id);
    try {
      const res = await setCRMEmailConsent({ contactId: contact.id, doNotEmail: next });
      if (res.success) {
        toast.success(
          next === 'opted_out'
            ? `Marked do-not-email for ${contact.first_name || contact.email}`
            : next === 'opted_in'
              ? `Email consent recorded for ${contact.first_name || contact.email}`
              : `Consent reset to unasked for ${contact.first_name || contact.email}`
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update consent');
      }
    } catch {
      toast.error('Failed to update consent');
    } finally {
      setUpdatingConsentId(null);
    }
  };

  const handleInlineAddTag = async (contact: CRMContact) => {
    const clean = inlineTagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    if (!clean) return;
    if (contact.tags.includes(clean)) {
      toast.info('Constituent already has this tag');
      setAddingTagContactId(null);
      setInlineTagInput('');
      return;
    }
    setTagBusyContactId(contact.id);
    try {
      const nextTags = [...contact.tags, clean];
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        tags: nextTags,
      });
      if (res.success) {
        toast.success(`Added tag #${clean}`);
        setAddingTagContactId(null);
        setInlineTagInput('');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add tag');
      }
    } catch {
      toast.error('Failed to add tag');
    } finally {
      setTagBusyContactId(null);
    }
  };

  const handleInlineRemoveTag = async (contact: CRMContact, tagToRemove: string) => {
    setTagBusyContactId(contact.id);
    try {
      const nextTags = contact.tags.filter((t) => t !== tagToRemove);
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        tags: nextTags,
      });
      if (res.success) {
        toast.success(`Removed tag #${tagToRemove}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to remove tag');
      }
    } catch {
      toast.error('Failed to remove tag');
    } finally {
      setTagBusyContactId(null);
    }
  };

  const handleBulkStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    setBulkActionBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateCRMContacts({
        contactIds: ids,
        status: newStatus,
      });
      if (res.success) {
        toast.success(`Updated status for ${res.updatedCount ?? ids.length} constituents`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update constituents');
      }
    } catch {
      toast.error('Failed to update constituents');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkAddTag = async () => {
    const trimmed = bulkTagInput.trim();
    if (!trimmed || selectedIds.size === 0) return;
    setBulkActionBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateCRMContacts({
        contactIds: ids,
        addTags: [trimmed],
      });
      if (res.success) {
        toast.success(`Added tag #${trimmed} to ${res.updatedCount ?? ids.length} constituents`);
        setBulkTagInput('');
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add tags');
      }
    } catch {
      toast.error('Failed to add tags');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkDistrict = async () => {
    const trimmed = bulkDistrictInput.trim();
    if (!trimmed || selectedIds.size === 0) return;
    setBulkActionBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateCRMContacts({ contactIds: ids, district: trimmed });
      if (res.success) {
        toast.success(`Set district for ${res.updatedCount ?? ids.length} constituents`);
        setBulkDistrictInput('');
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to set district');
      }
    } catch {
      toast.error('Failed to set district');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkConsent = async (consent: ConsentDecision) => {
    if (selectedIds.size === 0) return;
    setBulkActionBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateCRMContacts({ contactIds: ids, consent });
      if (res.success) {
        const label =
          consent === 'opted_out'
            ? 'opted out'
            : consent === 'opted_in'
              ? 'opted in'
              : 'marked unasked';
        toast.success(
          `${label === 'marked unasked' ? 'Marked' : 'Opted'} ${res.updatedCount ?? ids.length} constituents ${label === 'marked unasked' ? 'as never asked' : label}`
        );
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update consent');
      }
    } catch {
      toast.error('Failed to update consent');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleUpdateSegment = async (segment: CRMSegment) => {
    setSavingSegment(true);
    try {
      // In-place filter edit: the stored name rides through, the *current*
      // on-screen filters replace the stored set. Previously this required
      // delete + save-new, which lost the segment id every edit.
      const filters = appliedFilters();
      const consent = parseConsentFilter(filters.consent);
      const res = await saveCRMSegment({
        id: segment.id,
        name: segment.name,
        query: filters.query.trim(),
        statuses: splitActiveValues(filters.status),
        districts: splitActiveValues(filters.district),
        tags: splitActiveValues(filters.tag),
        consent: consent === 'all' ? undefined : consent,
      });
      if (res.success) {
        toast.success(`Segment "${segment.name}" updated to match current filters`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update segment');
      }
    } catch {
      toast.error('Failed to update segment');
    } finally {
      setSavingSegment(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkDeleteCRMContacts(ids);
      if (res.success) {
        toast.success(`Deleted ${res.deletedCount ?? ids.length} constituents`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete constituents');
      }
    } catch {
      toast.error('Failed to delete constituents');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const hasActiveFilters = hasAnyFilters(draftFilters(), appliedFilters());

  return (
    <div className="space-y-6">
      {/* Control / Filter Bar */}
      <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
        <form
          onSubmit={handleFilterSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3"
        >
          {/* Search Query */}
          <div className="lg:col-span-2 relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, city, notes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm bg-surface-muted/50"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by engagement status"
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
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
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
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
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
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
              <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
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
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
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
              className="px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl hover:bg-surface-muted transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Quick Segment Filter Pills + saved segments */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mr-1">
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
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted'
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
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mr-1">
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
            {segments.map((seg) =>
              renamingSegmentId === seg.id ? (
                <span
                  key={seg.id}
                  className="inline-flex items-center gap-1 pl-1 pr-1 py-0.5 bg-surface-card text-indigo-800 border border-indigo-300 rounded-lg text-xs font-bold"
                >
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleRenameSegment(seg);
                      }
                      if (e.key === 'Escape') setRenamingSegmentId(null);
                    }}
                    maxLength={60}
                    autoFocus
                    disabled={renamingBusy}
                    aria-label={`Rename segment ${seg.name}`}
                    className="px-2 py-1 rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-xs w-40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRenameSegment(seg)}
                    disabled={renamingBusy}
                    aria-label={`Save new name for segment ${seg.name}`}
                    className="p-0.5 hover:text-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <Check size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingSegmentId(null)}
                    disabled={renamingBusy}
                    aria-label="Cancel rename"
                    className="p-0.5 hover:text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ) : (
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
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingSegmentId(seg.id);
                      setRenameInput(seg.name);
                    }}
                    className="p-0.5 hover:text-indigo-600 transition-colors"
                    title={`Rename segment ${seg.name}`}
                    aria-label={`Rename segment ${seg.name}`}
                  >
                    <Edit2 size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateSegment(seg)}
                    disabled={savingSegment}
                    className="p-0.5 hover:text-emerald-600 transition-colors disabled:opacity-50"
                    title={`Update "${seg.name}" to match the current filters`}
                    aria-label={`Update segment ${seg.name} to current filters`}
                  >
                    <RefreshCw size={11} aria-hidden="true" />
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
              )
            )}
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
              className="px-3 py-1.5 rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-xs w-56"
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
              className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSaveSegment(true)}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground"
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
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting || !totalCount}
              title="Export ALL filtered constituents to CSV (not just this page)"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              title="Import constituents from CSV (existing emails are skipped)"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl font-bold transition-colors"
            >
              <Upload size={13} />
              Import CSV
            </button>

            <button
              type="button"
              onClick={handleSyncData}
              disabled={syncing}
              title="Sync historical contacts from contact_submissions, profiles & orders"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl font-bold transition-colors disabled:opacity-50"
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
      <div className="bg-surface-card rounded-2xl border border-border shadow-xs overflow-hidden">
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
              <tr className="bg-surface-muted/80 border-b border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <th scope="col" className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all constituents on this page"
                    className="rounded border-border text-primary dark:text-primary-on-dark focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                </th>
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
            <tbody className="divide-y divide-border text-xs">
              {initialContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold">No constituents matched your search criteria.</p>
                    <p className="text-xs text-muted-foreground mt-1">
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
                    <tr
                      key={contact.id}
                      className={`hover:bg-surface-muted/80 transition-colors group ${
                        selectedIds.has(contact.id) ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                          aria-label={`Select ${fullName}`}
                          className="rounded border-border text-primary dark:text-primary-on-dark focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/crm/${contact.id}`}
                          className="font-bold text-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors flex items-center gap-1.5"
                        >
                          {fullName}
                          <ExternalLink
                            size={11}
                            className="opacity-0 group-hover:opacity-60 transition-opacity"
                          />
                        </Link>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="truncate">{contact.email}</span>
                          <select
                            value={
                              contact.do_not_email === true
                                ? 'opted_out'
                                : contact.do_not_email === false
                                  ? 'opted_in'
                                  : 'unasked'
                            }
                            disabled={updatingConsentId === contact.id}
                            onChange={(e) =>
                              void handleInlineConsentChange(
                                contact,
                                e.target.value as ConsentDecision
                              )
                            }
                            className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black uppercase leading-none border cursor-pointer ${
                              contact.do_not_email === true
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : contact.do_not_email === false
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            } ${updatingConsentId === contact.id ? 'opacity-50' : ''}`}
                            title="Quick change email consent"
                            aria-label={`Email consent for ${fullName}`}
                          >
                            <option value="opted_in">opted-in</option>
                            <option value="opted_out">opt-out</option>
                            <option value="unasked">unasked</option>
                          </select>
                        </div>
                        {contact.phone && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {contact.phone}
                          </div>
                        )}
                      </td>

                      {/* District & City */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-surface-muted text-foreground">
                          {contact.district || 'CA-06'}
                        </span>
                        {contact.city && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {contact.city}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="relative inline-block">
                          <select
                            value={contact.status}
                            disabled={updatingStatusId === contact.id}
                            onChange={(e) => void handleInlineStatusChange(contact, e.target.value)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer appearance-none pr-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusClass} ${
                              updatingStatusId === contact.id ? 'opacity-50' : ''
                            }`}
                            title="Click to quick change status"
                            aria-label={`Status for ${fullName}`}
                          >
                            <option value="active_volunteer">Active Volunteer</option>
                            <option value="organizer">Organizer</option>
                            <option value="choir">Resistance Choir</option>
                            <option value="donor">Donor</option>
                            <option value="supporter">Supporter</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] opacity-60">
                            ▼
                          </span>
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-[240px]">
                          {contact.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium group/tag"
                            >
                              <span>#{t}</span>
                              <button
                                type="button"
                                disabled={tagBusyContactId === contact.id}
                                onClick={() => void handleInlineRemoveTag(contact, t)}
                                className="opacity-0 group-hover/tag:opacity-100 hover:text-red-600 ml-0.5 text-[11px] leading-none"
                                title={`Remove #${t}`}
                                aria-label={`Remove tag ${t} from ${fullName}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                          {addingTagContactId === contact.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                void handleInlineAddTag(contact);
                              }}
                              className="inline-flex items-center"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={inlineTagInput}
                                onChange={(e) => setInlineTagInput(e.target.value)}
                                onBlur={() => {
                                  if (!inlineTagInput.trim()) setAddingTagContactId(null);
                                }}
                                placeholder="tag-name"
                                className="w-16 px-1.5 py-0.5 rounded border border-primary text-[10px] font-mono focus:outline-none"
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingTagContactId(contact.id);
                                setInlineTagInput('');
                              }}
                              className="px-1.5 py-0.5 rounded bg-surface-muted hover:bg-surface-muted text-muted-foreground hover:text-foreground text-[10px] font-bold"
                              title="Add tag"
                              aria-label={`Add tag to ${fullName}`}
                            >
                              +
                            </button>
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
                          <span className="text-muted-foreground">$0.00</span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
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
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-muted transition-colors"
                            aria-label={`Edit ${fullName}`}
                            title="Edit Contact"
                          >
                            <Edit2 size={13} aria-hidden="true" />
                          </button>
                          <ConfirmAction
                            label={`Delete ${fullName}`}
                            message={`Delete constituent "${fullName}" (${contact.email})?`}
                            danger
                            busy={deletingContactId === contact.id}
                            idleClassName="p-1.5 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            onConfirm={() => void handleSingleDelete(contact.id, fullName)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </ConfirmAction>
                          <Link
                            href={`/admin/crm/${contact.id}`}
                            className="px-2.5 py-1 bg-surface-muted hover:bg-primary hover:text-white rounded-lg text-[11px] font-bold text-muted-foreground transition-colors"
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

        <div className="px-6 pb-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {/*
            The count lives here, at the bottom, beside the pager — not in the
            action header above the table.
          */}
          <p className="text-xs font-bold text-muted-foreground">
            {totalCount === 0 ? (
              'No constituents'
            ) : (
              <>
                Showing{' '}
                <span className="text-foreground font-black">
                  {firstRow}–{lastRow}
                </span>{' '}
                of <span className="text-foreground font-black">{totalCount}</span> constituents
                {totalRows > 1 && (
                  <span className="text-muted-foreground">
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

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-secondary text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-black">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold whitespace-nowrap">Selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-white underline ml-1"
            >
              Clear
            </button>
          </div>

          {/* Bulk Status Select */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              Status:
            </span>
            <select
              disabled={bulkActionBusy}
              onChange={(e) => {
                if (e.target.value) {
                  void handleBulkStatus(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-slate-800 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <option value="" disabled>
                Change Status…
              </option>
              <option value="active_volunteer">Active Volunteer</option>
              <option value="organizer">Organizer</option>
              <option value="choir">Resistance Choir</option>
              <option value="donor">Donor</option>
              <option value="supporter">Supporter</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Bulk Add Tag */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="+ Add Tag…"
              value={bulkTagInput}
              disabled={bulkActionBusy}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleBulkAddTag();
                }
              }}
              className="bg-slate-800 text-white placeholder-slate-400 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 w-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleBulkAddTag()}
              disabled={!bulkTagInput.trim() || bulkActionBusy}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {/* Bulk District */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="District…"
              value={bulkDistrictInput}
              disabled={bulkActionBusy}
              onChange={(e) => setBulkDistrictInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleBulkDistrict();
                }
              }}
              className="bg-slate-800 text-white placeholder-slate-400 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 w-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleBulkDistrict()}
              disabled={!bulkDistrictInput.trim() || bulkActionBusy}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
            >
              Set
            </button>
          </div>

          {/* Bulk Consent */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              Email:
            </span>
            <select
              disabled={bulkActionBusy}
              onChange={(e) => {
                if (e.target.value) {
                  void handleBulkConsent(e.target.value as ConsentDecision);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              aria-label="Change email consent for selected constituents"
              className="bg-slate-800 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <option value="" disabled>
                Consent…
              </option>
              <option value="opted_in">Opt in</option>
              <option value="opted_out">Opt out</option>
              <option value="unasked">Mark unasked</option>
            </select>
          </div>

          {/* Bulk Delete */}
          <div className="pl-2 border-r border-slate-700 sm:border-r-0 sm:border-l">
            <ConfirmAction
              label={`Delete ${selectedIds.size} constituents`}
              message={`Delete ${selectedIds.size} selected constituents? This will remove all associated notes, tasks, and history permanently.`}
              confirmLabel="Delete Selected"
              danger
              busy={bulkActionBusy}
              idleClassName="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              onConfirm={() => void handleBulkDelete()}
            >
              <Trash2 size={13} />
              Delete ({selectedIds.size})
            </ConfirmAction>
          </div>
        </div>
      )}
    </div>
  );
}
