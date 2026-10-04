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

interface Props {
  initialContacts: CRMContact[];
  totalCount: number;
  currentQuery: string;
  currentStatus: string;
  currentDistrict: string;
  currentTag: string;
  currentConsent: 'all' | 'opted_out' | 'opted_in';
  currentPage: number;
  pageSize: number;
  existingTags: string[];
  segments: CRMSegment[];
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

function splitActiveTags(raw: string): string[] {
  if (!raw || raw === 'all') return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
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
  segments,
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
  const [consent, setConsent] = useState<'all' | 'opted_out' | 'opted_in'>(currentConsent || 'all');

  // Tags to offer in the filter: schema-known tags plus whatever is active now.
  const tagOptions = [...new Set([...existingTags, ...splitActiveTags(currentTag)])].sort((a, b) =>
    a.localeCompare(b)
  );

  const currentFilters = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (status && status !== 'all') params.set('status', status);
    if (district && district !== 'all') params.set('district', district);
    if (tag && tag !== 'all') params.set('tag', tag);
    if (consent && consent !== 'all') params.set('consent', consent);
    return params;
  };

  // The pager must continue the result set the user is actually looking at, which is
  // the one the server ran — not the uncommitted form state. Paging off currentFilters()
  // silently jumped to a different set whenever a filter was typed but not yet applied.
  const appliedFilters = () => {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentDistrict && currentDistrict !== 'all') params.set('district', currentDistrict);
    if (currentTag && currentTag !== 'all') params.set('tag', currentTag);
    if (currentConsent && currentConsent !== 'all') params.set('consent', currentConsent);
    return params;
  };

  const handleFilterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = currentFilters();
    startTransition(() => {
      router.push(`/admin/crm?${params.toString()}`);
    });
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
      const res = await exportCRMContacts({
        query: currentQuery,
        status: currentStatus,
        district: currentDistrict,
        tag: currentTag,
      });
      if (res.error || !res.csv) {
        toast.error(res.error || 'Export failed');
        return;
      }
      downloadCsv(
        res.csv,
        `indivisible-crm-constituents-${new Date().toISOString().split('T')[0]}.csv`
      );
      toast.success(`Exported ${res.count} constituents to CSV`);
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
      const res = await saveCRMSegment({
        name,
        query: query.trim(),
        statuses: splitActiveTags(status),
        districts: splitActiveTags(district),
        tags: splitActiveTags(tag),
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
    const params = new URLSearchParams();
    if (segment.query) params.set('q', segment.query);
    if (segment.statuses.length) params.set('status', segment.statuses.join(','));
    if (segment.districts.length) params.set('district', segment.districts.join(','));
    if (segment.tags.length) params.set('tag', segment.tags.join(','));
    setQuery(segment.query);
    setStatus(segment.statuses.join(',') || 'all');
    setDistrict(segment.districts.join(',') || 'all');
    setTag(segment.tags.join(',') || 'all');
    startTransition(() => {
      router.push(`/admin/crm?${params.toString()}`);
    });
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

  const hasActiveFilters = Boolean(
    (query.trim() && query.trim() !== currentQuery) ||
      (status !== 'all' && status !== currentStatus) ||
      (district !== 'all' && district !== currentDistrict) ||
      (tag !== 'all' && tag !== currentTag) ||
      currentQuery ||
      (currentStatus && currentStatus !== 'all') ||
      (currentDistrict && currentDistrict !== 'all') ||
      (currentTag && currentTag !== 'all')
  );

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
          </div>

          {/* Consent Filter */}
          <div>
            <select
              value={consent}
              onChange={(e) => setConsent(e.target.value as 'all' | 'opted_out' | 'opted_in')}
              aria-label="Filter by email consent"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
            >
              <option value="all">All Consent States</option>
              <option value="opted_out">Opted Out of Email</option>
              <option value="opted_in">Email Allowed</option>
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
                setQuery('');
                setStatus('all');
                setDistrict('all');
                setTag('all');
                setConsent('all');
                router.push('/admin/crm');
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
                  setStatus(pill.s);
                  setDistrict(pill.d);
                  const params = new URLSearchParams();
                  if (query.trim()) params.set('q', query.trim());
                  if (pill.s !== 'all') params.set('status', pill.s);
                  if (pill.d !== 'all') params.set('district', pill.d);
                  if (tag !== 'all') params.set('tag', tag);
                  startTransition(() => {
                    router.push(`/admin/crm?${params.toString()}`);
                  });
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

        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="text-slate-500 font-bold">
            Showing <span className="text-secondary font-black">{initialContacts.length}</span> of{' '}
            <span className="text-secondary font-black">{totalCount}</span> constituents
            {currentPage > 1 && <span className="text-slate-400"> · page {currentPage}</span>}
          </div>

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <th className="py-3.5 px-4">Constituent</th>
                <th className="py-3.5 px-4">District / City</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Tags & Roles</th>
                <th className="py-3.5 px-4">Contributions</th>
                <th className="py-3.5 px-4">Last Active</th>
                <th className="py-3.5 px-4 text-right">Action</th>
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
                          {contact.do_not_email && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-black uppercase leading-none"
                              title="Do not email — excluded from broadcasts"
                            >
                              opt-out
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
                            title="Edit Contact"
                          >
                            <Edit2 size={13} />
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
        </div>

        <div className="px-6 pb-6">
          <CRMPager
            page={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            basePath="/admin/crm"
            params={appliedFilters()}
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
