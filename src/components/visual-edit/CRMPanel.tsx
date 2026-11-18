'use client';

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  PenLine,
  Tag,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CivicEventManager } from '@/components/admin/civic/CivicEventManager';
import { CivicLinkManager } from '@/components/admin/civic/CivicLinkManager';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMPanelContactFilters } from '@/components/visual-edit/CRMPanelContactFilters';
import { CRMPanelContactOverview } from '@/components/visual-edit/CRMPanelContactOverview';
import { CRMPanelContactTasks } from '@/components/visual-edit/CRMPanelContactTasks';
import { CRMPanelContactTimeline } from '@/components/visual-edit/CRMPanelContactTimeline';
import { CRMPanelHeader } from '@/components/visual-edit/CRMPanelHeader';
import { CONSENT_COLORS, STATUS_COLORS } from '@/components/visual-edit/crm-panel-styles';
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
  exportCRMContacts,
  getCRMContactDetail,
  getCRMContacts,
  getCRMExistingTags,
  getCRMSegments,
  getCRMTasksForContact,
  saveCRMContact,
  setCRMEmailConsent,
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
  initialTab?: 'constituents' | 'events' | 'news' | 'links';
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


export const CRMPanel: React.FC<CRMPanelProps> = ({
  isOpen,
  onClose,
  initialTab = 'constituents',
}) => {
  const [activeTab, setActiveTab] = useState<'constituents' | 'events' | 'news' | 'links'>(
    initialTab
  );

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
        if (res.warning) toast.warning(res.warning);
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
        if (res.warning) toast.warning(res.warning);
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
        if (res.warning) toast.warning(res.warning);
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
        if (res.warning) toast.warning(res.warning);
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
          res.updatedCount === undefined
            ? 'Updated the selected constituents'
            : `Updated status for ${res.updatedCount} constituents`
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
          res.updatedCount === undefined
            ? 'Updated consent for the selected constituents'
            : `Updated consent for ${res.updatedCount} constituents`
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
          res.updatedCount === undefined
            ? `Added tag #${tag} to the selected constituents`
            : `Added tag #${tag} to ${res.updatedCount} constituents`
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
          res.updatedCount === undefined
            ? `Assigned district ${district} to the selected constituents`
            : `Assigned district ${district} to ${res.updatedCount} constituents`
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
        toast.success(
          res.deletedCount === undefined
            ? 'Deleted the selected constituents'
            : `Deleted ${res.deletedCount} constituents`
        );
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
            <DialogTitle>Add Follow-up</DialogTitle>
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
        <DialogContent className="max-w-4xl max-h-[85vh] bg-surface-card text-foreground p-0 overscroll-contain">
          <DialogHeader className="p-4 border-b border-border bg-surface-muted/30">
            <CRMPanelHeader
              activeTab={activeTab}
              onTabChange={setActiveTab}
              showSegments={showSegments}
              onToggleSegments={() => setShowSegments(!showSegments)}
              onExportCsv={() => void handleExportCSV()}
              isExporting={isExporting}
              totalCount={totalCount}
              onAddContact={() => {
                setSelectedContact(null);
                setIsEditorOpen(true);
              }}
              onClose={onClose}
            />
          </DialogHeader>

          {activeTab === 'events' ? (
            <div className="p-5 h-[calc(85vh-80px)] overflow-hidden">
              <CivicEventManager />
            </div>
          ) : activeTab === 'news' ? (
            <div className="p-5 h-[calc(85vh-80px)] overflow-hidden">
              <CivicNewsletterManager newsLinkTarget="_blank" />
            </div>
          ) : activeTab === 'links' ? (
            <div className="p-5 h-[calc(85vh-80px)] overflow-hidden">
              <CivicLinkManager />
            </div>
          ) : (
            <div className="flex h-[calc(85vh-80px)] overflow-hidden">
              {/* Contact List */}
              <div
                className={`w-full md:w-96 flex flex-col border-r border-border bg-muted/30 shrink-0 ${
                  selectedContact || showSegments ? 'hidden md:flex' : 'flex'
                }`}
              >
                {/* Search & Filters */}
                <CRMPanelContactFilters
                  searchInputRef={searchInputRef}
                  searchQuery={searchQuery}
                  onSearchChange={(value) => {
                    setSearchQuery(value);
                    setPage(1);
                  }}
                  consentFilter={consentFilter}
                  onConsentChange={(value) => {
                    setConsentFilter(value);
                    setPage(1);
                  }}
                  statusFilter={statusFilter}
                  onStatusChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  selectedTag={selectedTag}
                  onTagChange={(value) => {
                    setSelectedTag(value);
                    setPage(1);
                  }}
                  districtFilter={districtFilter}
                  onDistrictChange={(value) => {
                    setDistrictFilter(value);
                    setPage(1);
                  }}
                  availableTags={availableTags}
                  appliedSegment={appliedSegment}
                  hasActiveFilters={hasActiveFilters}
                  onClearSegment={handleClearSegment}
                  onResetFilters={handleResetFilters}
                />

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
                      {isBulkUpdating && (
                        <Loader2 size={12} className="animate-spin text-primary" />
                      )}
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
                <div className="flex-1 overflow-y-auto overscroll-contain">
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
                                    STATUS_COLORS[contact.status] ||
                                    'bg-muted text-muted-foreground'
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
                  <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
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
                              className={`w-full text-left p-3 rounded-xl border transition-[border-color,background-color] duration-150 ${
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

                    <CRMPanelContactOverview
                      selectedContact={selectedContact}
                      copiedField={copiedField}
                      handleCopy={handleCopy}
                      setSelectedContact={setSelectedContact}
                      setDistrictFilter={setDistrictFilter}
                      setSelectedTag={setSelectedTag}
                      setPage={setPage}
                      consentOptions={consentOptions}
                      handleSetConsent={(id, consent) => void handleSetConsent(id, consent)}
                      loading={loading}
                      isAddingTag={isAddingTag}
                      setIsAddingTag={setIsAddingTag}
                      newTagInput={newTagInput}
                      setNewTagInput={setNewTagInput}
                      handleAddTag={(tag) => void handleAddTag(tag)}
                      handleRemoveTag={(tag) => void handleRemoveTag(tag)}
                    >
                      <CRMPanelContactTasks
                        contactId={selectedContact?.id ?? null}
                        tasks={tasks}
                        tasksLoading={tasksLoading}
                        taskFilter={taskFilter}
                        setTaskFilter={setTaskFilter}
                        filteredTasks={filteredTasks}
                        setIsTaskFormOpen={setIsTaskFormOpen}
                        loadTasks={loadTasks}
                      />

                      <CRMPanelContactTimeline
                        selectedContact={selectedContact}
                        activities={activities}
                        activitiesLoading={activitiesLoading}
                        activityFilter={activityFilter}
                        setActivityFilter={setActivityFilter}
                        filteredActivities={filteredActivities}
                        notesCount={notesCount}
                        systemCount={systemCount}
                        editingNoteId={editingNoteId}
                        setEditingNoteId={setEditingNoteId}
                        editingNoteTitle={editingNoteTitle}
                        setEditingNoteTitle={setEditingNoteTitle}
                        editingNoteDesc={editingNoteDesc}
                        setEditingNoteDesc={setEditingNoteDesc}
                        handleUpdateNote={(id) => void handleUpdateNote(id)}
                        newNoteTitle={newNoteTitle}
                        setNewNoteTitle={setNewNoteTitle}
                        newNoteDesc={newNoteDesc}
                        setNewNoteDesc={setNewNoteDesc}
                        isAddingNote={isAddingNote}
                        handleAddNote={(e) => void handleAddNote(e)}
                        newNoteInputRef={newNoteInputRef}
                        loadActivities={loadActivities}
                      />

                    </CRMPanelContactOverview>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p className="text-center">Select a constituent to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
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
