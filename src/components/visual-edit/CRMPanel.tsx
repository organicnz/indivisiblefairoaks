'use client';

import {
  AlertCircle,
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
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  deleteCRMContact,
  deleteCRMNote,
  deleteCRMTask,
  exportCRMContacts,
  getCRMContactDetail,
  getCRMContacts,
  getCRMSegments,
  getCRMTasksForContact,
  saveCRMContact,
  setCRMEmailConsent,
  setCRMTaskStatus,
  updateCRMNote,
} from '@/lib/actions/crm';
import { consentLabel } from '@/lib/crm-filters';
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
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [segments, setSegments] = useState<CRMSegment[]>([]);
  const [showSegments, setShowSegments] = useState(false);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
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

  const PAGE_SIZE = 25;

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCRMContacts({
        query: searchQuery || undefined,
        consent: consentFilter === 'all' ? undefined : consentFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
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
  }, [searchQuery, page, consentFilter, statusFilter]);

  const handleExportCSV = async () => {
    if (totalCount === 0) {
      toast.error('No constituents to export');
      return;
    }
    setIsExporting(true);
    try {
      const res = await exportCRMContacts({
        query: searchQuery || undefined,
        consent: consentFilter === 'all' ? undefined : consentFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
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

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (isOpen) {
      loadSegments();
    }
  }, [isOpen, loadSegments]);

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
      const activities = (detail as { activities?: CRMActivity[] }).activities ?? [];
      setActivities(activities.filter((a: CRMActivity) => a.type === 'note').slice(0, 20));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

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
    if (selectedContact.tags.includes(tag)) {
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
      } else {
        toast.error(res.error ?? 'Failed to add tag');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedContact) return;
    const updatedTags = selectedContact.tags.filter((t) => t !== tagToRemove);
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
      } else {
        toast.error(res.error ?? 'Failed to remove tag');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove tag');
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
            <div className="w-96 flex flex-col border-r border-border bg-muted/30">
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
                    className="w-full pl-10 pr-8 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
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
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate"
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
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate"
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
              </div>

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
                      <button
                        key={contact.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left transition-colors ${
                          selectedContact?.id === contact.id
                            ? 'bg-primary/10'
                            : 'hover:bg-background/50'
                        }`}
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {contact.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[contact.status] || 'bg-muted text-muted-foreground'}`}
                            >
                              {contact.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
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
            <div className="flex-1 flex flex-col overflow-hidden">
              {showSegments ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-tight text-lg">Segments</h3>
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
                      {segments.map((segment) => (
                        <div
                          key={segment.id}
                          className="p-3 rounded-xl border border-border bg-background transition-colors hover:border-primary/30"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-foreground">{segment.name}</h4>
                            <span className="text-xs text-muted-foreground">
                              Filter:{' '}
                              {segment.query
                                ? segment.query.slice(0, 30) +
                                  (segment.query.length > 30 ? '…' : '')
                                : 'all'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedContact ? (
                <>
                  <div className="p-4 border-b border-border">
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
                          <Tag size={14} className="text-muted-foreground shrink-0" />
                          <span>District: {selectedContact.district}</span>
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
                              <span>{tag}</span>
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
                        <h4 className="font-bold text-sm">Follow-ups</h4>
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
                        ) : (
                          tasks.map((task) => {
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

                    {/* Notes — from crm_activities type === 'note', with edit/add/delete */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-sm">Notes</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditingNoteTitle('');
                            setEditingNoteDesc('');
                          }}
                          className="text-xs font-bold text-primary dark:text-primary-on-dark hover:underline"
                        >
                          <Plus size={10} className="inline mr-0.5" /> New
                        </button>
                      </div>
                      {activitiesLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : activities.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No notes yet.</p>
                      ) : (
                        <div className="space-y-3 max-h-56 overflow-y-auto">
                          {activities.map((act) => (
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
                                    <span className="text-xs font-bold text-foreground truncate">
                                      {act.title || '(no title)'}
                                    </span>
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
                          ))}
                        </div>
                      )}

                      {/* Add form */}
                      <form
                        onSubmit={handleAddNote}
                        className="mt-3 p-3 rounded-xl bg-surface-muted border border-border space-y-2"
                      >
                        <input
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
