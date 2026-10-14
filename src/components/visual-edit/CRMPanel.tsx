'use client';

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  PenLine,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMTaskForm } from '@/components/admin/crm/CRMTaskForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  addCRMNote,
  bulkDeleteCRMContacts,
  bulkUpdateCRMContacts,
  deleteCRMContact,
  deleteCRMNote,
  deleteCRMTask,
  exportCRMContacts,
  getCRMContactDetail,
  getCRMContacts,
  getCRMExistingTags,
  getCRMSegments,
  getCRMTasksForContact,
  saveCRMContact,
  setCRMEmailConsent,
  setCRMTaskStatus,
  updateCRMNote,
} from '@/lib/actions/crm';
import { consentLabel, filtersFromSegment, splitActiveValues } from '@/lib/crm-filters';
import type {
  ConsentFilter,
  CRMActivity,
  CRMContact,
  CRMContactStatus,
  CRMSegment,
  CRMTask,
} from '@/types/unified';

interface CRMPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/*
 * What a segment row will actually apply, in the row itself. The label used to
 * show only the text query while the apply path set only the text query — both
 * halves agreed and both were wrong for a segment saved with chips.
 */
function segmentSummary(segment: CRMSegment): string {
  const f = filtersFromSegment(segment);
  const parts = [
    ...(f.query ? [`“${f.query.slice(0, 30)}${f.query.length > 30 ? '…' : ''}”`] : []),
    ...splitActiveValues(f.status),
    ...splitActiveValues(f.district),
    ...splitActiveValues(f.tag).map((t) => `#${t}`),
    ...(f.consent === 'all' ? [] : [f.consent.replace('_', ' ')]),
  ];
  return parts.length > 0 ? parts.join(' · ') : 'all constituents';
}

const CONSENT_COLORS: Record<string, string> = {
  opted_in: 'bg-emerald-500/10 text-emerald-400',
  opted_out: 'bg-rose-500/10 text-rose-400',
  unasked: 'bg-amber-500/10 text-amber-400',
};

const STATUS_COLORS: Record<string, string> = {
  active_volunteer: 'bg-emerald-500/10 text-emerald-400',
  supporter: 'bg-slate-500/10 text-slate-400',
  donor: 'bg-amber-500/10 text-amber-400',
  choir: 'bg-purple-500/10 text-purple-400',
  organizer: 'bg-blue-500/10 text-blue-400',
  inactive: 'bg-rose-500/10 text-rose-400',
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  active_volunteer: 'Active volunteer',
  supporter: 'Supporter',
  donor: 'Donor',
  choir: 'Choir',
  organizer: 'Organizer',
  inactive: 'Inactive',
};

const CONSENT_FILTER_LABELS: Record<string, string> = {
  opted_in: 'Opted in',
  opted_out: 'Opted out',
  unasked: 'Never asked',
};

