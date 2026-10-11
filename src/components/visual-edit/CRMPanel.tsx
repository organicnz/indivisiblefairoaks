'use client';

import { Loader2, Mail, MapPin, Phone, Plus, Search, Tag, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
  deleteCRMContact,
  getCRMContacts,
  getCRMContactDetail,
  getCRMSegments,
  getCRMTasksForContact,
  setCRMEmailConsent,
  addCRMNote,
  updateCRMNote,
  deleteCRMNote,
  setCRMTaskStatus,
  deleteCRMTask,
} from '@/lib/actions/crm';
import type { CRMContact, CRMSegment, CRMTask } from '@/types/crm';
import type { CRMActivity } from '@/types/crm';

interface CRMPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

import { consentLabel, ConsentFilter, splitActiveValues } from '@/lib/crm-filters';

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
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [segments, setSegments] = useState<CRMSegment[]>([]);
  const [showSegments, setShowSegments] = useState(false);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');
  const [editingNoteDesc, setEditingNoteDesc] = useState('');

  const PAGE_SIZE = 25;

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCRMContacts({
        query: searchQuery || undefined,
        consent: consentFilter === 'all' ? undefined : consentFilter,
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
  }, [searchQuery, page, consentFilter]);

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
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Segments
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContact(null);
                    setIsEditorOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors"
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search constituents…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
                <select
                  value={consentFilter}
                  onChange={(e) => {
                    setConsentFilter(
                      e.target.value as 'all' | 'opted_in' | 'opted_out' | 'unasked'
                    );
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All consent states</option>
                  <option value="opted_in">Opted in</option>
                  <option value="opted_out">Opted out</option>
                  <option value="unasked">Never asked</option>
                </select>
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
                  <h3 className="font-black uppercase tracking-tight text-lg">Segments</h3>
                  {segments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No segments yet. Create segments in the admin CRM.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {segments.map((segment) => (
                        <div
                          key={segment.id}
                          className="p-3 rounded-lg border border-border bg-background"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">{segment.name}</h4>
                            <span className="text-xs text-muted-foreground">
                              Filter:{' '}
                              {segment.query
                                ? segment.query.slice(0, 30) +
                                  (segment.query.length > 30 ? '…' : '')
                                : 'all'}
                            </span>
                          </div>
                          {}
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
                        <h3 className="font-black uppercase tracking-tight text-lg">
                          {selectedContact.first_name} {selectedContact.last_name}
                        </h3>
                        <p className="text-muted-foreground text-sm">{selectedContact.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[selectedContact.status] || 'bg-muted text-muted-foreground'}`}
                          >
                            {selectedContact.status.replace('_', ' ')}
                          </span>
                          {consentOptions.map((opt) => {
                            const currentConsent = consentLabel(
                              selectedContact.do_not_email
                            );
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
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors"
                        >
                          <Plus size={12} className="mr-1" /> Edit
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
                          <Phone size={14} className="text-muted-foreground" />
                          <span>{selectedContact.phone}</span>
                        </div>
                      )}
                      {selectedContact.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin size={14} className="text-muted-foreground" />
                          <span>
                            {selectedContact.address}, {selectedContact.city}{' '}
                            {selectedContact.zip_code}
                          </span>
                        </div>
                      )}
                      {selectedContact.district && (
                        <div className="flex items-center gap-2 text-sm">
                          <Tag size={14} className="text-muted-foreground" />
                          <span>District: {selectedContact.district}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={14} className="text-muted-foreground" />
                        <span>Source: {selectedContact.source}</span>
                      </div>
                      {selectedContact.total_donated_cents &&
                        selectedContact.total_donated_cents > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Tag size={14} className="text-muted-foreground" />
                            <span>
                              Donated: ${(selectedContact.total_donated_cents / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                      {selectedContact.tags.length > 0 && (
                        <div className="sm:col-span-2 flex flex-wrap gap-1">
                          {selectedContact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Consent Control */}
                    <div className="border-t border-border pt-4">
                      <h4 className="font-bold text-sm mb-2">Email Consent</h4>
                      <div className="flex flex-wrap gap-2">
                        {consentOptions.map((opt) => {
                          const currentConsent = consentLabel(
                            selectedContact.do_not_email
                          );
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
                          className="px-2 py-1 text-xs font-bold rounded bg-primary text-white hover:bg-primary-light"
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
                          tasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2 rounded-lg border border-border bg-background"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium truncate">{task.title}</p>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
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
                              <div className="flex items-center gap-1 mt-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await setCRMTaskStatus({ id: task.id, status: task.status === 'done' ? 'open' : 'done' });
                                    loadTasks(selectedContact!.id);
                                  }}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted hover:bg-muted text-muted-foreground"
                                  aria-label={task.status === 'done' ? 'Reopen' : 'Complete'}
                                >
                                  {task.status === 'done' ? 'Reopen' : 'Done'}
                                </button>
                                <ConfirmAction
                                  label="Delete task"
                                  message={`Delete "${task.title}"?`}
                                  confirmLabel="Delete"
                                  danger
                                  idleClassName="text-[10px] font-bold px-1.5 py-0.5 rounded hover:text-rose-600 text-muted-foreground"
                                  onConfirm={async () => {
                                    await deleteCRMTask(task.id);
                                    loadTasks(selectedContact!.id);
                                    toast.success('Task deleted');
                                  }}
                                >
                                  Del
                                </ConfirmAction>
                              </div>
                              {task.due_at && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Due: {new Date(task.due_at ?? '').toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {selectedContact.tags.length > 0 && (
                      <div className="border-t border-border pt-4">
                        <h4 className="font-bold text-sm mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedContact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

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
                            <div key={act.id} className="p-3 rounded-lg bg-surface-muted border border-border">
                              {editingNoteId === act.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingNoteTitle}
                                    onChange={(e) => setEditingNoteTitle(e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-border text-xs font-bold"
                                    placeholder="Note title"
                                  />
                                  <textarea
                                    value={editingNoteDesc}
                                    onChange={(e) => setEditingNoteDesc(e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1 rounded border border-border text-xs text-muted-foreground"
                                    placeholder="Note details"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingNoteId(null)}>
                                      Cancel
                                    </button>
                                    <ConfirmAction
                                      label="Save Note"
                                      message="Save changes to this note?"
                                      confirmLabel="Save"
                                      idleClassName="text-xs font-bold bg-primary text-white px-2 py-1 rounded hover:bg-primary-light"
                                      onConfirm={async () => {
                                        if (!selectedContact || !editingNoteTitle.trim()) return;
                                        await updateCRMNote({ activityId: act.id, title: editingNoteTitle.trim(), description: editingNoteDesc.trim() || '' });
                                        setEditingNoteId(null);
                                        setEditingNoteTitle('');
                                        setEditingNoteDesc('');
                                        loadActivities(selectedContact.id);
                                        toast.success('Note updated');
                                      }}
                                    >
                                      Save
                                    </ConfirmAction>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground">{act.title || '(no title)'}</span>
                                    <div className="flex gap-1">
                                      <button type="button" className="p-0.5 text-[10px] text-muted-foreground hover:text-primary" title="Edit" onClick={() => { setEditingNoteId(act.id); setEditingNoteTitle(act.title || ''); setEditingNoteDesc(act.description || ''); }}>
                                        ✎
                                      </button>
                                      <ConfirmAction
                                        label="Delete Note"
                                        message={`Delete note "${act.title}"?`}
                                        confirmLabel="Delete"
                                        danger
                                        idleClassName="text-[10px] text-muted-foreground hover:text-rose-600"
                                        onConfirm={async () => {
                                          await deleteCRMNote(act.id);
                                          loadActivities(selectedContact!.id);
                                          toast.success('Note deleted');
                                        }}
                                      >
                                        🗑
                                      </ConfirmAction>
                                    </div>
                                  </div>
                                  {act.description && <p className="text-[11px] text-muted-foreground mt-1">{act.description}</p>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Add form */}
                      <form
                        className="mt-2 flex gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const titleEl = (e.target as HTMLFormElement).querySelector('input[name="title"]') as HTMLInputElement;
                          const descEl = (e.target as HTMLFormElement).querySelector('textarea[name="desc"]') as HTMLTextAreaElement;
                          if (!selectedContact || !titleEl?.value.trim()) return;
                          await addCRMNote({ contactId: selectedContact.id, title: titleEl.value.trim(), description: (descEl?.value.trim() || '') as string });
                          titleEl.value = '';
                          if (descEl) descEl.value = '';
                          loadActivities(selectedContact.id);
                          toast.success('Note added');
                        }}
                      >
                        <input name="title" placeholder="Title…" className="flex-1 px-2 py-1 text-xs rounded border border-border" required />
                        <textarea name="desc" placeholder="Details (optional)" rows={1} className="w-full mt-1 px-2 py-1 text-xs rounded border border-border resize-none" />
                        <button type="submit" className="self-end text-xs font-bold px-2 py-1 bg-primary text-white rounded hover:bg-primary-light">Add</button>
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
