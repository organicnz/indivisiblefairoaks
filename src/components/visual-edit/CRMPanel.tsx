'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CivicEventManager } from '@/components/admin/civic/CivicEventManager';
import { CivicLinkManager } from '@/components/admin/civic/CivicLinkManager';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import { BulkUpdatePreflightDialog } from '@/components/admin/crm/BulkUpdatePreflightDialog';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMTaskForm } from '@/components/admin/crm/CRMTaskForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { CRMPanelContactHeader } from '@/components/visual-edit/CRMPanelContactHeader';
import {
  CRM_CONTACT_PAGE_SIZE,
  CRMPanelContactList,
} from '@/components/visual-edit/CRMPanelContactList';
import { CRMPanelContactOverview } from '@/components/visual-edit/CRMPanelContactOverview';
import { CRMPanelContactTasks } from '@/components/visual-edit/CRMPanelContactTasks';
import { CRMPanelContactTimeline } from '@/components/visual-edit/CRMPanelContactTimeline';
import { CRMPanelHeader } from '@/components/visual-edit/CRMPanelHeader';
import { useBulkUpdatePreflight } from '@/hooks/useBulkUpdatePreflight';
import { useClearSelectionOnKeyChange } from '@/hooks/useClearSelectionOnKeyChange';
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
import { CRM_CONTACT_CONSENT_OPTIONS, crmContactDoNotEmail } from '@/lib/crm-contact-options';
import { filtersFromSegment, splitActiveValues } from '@/lib/crm-filters';
import type {
  ConsentDecision,
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
  const bulkPreflight = useBulkUpdatePreflight();
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

  // The read args identify the visible set; page is added only by loadContacts.
  const contactFilterKey = JSON.stringify(contactQueryArgs());
  useClearSelectionOnKeyChange(contactFilterKey, setSelectedContactIds);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCRMContacts({
        ...contactQueryArgs(),
        page,
        pageSize: CRM_CONTACT_PAGE_SIZE,
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
      if (res.warning) toast.warning(res.warning);
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
        if (res.warning) toast.warning(res.warning);
        loadContacts();
        if (selectedContact?.id === id) setSelectedContact(null);
      } else {
        toast.error(res.error ?? 'Failed to delete contact');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleSetConsent = async (id: string, consent: ConsentDecision) => {
    try {
      const res = await setCRMEmailConsent({ contactId: id, doNotEmail: consent });
      if (res.success) {
        toast.success('Consent updated');
        if (res.warning) toast.warning(res.warning);
        if (selectedContact && selectedContact.id === id) {
          const nextDoNotEmail = crmContactDoNotEmail(consent);
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

  const handleBulkStatus = async (
    status: CRMContactStatus,
    contactIds: string[] = Array.from(selectedContactIds)
  ) => {
    if (contactIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds,
        status,
      });
      if (res.success) {
        toast.success(
          res.updatedCount === undefined
            ? 'Updated the selected constituents'
            : `Updated status for ${res.updatedCount} constituents`
        );
        if (res.warning) toast.warning(res.warning);
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

  const handleBulkConsent = async (
    consent: ConsentDecision,
    contactIds: string[] = Array.from(selectedContactIds)
  ) => {
    if (contactIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds,
        consent,
      });
      if (res.success) {
        toast.success(
          res.updatedCount === undefined
            ? 'Updated consent for the selected constituents'
            : `Updated consent for ${res.updatedCount} constituents`
        );
        if (res.warning) toast.warning(res.warning);
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

  const handleBulkAddTag = async (
    tagInput: string = bulkTagInput,
    contactIds: string[] = Array.from(selectedContactIds)
  ) => {
    const tag = tagInput.trim().toLowerCase();
    if (contactIds.length === 0 || !tag) return;
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds,
        addTags: [tag],
      });
      if (res.success) {
        toast.success(
          res.updatedCount === undefined
            ? `Added tag #${tag} to the selected constituents`
            : `Added tag #${tag} to ${res.updatedCount} constituents`
        );
        if (res.warning) toast.warning(res.warning);
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

  const handleBulkDistrict = async (
    districtInput: string = bulkDistrictInput,
    contactIds: string[] = Array.from(selectedContactIds)
  ) => {
    const district = districtInput.trim().toUpperCase();
    if (contactIds.length === 0 || !district) return;
    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateCRMContacts({
        contactIds,
        district,
      });
      if (res.success) {
        toast.success(
          res.updatedCount === undefined
            ? `Assigned district ${district} to the selected constituents`
            : `Assigned district ${district} to ${res.updatedCount} constituents`
        );
        if (res.warning) toast.warning(res.warning);
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

  const beginBulkStatus = (status: CRMContactStatus) => {
    void bulkPreflight.begin({
      contactIds: Array.from(selectedContactIds),
      field: 'status',
      value: status,
    });
  };

  const beginBulkConsent = (consent: ConsentDecision) => {
    void bulkPreflight.begin({
      contactIds: Array.from(selectedContactIds),
      field: 'consent',
      value: consent,
    });
  };

  const beginBulkTag = () => {
    const tag = bulkTagInput.trim().toLowerCase();
    if (!tag) return;
    void bulkPreflight.begin({
      contactIds: Array.from(selectedContactIds),
      field: 'tags',
      value: tag,
    });
  };

  const beginBulkDistrict = () => {
    const district = bulkDistrictInput.trim().toUpperCase();
    if (!district) return;
    void bulkPreflight.begin({
      contactIds: Array.from(selectedContactIds),
      field: 'district',
      value: district,
    });
  };

  const confirmBulkPreflight = () => {
    const plan = bulkPreflight.plan;
    if (!plan) return;
    bulkPreflight.close();
    if (plan.field === 'status') {
      void handleBulkStatus(plan.value as CRMContactStatus, plan.contactIds);
    } else if (plan.field === 'consent') {
      void handleBulkConsent(plan.value as ConsentDecision, plan.contactIds);
    } else if (plan.field === 'tags') {
      void handleBulkAddTag(plan.value, plan.contactIds);
    } else {
      void handleBulkDistrict(plan.value, plan.contactIds);
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
        if (res.warning) toast.warning(res.warning);
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
              <CRMPanelContactList
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
                contacts={contacts}
                selectedContact={selectedContact}
                onSelectContact={(contact) => setSelectedContact(contact)}
                showSegments={showSegments}
                loading={loading}
                totalCount={totalCount}
                page={page}
                onPageChange={(next) => setPage(next)}
                selectedContactIds={selectedContactIds}
                onSelectedContactIdsChange={setSelectedContactIds}
                isBulkUpdating={isBulkUpdating || bulkPreflight.loading}
                bulkTagInput={bulkTagInput}
                onBulkTagInputChange={(value) => setBulkTagInput(value)}
                bulkDistrictInput={bulkDistrictInput}
                onBulkDistrictInputChange={(value) => setBulkDistrictInput(value)}
                onBulkStatus={beginBulkStatus}
                onBulkConsent={beginBulkConsent}
                onBulkAddTag={beginBulkTag}
                onBulkDistrict={beginBulkDistrict}
                onBulkDelete={() => void handleBulkDelete()}
              />

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
                    <CRMPanelContactHeader
                      selectedContact={selectedContact}
                      copiedField={copiedField}
                      onCopy={handleCopy}
                      onBack={() => setSelectedContact(null)}
                      onSetStatus={(status) => void handleSetStatus(status)}
                      onEdit={() => setIsEditorOpen(true)}
                      onDelete={(id) => void handleDeleteContact(id)}
                    />

                    <CRMPanelContactOverview
                      selectedContact={selectedContact}
                      copiedField={copiedField}
                      handleCopy={handleCopy}
                      setSelectedContact={setSelectedContact}
                      setDistrictFilter={setDistrictFilter}
                      setSelectedTag={setSelectedTag}
                      setPage={setPage}
                      consentOptions={CRM_CONTACT_CONSENT_OPTIONS}
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

      <BulkUpdatePreflightDialog
        open={bulkPreflight.plan !== null}
        preview={bulkPreflight.preview}
        loading={bulkPreflight.loading}
        error={bulkPreflight.error}
        busy={isBulkUpdating}
        onCancel={bulkPreflight.close}
        onConfirm={confirmBulkPreflight}
      />

      {/* Contact Editor Modal */}
      {editorModal}

      {/* Task Form Modal */}
      {taskFormModal}
    </>
  );
};

export default CRMPanel;
