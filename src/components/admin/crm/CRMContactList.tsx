'use client';

import { BookmarkPlus, Check, Edit2, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { ContactBulkActionsBar } from '@/components/admin/crm/ContactBulkActionsBar';
import { CRMContactActionBar } from '@/components/admin/crm/CRMContactActionBar';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMContactFilterForm } from '@/components/admin/crm/CRMContactFilterForm';
import { CRMContactTable } from '@/components/admin/crm/CRMContactTable';
import { CRMImportModal } from '@/components/admin/crm/CRMImportModal';
import { useClearSelectionOnKeyChange } from '@/hooks/useClearSelectionOnKeyChange';
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
  allContactsSelected,
  CRM_CONTACT_QUICK_FILTERS,
  initialContactFilters,
  isQuickFilterActive,
  neutralContactFilters,
  quickFilterFilters,
  renameSegmentInput,
  saveSegmentInput,
  toggleContactSelection,
  togglePageSelection,
  updateSegmentInput,
} from '@/lib/crm-contact-list';
import {
  type ContactFilters,
  filterArgs,
  filterParams,
  filtersFromSegment,
  hasActiveFilters as hasAnyFilters,
  splitActiveValues,
} from '@/lib/crm-filters';
import type {
  ConsentDecision,
  ConsentFilter,
  CRMContact,
  CRMContactStatus,
  CRMSegment,
} from '@/types/crm';

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

  // Multi-selection state for bulk batch actions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [draftFilters, setDraftFilters] = useState<ContactFilters>(() =>
    initialContactFilters({
      query: currentQuery,
      status: currentStatus,
      district: currentDistrict,
      tag: currentTag,
      consent: currentConsent,
    })
  );
  const { query, status, district, tag, consent } = draftFilters;

  const updateDraft = (patch: Partial<ContactFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  // Tags to offer in the filter: schema-known tags plus whatever is active now.
  const tagOptions = [...new Set([...existingTags, ...splitActiveValues(currentTag)])].sort(
    (a, b) => a.localeCompare(b)
  );

  // The pager must continue the result set the user is actually looking at, which
  // is the one the server ran — not the uncommitted form state. Paging off the
  // draft silently jumped to a different set whenever a filter was typed but not
  // yet applied.
  const appliedFilters: ContactFilters = {
    query: currentQuery,
    status: currentStatus,
    district: currentDistrict,
    tag: currentTag,
    consent: currentConsent,
  };
  const appliedFilterKey = filterParams(appliedFilters).toString();

  // A filter change invalidates selected rows; paging does not.
  useClearSelectionOnKeyChange(appliedFilterKey, setSelectedIds);

  const applyFilters = (next: ContactFilters) => {
    const params = filterParams(next);
    startTransition(() => {
      router.push(`/admin/crm?${params.toString()}`);
    });
  };

  const handleFilterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    applyFilters(draftFilters);
  };

  const handleResetFilters = () => {
    const cleared = neutralContactFilters();
    setDraftFilters(cleared);
    applyFilters(cleared);
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
      const res = await exportCRMContacts(filterArgs(appliedFilters));
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
      const res = await saveCRMSegment(saveSegmentInput(name, appliedFilters));

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
    setDraftFilters(next);
    applyFilters(next);
  };

  const handleDeleteSegment = async (segment: CRMSegment) => {
    // No confirm() here: the ConfirmAction only calls this from its inline
    // confirm step.
    try {
      const res = await deleteCRMSegment(segment.id);
      if (res.success) {
        toast.success('Segment deleted');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete segment');
      }
    } catch {
      toast.error('Failed to delete segment');
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
    setRenamingBusy(true);
    try {
      // Rename only: the stored filter set rides through untouched, so renaming
      // can never silently rewrite what the segment selects.
      const res = await saveCRMSegment(renameSegmentInput(segment, name));
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

  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkDistrictInput, setBulkDistrictInput] = useState('');
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const allOnPageSelected = allContactsSelected(initialContacts, selectedIds);

  const toggleSelectAll = () => {
    setSelectedIds((current) => togglePageSelection(initialContacts, current));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => toggleContactSelection(current, id));
  };

  const handleInlineStatusChange = async (contact: CRMContact, nextStatus: CRMContactStatus) => {
    setUpdatingStatusId(contact.id);
    try {
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        status: nextStatus,
        tags: contact.tags,
        // Without the version this row was rendered from, `saveCRMContact`
        // refuses the write against an already-updated contact — which is every
        // real contact, since the trigger moves `updated_at` on each save.
        updated_at: contact.updated_at,
      });
      if (res.success) {
        toast.success(`Updated status for ${contact.first_name || contact.email}`);
        if (res.warning) toast.warning(res.warning);
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
        if (res.warning) toast.warning(res.warning);
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
    if (contact.tags.some((tag) => tag.toLowerCase() === clean)) {
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
        updated_at: contact.updated_at,
      });
      if (res.success) {
        toast.success(`Added tag #${clean}`);
        if (res.warning) toast.warning(res.warning);
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
        updated_at: contact.updated_at,
      });
      if (res.success) {
        toast.success(`Removed tag #${tagToRemove}`);
        if (res.warning) toast.warning(res.warning);
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

  const handleBulkStatus = async (newStatus: CRMContactStatus) => {
    if (selectedIds.size === 0) return;
    setBulkActionBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateCRMContacts({
        contactIds: ids,
        status: newStatus,
      });
      if (res.success) {
        toast.success(
          res.updatedCount === undefined
            ? 'Updated the selected constituents'
            : `Updated status for ${res.updatedCount} constituents`
        );
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
        toast.success(
          res.updatedCount === undefined
            ? `Added tag #${trimmed} to the selected constituents`
            : `Added tag #${trimmed} to ${res.updatedCount} constituents`
        );
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
        toast.success(
          res.updatedCount === undefined
            ? 'Set district for the selected constituents'
            : `Set district for ${res.updatedCount} constituents`
        );
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
          res.updatedCount === undefined
            ? 'Updated consent for the selected constituents'
            : `${label === 'marked unasked' ? 'Marked' : 'Opted'} ${res.updatedCount} constituents ${label === 'marked unasked' ? 'as never asked' : label}`
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
      const res = await saveCRMSegment(updateSegmentInput(segment, appliedFilters));
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
        toast.success(
          res.deletedCount === undefined
            ? 'Deleted the selected constituents'
            : `Deleted ${res.deletedCount} constituents`
        );
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

  const hasActiveFilters = hasAnyFilters(draftFilters, appliedFilters);

  return (
    <div className="space-y-6">
      {/* Control / Filter Bar */}
      <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
        <CRMContactFilterForm
          query={query}
          status={status}
          district={district}
          tag={tag}
          consent={consent}
          tagOptions={tagOptions}
          tagsMayBeIncomplete={tagsMayBeIncomplete}
          isPending={isPending}
          onQueryChange={(value) => updateDraft({ query: value })}
          onStatusChange={(value) => updateDraft({ status: value })}
          onDistrictChange={(value) => updateDraft({ district: value })}
          onTagChange={(value) => updateDraft({ tag: value })}
          onConsentChange={(value) => updateDraft({ consent: value })}
          onSubmit={handleFilterSubmit}
          onReset={handleResetFilters}
        />

        {/* Quick Segment Filter Pills + saved segments */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mr-1">
            Quick Segments:
          </span>
          {CRM_CONTACT_QUICK_FILTERS.map((pill) => {
            const isActive = isQuickFilterActive(draftFilters, pill);

            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => {
                  /*
                   * A pill changes the status and district and leaves the rest of
                   * the filter alone — that is what makes it a quick filter
                   * rather than a reset. It builds on the applied filters, the
                   * set the server actually ran, and not on the draft: the pager,
                   * the export and save-as-segment all read the applied set, and
                   * the pill was the one path that could act on unsubmitted form
                   * state. Type a name, do not press Apply, click a pill — the
                   * typed name used to go out with it.
                   *
                   * The visible controls follow the applied set too, so what is
                   * on screen is what was sent.
                   */
                  const next = quickFilterFilters(appliedFilters, pill);
                  setDraftFilters(next);
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
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground"
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
        <CRMContactActionBar
          exporting={exporting}
          syncing={syncing}
          totalCount={totalCount}
          onExport={() => void handleExportCSV()}
          onImport={() => setIsImportOpen(true)}
          onSync={() => void handleSyncData()}
          onAdd={() => setIsNewModalOpen(true)}
        />
      </div>

      <CRMContactTable
        contacts={initialContacts}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        appliedFilters={appliedFilters}
        selectedIds={selectedIds}
        allOnPageSelected={allOnPageSelected}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
        onEditContact={setEditingContact}
        onDeleteContact={(id, name) => void handleSingleDelete(id, name)}
        updatingConsentId={updatingConsentId}
        onConsentChange={(contact, next) => void handleInlineConsentChange(contact, next)}
        updatingStatusId={updatingStatusId}
        onStatusChange={(contact, next) => void handleInlineStatusChange(contact, next)}
        addingTagContactId={addingTagContactId}
        inlineTagInput={inlineTagInput}
        onInlineTagInputChange={setInlineTagInput}
        onStartAddTag={setAddingTagContactId}
        onCancelAddTag={() => setAddingTagContactId(null)}
        onAddTag={(contact) => void handleInlineAddTag(contact)}
        onRemoveTag={(contact, tag) => void handleInlineRemoveTag(contact, tag)}
        tagBusyContactId={tagBusyContactId}
        deletingContactId={deletingContactId}
      />

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

      {selectedIds.size > 0 && (
        <ContactBulkActionsBar
          count={selectedIds.size}
          busy={bulkActionBusy}
          tagInput={bulkTagInput}
          districtInput={bulkDistrictInput}
          onClear={() => setSelectedIds(new Set())}
          onTagInputChange={setBulkTagInput}
          onDistrictInputChange={setBulkDistrictInput}
          onBulkStatus={(status) => void handleBulkStatus(status)}
          onBulkAddTag={() => void handleBulkAddTag()}
          onBulkDistrict={() => void handleBulkDistrict()}
          onBulkConsent={(consent) => void handleBulkConsent(consent)}
          onBulkDelete={() => void handleBulkDelete()}
        />
      )}
    </div>
  );
}