export const CRMPanel: React.FC<CRMPanelProps> = ({ isOpen, onClose }) => {
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [consentFilter, setConsentFilter] = useState<ConsentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<CRMContact['status'] | 'all'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  /*
   * A segment applied as a full replacement, like the admin directory. The
   * single-value dropdowns cannot hold a multi-valued dimension, so the
   * segment's lists ride the `*List` action params while applied and the
   * dropdowns reset to neutral — a dropdown left set would intersect with the
   * segment and show a set neither control describes.
   */
  const [appliedSegment, setAppliedSegment] = useState<{
    id: string;
    name: string;
    statuses: string[];
    districts: string[];
    tags: string[];
  } | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkDistrictInput, setBulkDistrictInput] = useState('');
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [segments, setSegments] = useState<CRMSegment[]>([]);
  const [showSegments, setShowSegments] = useState(false);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'notes' | 'system'>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');
  const [editingNoteDesc, setEditingNoteDesc] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteDesc, setNewNoteDesc] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newNoteInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      statusFilter !== 'all' ||
      consentFilter !== 'all' ||
      selectedTag ||
      districtFilter.trim() ||
      appliedSegment !== null
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setConsentFilter('all');
    setSelectedTag('');
    setDistrictFilter('');
    setAppliedSegment(null);
    setPage(1);
  };

  /*
   * The set on screen, for the directory read and the CSV export alike. The
   * export used to rebuild its own args from the dropdowns and so dropped the
   * consent filter — and would now drop an applied segment too. One builder,
   * two callers.
   */
  const contactQueryArgs = useCallback(
    () => ({
      query: searchQuery || undefined,
      consent: consentFilter === 'all' ? undefined : consentFilter,
      ...(appliedSegment
        ? {
            statusList: appliedSegment.statuses,
            districtList: appliedSegment.districts,
            tagList: appliedSegment.tags,
          }
        : {
            status: statusFilter === 'all' ? undefined : statusFilter,
            tag: selectedTag || undefined,
            district: districtFilter.trim() || undefined,
          }),
    }),
    [searchQuery, consentFilter, appliedSegment, statusFilter, selectedTag, districtFilter]
  );

  const PAGE_SIZE = 25;

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCRMContacts({
        ...contactQueryArgs(),
        page,
        pageSize: PAGE_SIZE,
      });
      setContacts(res.contacts);
      setTotalCount(res.totalCount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [contactQueryArgs, page]);

  const handleExportCSV = async () => {
    if (totalCount === 0) {
      toast.error('No constituents to export');
      return;
    }
    setIsExporting(true);
    try {
      const res = await exportCRMContacts(contactQueryArgs());
      if (res.error || !res.csv) {
        toast.error(res.error || 'Failed to export CSV');
        return;
      }
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indivisible-crm-constituents-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (res.truncated) {
        toast.info(`Exported ${res.count} of ${res.matchedCount} constituents (file capped)`);
      } else {
        toast.success(`Exported ${res.count} constituents to CSV`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const loadTasks = useCallback(async (contactId: string) => {
    setTasksLoading(true);
    try {
      const res = await getCRMTasksForContact(contactId);
      setTasks(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadSegments = useCallback(async () => {
    try {
      const res = await getCRMSegments();
      setSegments(res.segments);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load segments');
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await getCRMExistingTags();
      setAvailableTags(res.tags);
    } catch {
      // Non-fatal if tag metadata fails to load
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (isOpen) {
      loadSegments();
      loadTags();
    }
  }, [isOpen, loadSegments, loadTags]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const loadActivities = useCallback(async (contactId: string) => {
    setActivitiesLoading(true);
    try {
      const detail = await getCRMContactDetail(contactId);
      const acts = (detail as { activities?: CRMActivity[] }).activities ?? [];
      setActivities(acts.slice(0, 50));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'notes') {
      return activities.filter((a) => a.type === 'note');
    }
    if (activityFilter === 'system') {
      return activities.filter((a) => a.type !== 'note');
    }
    return activities;
  }, [activities, activityFilter]);

  const notesCount = useMemo(
    () => activities.filter((a) => a.type === 'note').length,
    [activities]
  );

  const systemCount = useMemo(
    () => activities.filter((a) => a.type !== 'note').length,
    [activities]
  );

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'open') return tasks.filter((t) => t.status !== 'done');
    if (taskFilter === 'done') return tasks.filter((t) => t.status === 'done');
    return tasks;
  }, [tasks, taskFilter]);

  useEffect(() => {
    if (selectedContact) {
      loadTasks(selectedContact.id);
      loadActivities(selectedContact.id);
    } else {
      setTasks([]);
      setActivities([]);
    }
  }, [selectedContact, loadTasks, loadActivities]);

  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const res = await deleteCRMContact(id);
      if (res.success) {
        toast.success('Contact deleted');
        loadContacts();
        if (selectedContact?.id === id) setSelectedContact(null);
      } else {
        toast.error(res.error ?? 'Failed to delete contact');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleSetConsent = async (id: string, consent: 'opted_in' | 'opted_out' | 'unasked') => {
    try {
      const res = await setCRMEmailConsent({ contactId: id, doNotEmail: consent });
      if (res.success) {
        toast.success('Consent updated');
        if (selectedContact && selectedContact.id === id) {
          const nextDoNotEmail =
            consent === 'opted_out' ? true : consent === 'opted_in' ? false : null;
          setSelectedContact((prev) => (prev ? { ...prev, do_not_email: nextDoNotEmail } : null));
          loadActivities(id);
        }
        loadContacts();
      } else {
        toast.error(res.error ?? 'Failed to update consent');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update consent');
    }
  };

  const handleSetStatus = async (status: CRMContactStatus) => {
    if (!selectedContact) return;
    try {
      const res = await saveCRMContact({
        id: selectedContact.id,
        email: selectedContact.email,
        first_name: selectedContact.first_name,
        last_name: selectedContact.last_name,
        phone: selectedContact.phone,
        address: selectedContact.address,
        city: selectedContact.city,
        zip_code: selectedContact.zip_code,
        district: selectedContact.district ?? undefined,
        notes: selectedContact.notes,
        tags: selectedContact.tags,
        status,
        updated_at: selectedContact.updated_at,
      });
      if (res.success) {
        setSelectedContact((prev) =>
          prev
            ? {
                ...prev,
                status,
                updated_at: res.updatedAt || prev.updated_at,
              }
            : null
        );
        toast.success(`Status updated to ${status.replace('_', ' ')}`);
        loadContacts();
      } else {
        toast.error(res.error ?? 'Failed to update status');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleAddTag = async (newTag: string) => {
    if (!selectedContact || !newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    // Compared lowercased, matching the server schema: pre-normalization rows
    // still hold mixed case, and the save lowercases the whole array — so a
    // case-sensitive check would add a duplicate the server merges away.
    if (selectedContact.tags.some((t) => t.toLowerCase() === tag)) {
      toast.error(`Tag "${tag}" already exists`);
      return;
    }
    const updatedTags = [...selectedContact.tags, tag];
    try {
      const res = await saveCRMContact({
        id: selectedContact.id,
        email: selectedContact.email,
        first_name: selectedContact.first_name,
        last_name: selectedContact.last_name,
        phone: selectedContact.phone,
        address: selectedContact.address,
        city: selectedContact.city,
        zip_code: selectedContact.zip_code,
        district: selectedContact.district ?? undefined,
        notes: selectedContact.notes,
        status: selectedContact.status as CRMContactStatus,
        tags: updatedTags,
        updated_at: selectedContact.updated_at,
      });
      if (res.success) {
        setSelectedContact((prev) =>
          prev
            ? {
                ...prev,
                tags: updatedTags,
                updated_at: res.updatedAt || prev.updated_at,
              }
            : null
        );
        setNewTagInput('');
        setIsAddingTag(false);
        toast.success(`Tag "${tag}" added`);
        loadContacts();
        loadTags();
      } else {
        toast.error(res.error ?? 'Failed to add tag');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedContact) return;
    // Case-insensitive like the bulk-remove path on the server, so a legacy
    // mixed-case row is removed when its chip is clicked.
    const updatedTags = selectedContact.tags.filter(
      (t) => t.toLowerCase() !== tagToRemove.toLowerCase()
    );
    try {
      const res = await saveCRMContact({
        id: selectedContact.id,
        email: selectedContact.email,
        first_name: selectedContact.first_name,
        last_name: selectedContact.last_name,
        phone: selectedContact.phone,
        address: selectedContact.address,
        city: selectedContact.city,
        zip_code: selectedContact.zip_code,
        district: selectedContact.district ?? undefined,
        notes: selectedContact.notes,
        status: selectedContact.status as CRMContactStatus,
        tags: updatedTags,
        updated_at: selectedContact.updated_at,
      });
      if (res.success) {
        setSelectedContact((prev) =>
          prev
            ? {
                ...prev,
                tags: updatedTags,
                updated_at: res.updatedAt || prev.updated_at,
              }
            : null
        );
        toast.success(`Tag "${tagToRemove}" removed`);
        loadContacts();
        loadTags();
      } else {
        toast.error(res.error ?? 'Failed to remove tag');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  /*
   * A saved segment as the directory filter — a full replacement, like the
   * admin directory. The old handler set only the text query, so a segment
   * saved with status, district, tag or consent chips silently became a text
   * search: the wrong set of people with no error. The lists ride the `*List`
   * action params because the single-value dropdowns cannot hold them.
   */
  const handleApplySegment = (segment: CRMSegment) => {
    const next = filtersFromSegment(segment);
    const statuses = splitActiveValues(next.status);
    const districts = splitActiveValues(next.district);
    const tags = splitActiveValues(next.tag);
    setSearchQuery(next.query);
    setConsentFilter(next.consent);
    setStatusFilter('all');
    setSelectedTag('');
    setDistrictFilter('');
    setSelectedContact(null);
    setSelectedContactIds(new Set());
    setAppliedSegment({ id: segment.id, name: segment.name, statuses, districts, tags });
    setPage(1);
    setShowSegments(false);
    const multi = [
      statuses.length > 1 ? `${statuses.length} statuses` : '',
      districts.length > 1 ? `${districts.length} districts` : '',
      tags.length > 1 ? `${tags.length} tags` : '',
    ].filter(Boolean);
    toast.info(
      multi.length > 0
        ? `Segment "${segment.name}" applied — ${multi.join(', ')} combined`
        : `Segment "${segment.name}" applied`
    );
  };

  const handleClearSegment = () => {
    setAppliedSegment(null);
    setPage(1);
  };

  const handleBulkStatus = async (status: CRMContactStatus) => {
    if (selectedContactIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds: Array.from(selectedContactIds),
        status,
      });
      if (res.success) {
        toast.success(
          `Updated status for ${res.updatedCount ?? selectedContactIds.size} constituents`
        );
        setSelectedContactIds(new Set());
        loadContacts();
      } else {
        toast.error(res.error ?? 'Failed to update status');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkConsent = async (consent: 'opted_in' | 'opted_out' | 'unasked') => {
    if (selectedContactIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds: Array.from(selectedContactIds),
        consent,
      });
      if (res.success) {
        toast.success(
          `Updated consent for ${res.updatedCount ?? selectedContactIds.size} constituents`
        );
        setSelectedContactIds(new Set());
        loadContacts();
      } else {
        toast.error(res.error ?? 'Failed to update consent');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update consent');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkAddTag = async () => {
    if (selectedContactIds.size === 0 || !bulkTagInput.trim()) return;
    const tag = bulkTagInput.trim().toLowerCase();
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds: Array.from(selectedContactIds),
        addTags: [tag],
      });
      if (res.success) {
        toast.success(
          `Added tag #${tag} to ${res.updatedCount ?? selectedContactIds.size} constituents`
        );
        setBulkTagInput('');
        setSelectedContactIds(new Set());
        loadContacts();
        loadTags();
      } else {
        toast.error(res.error ?? 'Failed to add tag');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDistrict = async () => {
    if (selectedContactIds.size === 0 || !bulkDistrictInput.trim()) return;
    const district = bulkDistrictInput.trim().toUpperCase();
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds: Array.from(selectedContactIds),
        district,
      });
      if (res.success) {
        toast.success(
          `Assigned district ${district} to ${res.updatedCount ?? selectedContactIds.size} constituents`
        );
        setBulkDistrictInput('');
        setSelectedContactIds(new Set());
        loadContacts();
      } else {
        toast.error(res.error ?? 'Failed to assign district');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign district');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContactIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const ids = Array.from(selectedContactIds);
      const res = await bulkDeleteCRMContacts(ids);
      if (res.success) {
        toast.success(`Deleted ${res.deletedCount ?? ids.length} constituents`);
        if (selectedContact && ids.includes(selectedContact.id)) {
          setSelectedContact(null);
        }
        setSelectedContactIds(new Set());
        loadContacts();
        loadTags();
      } else {
        toast.error(res.error ?? 'Failed to delete constituents');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete constituents');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newNoteTitle.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await addCRMNote({
        contactId: selectedContact.id,
        title: newNoteTitle.trim(),
        description: newNoteDesc.trim(),
      });
      if (res.success) {
        setNewNoteTitle('');
        setNewNoteDesc('');
        loadActivities(selectedContact.id);
        toast.success('Note added');
      } else {
        toast.error(res.error ?? 'Failed to add note');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleUpdateNote = async (activityId: string) => {
    if (!selectedContact || !editingNoteTitle.trim()) return;
    try {
      const res = await updateCRMNote({
        activityId,
        title: editingNoteTitle.trim(),
        description: editingNoteDesc.trim(),
      });
      if (res.success) {
        setEditingNoteId(null);
        setEditingNoteTitle('');
        setEditingNoteDesc('');
        loadActivities(selectedContact.id);
        toast.success('Note updated');
      } else {
        toast.error(res.error ?? 'Failed to update note');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  const consentOptions = [
    { value: 'opted_in' as const, label: 'Opted in' },
    { value: 'opted_out' as const, label: 'Opted out' },
    { value: 'unasked' as const, label: 'Never asked' },
  ];

  const editorModal = isEditorOpen ? (
    <CRMContactEditorModal
      contact={selectedContact ?? undefined}
      isOpen={isEditorOpen}
      onClose={() => setIsEditorOpen(false)}
      onSaved={() => {
        loadContacts();
        if (selectedContact) {
          loadActivities(selectedContact.id);
        }
      }}
    />
  ) : null;

  const taskFormModal =
    isTaskFormOpen && selectedContact ? (
      <Dialog open={isTaskFormOpen} onOpenChange={() => setIsTaskFormOpen(false)}>
        <DialogContent className="max-w-md bg-surface-card text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              Add Follow-up
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a follow-up task for {selectedContact.first_name} {selectedContact.last_name}
            </DialogDescription>
          </DialogHeader>
          <CRMTaskForm
            contactId={selectedContact.id}
            contactName={`${selectedContact.first_name} ${selectedContact.last_name}`}
            onDone={() => {
              setIsTaskFormOpen(false);
              loadTasks(selectedContact.id);
            }}
          />
        </DialogContent>
      </Dialog>
    ) : null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] bg-surface-card text-foreground p-0">
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">
                  Constituents
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Search, create, and manage constituents. Changes persist to Supabase.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSegments(!showSegments)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    showSegments
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Segments
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={isExporting || totalCount === 0}
                  title="Export filtered constituents to CSV"
                  aria-label="Export CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {isExporting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContact(null);
                    setIsEditorOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors shadow-xs"
                >
                  <Plus size={12} className="mr-1" /> Add
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Close CRM panel"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[calc(100%-80px)] overflow-hidden">
            {/* Contact List */}
            <div
              className={`w-full md:w-96 flex flex-col border-r border-border bg-muted/30 shrink-0 ${
                selectedContact || showSegments ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Search & Filters */}
              <div className="p-3 border-b border-border space-y-2">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    size={16}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search constituents… (/)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    disabled={appliedSegment !== null}
                    title={
                      appliedSegment ? 'Clear the applied segment to search manually' : undefined
                    }
                    className="w-full pl-10 pr-8 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPage(1);
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={consentFilter}
                    onChange={(e) => {
                      setConsentFilter(
                        e.target.value as 'all' | 'opted_in' | 'opted_out' | 'unasked'
                      );
                      setPage(1);
                    }}
                    aria-label="Filter by email consent"
                    disabled={appliedSegment !== null}
                    title={
                      appliedSegment ? 'Clear the applied segment to filter manually' : undefined
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="all">All consent</option>
                    <option value="opted_in">Opted in</option>
                    <option value="opted_out">Opted out</option>
                    <option value="unasked">Never asked</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as CRMContact['status'] | 'all');
                      setPage(1);
                    }}
                    aria-label="Filter by constituent status"
                    disabled={appliedSegment !== null}
                    title={
                      appliedSegment ? 'Clear the applied segment to filter manually' : undefined
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="all">All statuses</option>
                    <option value="active_volunteer">Active volunteer</option>
                    <option value="supporter">Supporter</option>
                    <option value="donor">Donor</option>
                    <option value="choir">Choir</option>
                    <option value="organizer">Organizer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedTag}
                    onChange={(e) => {
                      setSelectedTag(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter by tag"
                    disabled={appliedSegment !== null}
                    title={
                      appliedSegment ? 'Clear the applied segment to filter manually' : undefined
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      All tags{availableTags.length > 0 ? ` (${availableTags.length})` : ''}
                    </option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        #{tag}
                      </option>
                    ))}
                  </select>
                  {selectedTag && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTag('');
                        setPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1 transition-colors"
                      aria-label="Clear tag filter"
                      title="Clear tag filter"
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="relative w-full">
                    <MapPin
                      size={12}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <input
                      type="text"
                      value={districtFilter}
                      onChange={(e) => {
                        setDistrictFilter(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Filter by district (e.g. CA-06)…"
                      aria-label="Filter by district"
                      disabled={appliedSegment !== null}
                      title={
                        appliedSegment ? 'Clear the applied segment to filter manually' : undefined
                      }
                      className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  {districtFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setDistrictFilter('');
                        setPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1 transition-colors"
                      aria-label="Clear district filter"
                      title="Clear district filter"
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {appliedSegment && (
                      <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary text-white text-xs max-w-full">
                        <span className="font-semibold truncate">
                          Segment: {appliedSegment.name}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSegment}
                          className="hover:text-white/70 p-0.5 rounded shrink-0"
                          aria-label="Clear applied segment"
                          title="Clear the applied segment and return to manual filters"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {searchQuery.trim() && (
                      <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs max-w-full">
                        <span className="flex items-center gap-1 truncate">
                          <Search size={11} className="shrink-0" />
                          <span className="font-semibold truncate">
                            Search: &ldquo;{searchQuery.trim()}&rdquo;
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setPage(1);
                          }}
                          className="text-primary hover:text-primary-dark p-0.5 rounded shrink-0"
                          aria-label="Remove search filter"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {statusFilter !== 'all' && (
                      <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
                        <span className="font-semibold truncate">
                          Status: {STATUS_FILTER_LABELS[statusFilter] ?? statusFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('all');
                            setPage(1);
                          }}
                          className="text-primary hover:text-primary-dark p-0.5 rounded shrink-0"
                          aria-label="Remove status filter"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {consentFilter !== 'all' && (
                      <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
                        <span className="font-semibold truncate">
                          Consent: {CONSENT_FILTER_LABELS[consentFilter] ?? consentFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setConsentFilter('all');
                            setPage(1);
                          }}
                          className="text-primary hover:text-primary-dark p-0.5 rounded shrink-0"
                          aria-label="Remove consent filter"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {selectedTag && (
                      <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <Tag size={12} className="shrink-0" />
                          <span className="font-semibold truncate">Filtered by #{selectedTag}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTag('');
                            setPage(1);
                          }}
                          className="text-primary hover:text-primary-dark p-0.5 rounded"
                          aria-label="Remove active tag filter"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {districtFilter.trim() && (
                      <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin size={12} className="shrink-0" />
                          <span className="font-semibold truncate">District: {districtFilter}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDistrictFilter('');
                            setPage(1);
                          }}
                          className="text-primary hover:text-primary-dark p-0.5 rounded"
                          aria-label="Remove active district filter"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      aria-label="Reset all filters"
                      title="Reset all filters"
                    >
                      <RotateCcw size={10} />
                      <span>Reset all</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Select All & Multi-Select Toolbar */}
              {contacts.length > 0 && (
                <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      aria-label="Select all constituents on page"
                      checked={
                        contacts.length > 0 && contacts.every((c) => selectedContactIds.has(c.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContactIds((prev) => {
                            const next = new Set(prev);
                            for (const c of contacts) {
                              next.add(c.id);
                            }
                            return next;
                          });
                        } else {
                          setSelectedContactIds((prev) => {
                            const next = new Set(prev);
                            for (const c of contacts) {
                              next.delete(c.id);
                            }
                            return next;
                          });
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-muted-foreground font-medium">
                      {selectedContactIds.size > 0
                        ? `${selectedContactIds.size} selected`
                        : `Select all (${contacts.length})`}
                    </span>
                  </label>
                  {selectedContactIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedContactIds(new Set())}
                      className="text-muted-foreground hover:text-foreground text-[11px] underline"
                      aria-label="Clear selection"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {selectedContactIds.size > 0 && (
                <div className="p-2.5 bg-primary/5 border-b border-primary/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Check size={13} className="text-primary" />
                      <span>Bulk Actions ({selectedContactIds.size})</span>
                    </span>
                    {isBulkUpdating && <Loader2 size={12} className="animate-spin text-primary" />}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          void handleBulkStatus(e.target.value as CRMContactStatus);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      disabled={isBulkUpdating}
                      aria-label="Bulk update status"
                      className="px-2 py-1 rounded bg-background border border-border text-[11px] font-medium focus:ring-1 focus:ring-primary truncate disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Change status…
                      </option>
                      <option value="active_volunteer">Active volunteer</option>
                      <option value="supporter">Supporter</option>
                      <option value="donor">Donor</option>
                      <option value="choir">Choir</option>
                      <option value="organizer">Organizer</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          void handleBulkConsent(
                            e.target.value as 'opted_in' | 'opted_out' | 'unasked'
                          );
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      disabled={isBulkUpdating}
                      aria-label="Bulk update consent"
                      className="px-2 py-1 rounded bg-background border border-border text-[11px] font-medium focus:ring-1 focus:ring-primary truncate disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Change consent…
                      </option>
                      <option value="opted_in">Opt in</option>
                      <option value="opted_out">Opt out</option>
                      <option value="unasked">Never asked</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      placeholder="Add tag to selected…"
                      disabled={isBulkUpdating}
                      aria-label="Bulk tag name input"
                      className="w-full px-2 py-1 text-[11px] rounded bg-background border border-border focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleBulkAddTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleBulkAddTag}
                      disabled={!bulkTagInput.trim() || isBulkUpdating}
                      aria-label="Apply bulk tag"
                      className="px-2 py-1 text-[11px] font-bold rounded bg-primary text-white hover:bg-primary-light disabled:opacity-50 shrink-0 transition-colors"
                    >
                      Tag
                    </button>
                    <ConfirmAction
                      label={`Delete ${selectedContactIds.size} constituents`}
                      message={`Delete ${selectedContactIds.size} selected constituents? This cannot be undone.`}
                      confirmLabel="Delete all"
                      danger
                      onConfirm={handleBulkDelete}
                      idleClassName="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition-colors shrink-0 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </ConfirmAction>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={bulkDistrictInput}
                      onChange={(e) => setBulkDistrictInput(e.target.value)}
                      placeholder="Assign district (e.g. CA-06)…"
                      disabled={isBulkUpdating}
                      aria-label="Bulk district input"
                      className="w-full px-2 py-1 text-[11px] rounded bg-background border border-border focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleBulkDistrict();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleBulkDistrict}
                      disabled={!bulkDistrictInput.trim() || isBulkUpdating}
                      aria-label="Apply bulk district"
                      className="px-2 py-1 text-[11px] font-bold rounded bg-primary text-white hover:bg-primary-light disabled:opacity-50 shrink-0 transition-colors"
                    >
                      District
                    </button>
                  </div>
                </div>
              )}

              {/* Contact List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <p className="font-medium">No constituents found</p>
                    <p className="text-xs mt-1">Adjust your search or create a new constituent</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {contacts.map((contact) => (
                      <li
                        key={contact.id}
                        className={`flex items-start gap-2.5 px-3 py-2 transition-colors ${
                          selectedContact?.id === contact.id
                            ? 'bg-primary/10'
                            : 'hover:bg-background/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${contact.first_name} ${contact.last_name}`}
                          checked={selectedContactIds.has(contact.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedContactIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) {
                                next.add(contact.id);
                              } else {
                                next.delete(contact.id);
                              }
                              return next;
                            });
                          }}
                          className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 mt-1 shrink-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none"
                          onClick={() => setSelectedContact(contact)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-foreground text-sm">
                                {contact.first_name} {contact.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {contact.email}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  STATUS_COLORS[contact.status] || 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {contact.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            {contact.district && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                {contact.district}
                              </span>
                            )}
                            {consentOptions.map((opt) => {
                              const currentConsent = consentLabel(contact.do_not_email);
                              return (
                                <span
                                  key={opt.value}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                    currentConsent === opt.value
                                      ? CONSENT_COLORS[opt.value]
                                      : 'bg-muted/50 text-muted-foreground'
                                  }`}
                                >
                                  {opt.value === 'opted_in'
                                    ? '✓'
                                    : opt.value === 'opted_out'
                                      ? '✗'
                                      : '?'}
                                </span>
                              );
                            })}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Pagination */}
                {totalCount > PAGE_SIZE && (
                  <div className="p-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Page {page} of {Math.ceil(totalCount / PAGE_SIZE)} ({totalCount} total)
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={page === 1 || loading}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-2 py-1 text-xs rounded border border-border hover:bg-muted disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={page * PAGE_SIZE >= totalCount || loading}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-2 py-1 text-xs rounded border border-border hover:bg-muted disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detail / Editor Panel */}
            <div
              className={`flex-1 flex flex-col bg-background overflow-hidden ${
                !selectedContact && !showSegments ? 'hidden md:flex' : 'flex'
              }`}
            >
              {showSegments ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSegments(false)}
                        className="md:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Back to constituents"
                      >
                        <ArrowLeft size={13} />
                        <span>Back</span>
                      </button>
                      <h3 className="font-black uppercase tracking-tight text-lg">Segments</h3>
                    </div>
                    <a
                      href="/admin/crm/segments"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Manage segments</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  {segments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No segments yet. Create segments in the admin CRM.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {segments.map((segment) => {
                        const isApplied = appliedSegment?.id === segment.id;
                        return (
                          <button
                            key={segment.id}
                            type="button"
                            onClick={() => handleApplySegment(segment)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${
                              isApplied
                                ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                                : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <span>{segment.name}</span>
                                {isApplied && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white uppercase tracking-wider">
                                    Active
                                  </span>
                                )}
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                Filter: {segmentSummary(segment)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : selectedContact ? (
                <>
                  <div className="p-4 border-b border-border">
                    <div className="md:hidden mb-2">
                      <button
                        type="button"
                        onClick={() => setSelectedContact(null)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Back to constituents"
                      >
                        <ArrowLeft size={13} />
                        <span>Back to constituents</span>
                      </button>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black uppercase tracking-tight text-lg text-foreground">
                          {selectedContact.first_name} {selectedContact.last_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-muted-foreground text-sm font-medium">
                            {selectedContact.email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedContact.email, 'email')}
                            title="Copy email address"
                            aria-label="Copy email"
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            {copiedField === 'email' ? (
                              <Check size={13} className="text-emerald-500" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                          <a
                            href={`mailto:${selectedContact.email}`}
                            title="Send email via default client"
                            aria-label="Send email"
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Mail size={13} />
                          </a>
                          <a
                            href={`/admin/crm/broadcasts?recipient=${encodeURIComponent(selectedContact.email)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Compose broadcast in CRM Studio"
                            aria-label="Compose broadcast"
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          >
                            <MessageSquare size={13} />
                          </a>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <select
                            value={selectedContact.status}
                            onChange={(e) => handleSetStatus(e.target.value as CRMContactStatus)}
                            aria-label="Update constituent status"
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border border-border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-gold ${
                              STATUS_COLORS[selectedContact.status] ||
                              'bg-muted text-muted-foreground'
                            }`}
                          >
                            <option value="active_volunteer">Active Volunteer</option>
                            <option value="supporter">Supporter</option>
                            <option value="donor">Donor</option>
                            <option value="choir">Choir</option>
                            <option value="organizer">Organizer</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          {consentOptions.map((opt) => {
                            const currentConsent = consentLabel(selectedContact.do_not_email);
                            return (
                              <span
                                key={opt.value}
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  currentConsent === opt.value
                                    ? CONSENT_COLORS[opt.value]
                                    : 'bg-muted/50 text-muted-foreground'
                                }`}
                              >
                                {opt.value === 'opted_in'
                                  ? '✓ Opted in'
                                  : opt.value === 'opted_out'
                                    ? '✗ Opted out'
                                    : '? Never asked'}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditorOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors shadow-xs"
                        >
                          <PenLine size={12} className="mr-1" /> Edit
                        </button>
                        <ConfirmAction
                          label="Delete constituent"
                          message={`Delete "${selectedContact.first_name} ${selectedContact.last_name}"? This cannot be undone.`}
                          confirmLabel="Delete"
                          danger
                          onConfirm={() => handleDeleteContact(selectedContact.id)}
                          idleClassName="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors"
                        >
                          <span className="hidden sm:inline">Delete</span>
                        </ConfirmAction>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Contact Details */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedContact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={14} className="text-muted-foreground shrink-0" />
                          <span>{selectedContact.phone}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedContact.phone) {
                                handleCopy(selectedContact.phone, 'phone');
                              }
                            }}
                            title="Copy phone number"
                            aria-label="Copy phone"
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            {copiedField === 'phone' ? (
                              <Check size={13} className="text-emerald-500" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                          <a
                            href={`tel:${selectedContact.phone}`}
                            title="Call phone number"
                            aria-label="Call phone"
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Phone size={13} />
                          </a>
                        </div>
                      )}
                      {selectedContact.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin size={14} className="text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {selectedContact.address}, {selectedContact.city}{' '}
                            {selectedContact.zip_code}
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${selectedContact.address}, ${selectedContact.city || ''} ${selectedContact.zip_code || ''}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            title="View on Google Maps"
                            aria-label="View on Google Maps"
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      )}
                      {selectedContact.district && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin size={14} className="text-muted-foreground shrink-0" />
                          <span>
                            District:{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setDistrictFilter(selectedContact.district ?? '');
                                setSelectedContact(null);
                                setPage(1);
                              }}
                              className="font-semibold text-primary hover:text-primary-light hover:underline inline-flex items-center gap-1"
                              title={`Filter directory by district ${selectedContact.district}`}
                              aria-label={`Filter directory by district ${selectedContact.district}`}
                            >
                              <span>{selectedContact.district}</span>
                            </button>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={14} className="text-muted-foreground shrink-0" />
                        <span>Source: {selectedContact.source}</span>
                      </div>
                      {selectedContact.total_donated_cents &&
                        selectedContact.total_donated_cents > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Tag size={14} className="text-muted-foreground shrink-0" />
                            <span>
                              Donated: ${(selectedContact.total_donated_cents / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                      <div className="sm:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Tag size={12} />
                            <span>Tags ({selectedContact.tags.length})</span>
                          </span>
                          {!isAddingTag && (
                            <button
                              type="button"
                              onClick={() => setIsAddingTag(true)}
                              className="text-xs font-bold text-primary hover:text-primary-light transition-colors inline-flex items-center gap-1"
                            >
                              <Plus size={11} /> Add Tag
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {selectedContact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-muted border border-border text-xs font-semibold text-foreground group"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTag(tag);
                                  setPage(1);
                                  toast.info(`Filtered by tag #${tag}`);
                                }}
                                className="hover:text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Filter constituents by #${tag}`}
                                aria-label={`Filter constituents by tag ${tag}`}
                              >
                                <span>#{tag}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                title={`Remove tag ${tag}`}
                                aria-label={`Remove tag ${tag}`}
                                className="text-muted-foreground hover:text-rose-400 transition-colors"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                          {isAddingTag && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleAddTag(newTagInput);
                              }}
                              className="inline-flex items-center gap-1"
                            >
                              <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                placeholder="New tag…"
                                autoFocus
                                className="px-2 py-0.5 text-xs rounded-lg border border-primary bg-background text-foreground focus:outline-none w-28"
                              />
                              <button
                                type="submit"
                                className="p-1 rounded bg-primary text-white text-xs font-bold hover:bg-primary-light"
                                title="Add tag"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingTag(false);
                                  setNewTagInput('');
                                }}
                                className="p-1 rounded text-muted-foreground hover:text-foreground"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Consent Control */}
                    <div className="border-t border-border pt-4">
                      <h4 className="font-bold text-sm mb-2">Email Consent</h4>
                      <div className="flex flex-wrap gap-2">
                        {consentOptions.map((opt) => {
                          const currentConsent = consentLabel(selectedContact.do_not_email);
                          const isActive = currentConsent === opt.value;
                          return (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => handleSetConsent(selectedContact.id, opt.value)}
                              disabled={loading}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                  ? `${CONSENT_COLORS[opt.value]} ring-2 ring-offset-2 ring-offset-background`
                                  : 'bg-muted text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Follow-ups */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">Follow-ups</h4>
                          {tasks.length > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setTaskFilter('all')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  taskFilter === 'all'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                All ({tasks.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaskFilter('open')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  taskFilter === 'open'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Open ({tasks.filter((t) => t.status !== 'done').length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaskFilter('done')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  taskFilter === 'done'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Done ({tasks.filter((t) => t.status === 'done').length})
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTaskFormOpen(true)}
                          className="px-2 py-1 text-xs font-bold rounded bg-primary text-white hover:bg-primary-light transition-colors"
                        >
                          <Plus size={12} className="mr-1" /> Add
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {tasksLoading ? (
                          <div className="text-center py-4">
                            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : tasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No follow-ups yet
                          </p>
                        ) : filteredTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No {taskFilter} follow-ups
                          </p>
                        ) : (
                          filteredTasks.map((task) => {
                            const isOverdue =
                              task.due_at &&
                              task.status !== 'done' &&
                              new Date(task.due_at).getTime() < Date.now();
                            return (
                              <div
                                key={task.id}
                                className="p-2.5 rounded-xl border border-border bg-background transition-colors hover:border-primary/30"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium truncate text-foreground">
                                    {task.title}
                                  </p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isOverdue && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500">
                                        <AlertCircle size={10} />
                                        <span>Overdue</span>
                                      </span>
                                    )}
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        task.status === 'done'
                                          ? 'bg-emerald-500/10 text-emerald-400'
                                          : task.status === 'in_progress'
                                            ? 'bg-amber-500/10 text-amber-400'
                                            : 'bg-slate-500/10 text-slate-400'
                                      }`}
                                    >
                                      {task.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50 text-[10px]">
                                  {task.due_at ? (
                                    <span
                                      className={
                                        isOverdue
                                          ? 'font-bold text-rose-500'
                                          : 'text-muted-foreground'
                                      }
                                    >
                                      Due: {new Date(task.due_at).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">No due date</span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const contactId = selectedContact?.id;
                                        if (!contactId) return;
                                        await setCRMTaskStatus({
                                          id: task.id,
                                          status: task.status === 'done' ? 'open' : 'done',
                                        });
                                        loadTasks(contactId);
                                      }}
                                      className="font-bold px-2 py-0.5 rounded bg-surface-muted hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                      aria-label={task.status === 'done' ? 'Reopen' : 'Complete'}
                                    >
                                      {task.status === 'done' ? 'Reopen' : 'Done'}
                                    </button>
                                    <ConfirmAction
                                      label="Delete task"
                                      message={`Delete "${task.title}"?`}
                                      confirmLabel="Delete"
                                      danger
                                      idleClassName="font-bold px-2 py-0.5 rounded hover:text-rose-600 text-muted-foreground hover:bg-rose-500/10 transition-colors"
                                      onConfirm={async () => {
                                        const contactId = selectedContact?.id;
                                        if (!contactId) return;
                                        await deleteCRMTask(task.id);
                                        loadTasks(contactId);
                                        toast.success('Task deleted');
                                      }}
                                    >
                                      Del
                                    </ConfirmAction>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Timeline & Notes — from crm_activities with note edit/delete and event history */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">Timeline & Notes</h4>
                          {activities.length > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setActivityFilter('all')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  activityFilter === 'all'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                All ({activities.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityFilter('notes')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  activityFilter === 'notes'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Notes ({notesCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityFilter('system')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  activityFilter === 'system'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                System ({systemCount})
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditingNoteTitle('');
                            setEditingNoteDesc('');
                            newNoteInputRef.current?.focus();
                            newNoteInputRef.current?.scrollIntoView?.({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                          className="text-xs font-bold text-primary dark:text-primary-on-dark hover:underline"
                          aria-label="Add new note"
                        >
                          <Plus size={10} className="inline mr-0.5" /> New Note
                        </button>
                      </div>
                      {activitiesLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : activities.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
                      ) : filteredActivities.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {activityFilter === 'notes'
                            ? 'No notes recorded yet.'
                            : activityFilter === 'system'
                              ? 'No system events recorded yet.'
                              : 'No activity recorded yet.'}
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-56 overflow-y-auto">
                          {filteredActivities.map((act) => {
                            const isNote = act.type === 'note';
                            return (
                              <div
                                key={act.id}
                                className="p-3 rounded-xl bg-surface-muted border border-border transition-colors hover:border-primary/20"
                              >
                                {editingNoteId === act.id ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={editingNoteTitle}
                                      onChange={(e) => setEditingNoteTitle(e.target.value)}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                                      placeholder="Note title"
                                    />
                                    <textarea
                                      value={editingNoteDesc}
                                      onChange={(e) => setEditingNoteDesc(e.target.value)}
                                      rows={2}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                                      placeholder="Note details"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                                        onClick={() => setEditingNoteId(null)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!editingNoteTitle.trim()}
                                        onClick={() => handleUpdateNote(act.id)}
                                        className="text-xs font-bold bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary-light disabled:opacity-50 transition-colors shadow-xs"
                                      >
                                        Save Note
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {!isNote && (
                                          <span className="shrink-0 p-1 rounded bg-background border border-border text-muted-foreground">
                                            {act.type.includes('email') ||
                                            act.type.includes('broadcast') ? (
                                              <Mail size={11} className="text-blue-400" />
                                            ) : (
                                              <Activity size={11} className="text-emerald-400" />
                                            )}
                                          </span>
                                        )}
                                        <span className="text-xs font-bold text-foreground truncate">
                                          {act.title ||
                                            (isNote ? '(no title)' : act.type.replace(/_/g, ' '))}
                                        </span>
                                        {!isNote && (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground shrink-0">
                                            {act.type.replace(/_/g, ' ')}
                                          </span>
                                        )}
                                      </div>
                                      {isNote && (
                                        <div className="flex gap-1 shrink-0">
                                          <button
                                            type="button"
                                            className="p-1 text-[11px] text-muted-foreground hover:text-primary rounded transition-colors"
                                            title="Edit note"
                                            aria-label="Edit note"
                                            onClick={() => {
                                              setEditingNoteId(act.id);
                                              setEditingNoteTitle(act.title || '');
                                              setEditingNoteDesc(act.description || '');
                                            }}
                                          >
                                            <PenLine size={12} />
                                          </button>
                                          <ConfirmAction
                                            label="Delete Note"
                                            message={`Delete note "${act.title}"?`}
                                            confirmLabel="Delete"
                                            danger
                                            idleClassName="p-1 text-[11px] text-muted-foreground hover:text-rose-600 rounded transition-colors"
                                            onConfirm={async () => {
                                              const contactId = selectedContact?.id;
                                              if (!contactId) return;
                                              await deleteCRMNote(act.id);
                                              loadActivities(contactId);
                                              toast.success('Note deleted');
                                            }}
                                          >
                                            <Trash2 size={12} />
                                          </ConfirmAction>
                                        </div>
                                      )}
                                    </div>
                                    {act.description && (
                                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                        {act.description}
                                      </p>
                                    )}
                                    {act.created_at && (
                                      <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                                        {new Date(act.created_at).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add form */}
                      <form
                        onSubmit={handleAddNote}
                        className="mt-3 p-3 rounded-xl bg-surface-muted border border-border space-y-2"
                      >
                        <input
                          ref={newNoteInputRef}
                          type="text"
                          value={newNoteTitle}
                          onChange={(e) => setNewNoteTitle(e.target.value)}
                          placeholder="Note title (e.g. Call summary)…"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                          required
                        />
                        <textarea
                          value={newNoteDesc}
                          onChange={(e) => setNewNoteDesc(e.target.value)}
                          placeholder="Details or action items (optional)…"
                          rows={2}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background resize-none focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isAddingNote || !newNoteTitle.trim()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light disabled:opacity-50 transition-colors shadow-xs"
                          >
                            {isAddingNote && <Loader2 size={12} className="animate-spin" />}
                            <span>Add Note</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <p className="text-center">Select a constituent to view details</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Editor Modal */}
      {editorModal}

      {/* Task Form Modal */}
      {taskFormModal}
    </>
  );
};

export default CRMPanel;
