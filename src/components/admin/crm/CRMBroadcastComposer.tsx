'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Loader2,
  Mail,
  Megaphone,
  Radio,
  Save,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  type BroadcastProgress,
  type CRMBroadcast,
  type CRMSegment,
  deleteCRMBroadcastDraft,
  getBroadcastProgress,
  getBroadcastRecipientCount,
  previewCRMBroadcast,
  saveCRMBroadcastDraft,
  sendCRMBroadcast,
} from '@/lib/actions/crm';
import { BROADCAST_RECIPIENT_CEILING } from '@/lib/crm-broadcast';

interface Props {
  initialBroadcasts: CRMBroadcast[];
  segments: CRMSegment[];
  existingTags: string[];
}

const AVAILABLE_STATUSES = [
  { id: 'active_volunteer', label: 'Active Volunteers' },
  { id: 'choir', label: 'Resistance Choir' },
  { id: 'donor', label: 'Donors' },
  { id: 'organizer', label: 'Organizers' },
  { id: 'supporter', label: 'Supporters' },
  { id: 'inactive', label: 'Inactive' },
];

const AVAILABLE_DISTRICTS = [
  { id: 'CA-06', label: 'CA-06 (Sacramento/Carmichael)' },
  { id: 'CA-03', label: 'CA-03 (Fair Oaks/Sierra)' },
  { id: 'CA-07', label: 'CA-07' },
];

// Fallback when the directory has no tags yet (fresh install / empty CRM).
const FALLBACK_TAGS = ['contact-form', 'registered-member', 'donor', 'organizer'];

export function CRMBroadcastComposer({ initialBroadcasts, segments, existingTags }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Content
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);

  // Audience size
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [calculatingCount, setCalculatingCount] = useState(false);

  // Sending status
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Expandable history rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Real tags from the directory, plus any currently selected (may be stale).
  const tagChips = [
    ...new Set([
      ...existingTags,
      ...FALLBACK_TAGS,
      ...selectedTags,
      ...(segments.flatMap((s) => s.tags) || []),
    ]),
  ].slice(0, 40);

  // Update recipient count when targeting changes
  useEffect(() => {
    let active = true;
    const fetchCount = async () => {
      setCalculatingCount(true);
      try {
        const count = await getBroadcastRecipientCount({
          targetStatus: selectedStatuses,
          targetDistricts: selectedDistricts,
          targetTags: selectedTags,
        });
        if (active) {
          setRecipientCount(count);
        }
      } catch {
        if (active) setRecipientCount(0);
      } finally {
        if (active) setCalculatingCount(false);
      }
    };

    fetchCount();
    return () => {
      active = false;
    };
  }, [selectedStatuses, selectedDistricts, selectedTags]);

  const toggleStatus = (id: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleDistrict = (id: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleTag = (t: string) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  /** Poll until the sender leaves an in-flight state. */
  const followProgress = async (broadcastId: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const current = await getBroadcastProgress(broadcastId);
      if (!current) return;
      setProgress(current);
      if (current.status !== 'queued' && current.status !== 'sending') {
        startTransition(() => router.refresh());
        return;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
  };

  /**
   * The preview is the message, not an illustration of it: rendered by the same
   * builder the sender uses and shown in a sandboxed iframe, so what the author
   * approves is what lands in the inbox. The previous hand-rolled "Sensory
   * Preview" omitted the logo, greeting, brand shell and unsubscribe footer and
   * rendered the body with different line breaking — an author approved a
   * document no recipient would ever receive.
   */
  useEffect(() => {
    if (!previewMode) {
      setPreviewHtml(null);
      return;
    }
    let active = true;
    const load = async () => {
      setPreviewLoading(true);
      try {
        const result = await previewCRMBroadcast({ subject, body });
        if (active) setPreviewHtml(result.html);
      } catch {
        if (active) setPreviewHtml(null);
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [body, previewMode, subject]);

  const handleSaveDraft = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Add a subject and message before saving a draft');
      return;
    }
    setSavingDraft(true);
    const res = await saveCRMBroadcastDraft({
      subject,
      body,
      targetStatus: selectedStatuses,
      targetDistricts: selectedDistricts,
      targetTags: selectedTags,
    });
    setSavingDraft(false);
    if (!res.success) {
      toast.error(res.error || 'Failed to save draft');
      return;
    }
    setDraftId(res.broadcastId ?? null);
    toast.success('Draft saved');
    startTransition(() => router.refresh());
  };

  const handleDiscardDraft = async () => {
    if (!draftId) return;
    const res = await deleteCRMBroadcastDraft(draftId);
    if (!res.success) {
      toast.error(res.error || 'Failed to delete draft');
      return;
    }
    setDraftId(null);
    toast.success('Draft discarded');
    startTransition(() => router.refresh());
  };

  const overCeiling = (recipientCount ?? 0) > BROADCAST_RECIPIENT_CEILING;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please provide both subject and message body');
      return;
    }

    if (!recipientCount || recipientCount === 0) {
      toast.error('Cannot dispatch to 0 recipients');
      return;
    }

    setIsSending(true);
    try {
      const res = await sendCRMBroadcast({
        subject,
        body,
        targetStatus: selectedStatuses,
        targetDistricts: selectedDistricts,
        targetTags: selectedTags,
      });

      if (res.success) {
        // Delivery continues in the background. Reporting "sent" here would be a
        // lie — the request only queued it — so say what happened and let the
        // progress readout below report the rest.
        toast.success(
          `Broadcast queued for ${res.recipientCount ?? 0} constituents. Delivery is running in the background.`
        );
        setSubject('');
        setBody('');
        setDraftId(null);
        setSelectedStatuses([]);
        setSelectedDistricts([]);
        setSelectedTags([]);
        setIsConfirmOpen(false);
        if (res.broadcastId) void followProgress(res.broadcastId);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(`Broadcast failed: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Broadcast error: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link
            href="/admin/crm"
            className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-primary uppercase tracking-widest transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Constituent Directory
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <Megaphone size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-secondary uppercase tracking-tight">
                Campaign Broadcasts
              </h1>
              <p className="text-xs font-bold text-slate-500">
                Segment and dispatch branded chapter email broadcasts via Resend.
              </p>
            </div>
          </div>
        </div>

        {/* Live Audience Badge */}
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-3 border border-slate-800 shadow-sm self-start sm:self-auto">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary-light">
            <Users size={16} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Matched Audience
            </div>
            <div className="text-lg font-black text-white">
              {calculatingCount ? (
                <span className="text-slate-400 text-sm">Calculating...</span>
              ) : (
                <span>{recipientCount ?? 0} constituents</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Targeting & Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Audience Targeting (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-primary" />
              <h2 className="text-xs font-black uppercase tracking-widest text-secondary">
                1. Audience Segmentation
              </h2>
            </div>

            {/* Saved segment prefill */}
            {segments.length > 0 && (
              <div>
                <label
                  htmlFor="segment-prefill"
                  className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2"
                >
                  Apply Saved Segment
                </label>
                <select
                  id="segment-prefill"
                  value=""
                  onChange={(e) => {
                    const seg = segments.find((s) => s.id === e.target.value);
                    if (!seg) return;
                    setSelectedStatuses(seg.statuses);
                    setSelectedDistricts(seg.districts);
                    setSelectedTags(seg.tags);
                    if (seg.query) toast.message(`Segment "${seg.name}" applied`);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
                >
                  <option value="">Choose a saved segment…</option>
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Engagement Statuses */}
            <div>
              <div className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                By Engagement Status (Leave empty for all)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_STATUSES.map((st) => {
                  const isSelected = selectedStatuses.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleStatus(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Districts */}
            <div>
              <div className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                By Congressional District (Leave empty for all)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_DISTRICTS.map((d) => {
                  const isSelected = selectedDistricts.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDistrict(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                By Interest Tags (Must match all selected)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tagChips.map((t) => {
                  const isSelected = selectedTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Summary */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-slate-700">Targeting Rules Applied:</div>
              <div>
                Status: {selectedStatuses.length > 0 ? selectedStatuses.join(', ') : 'All Statuses'}
              </div>
              <div>
                Districts:{' '}
                {selectedDistricts.length > 0 ? selectedDistricts.join(', ') : 'All Districts'}
              </div>
              <div>Tags: {selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Message Composer & Live Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                <h2 className="text-xs font-black uppercase tracking-widest text-secondary">
                  2. Message Content
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Eye size={14} />
                {previewMode ? 'Edit Draft' : 'Sensory Preview'}
              </button>
            </div>

            {!previewMode ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="broadcast-subject"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Subject Line
                  </label>
                  <input
                    id="broadcast-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Urgent Action: Stop H.R. 1 Rally at Carmichael Park"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm font-bold text-secondary placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="broadcast-body"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Message Body
                  </label>
                  <textarea
                    id="broadcast-body"
                    rows={10}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Dear Neighbor,&#10;&#10;Join us this Saturday at Carmichael Park as we rally for democracy...&#10;&#10;Here are the three ways to take immediate action..."
                    aria-describedby="broadcast-body-hint"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm text-slate-800 leading-relaxed font-sans placeholder:text-slate-400"
                  />
                  {/*
                    Stated plainly because the previous label promised "HTML/Markdown
                    Paragraphs supported": the server escapes the body and converts
                    newlines to line breaks, so markup typed here arrives in the
                    recipient's inbox as visible source text.
                  */}
                  <p id="broadcast-body-hint" className="mt-1.5 text-[11px] text-slate-500">
                    Plain text. Blank lines become paragraph breaks; anything that looks like markup
                    is sent as literal text.
                  </p>
                </div>
              </div>
            ) : null}

            {previewMode && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  Exactly what recipients receive, generated by the same code that sends it.
                </p>
                {previewLoading && !previewHtml ? (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                    Building preview…
                  </div>
                ) : previewHtml ? (
                  <iframe
                    title="Broadcast email preview"
                    // Sandboxed with neither allow-scripts nor allow-same-origin:
                    // this is remote HTML and must not reach the admin page's DOM,
                    // cookies or storage while it is being previewed.
                    sandbox=""
                    srcDoc={previewHtml}
                    className="h-[32rem] w-full rounded-2xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                    Add a subject and message to see the preview.
                  </div>
                )}
              </div>
            )}

            {/* Dispatch Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Will be delivered to{' '}
                <strong className="text-secondary">{recipientCount ?? 0}</strong> constituents.
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Opted-out contacts are excluded automatically. Every email includes a one-click
                  unsubscribe link.
                </span>
                {overCeiling && (
                  <span role="alert" className="mt-1 block font-bold text-accent-red">
                    This is over the {BROADCAST_RECIPIENT_CEILING.toLocaleString()}-recipient limit
                    for a single broadcast. Narrow the audience before sending.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {draftId ? (
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-600 hover:text-accent-red text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                  >
                    <Trash2 size={14} /> Discard draft
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || !subject.trim() || !body.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-700 hover:border-slate-300 disabled:opacity-50 text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                  >
                    {savingDraft ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save draft
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    !subject.trim() ||
                    !body.trim() ||
                    !recipientCount ||
                    recipientCount === 0 ||
                    overCeiling
                  }
                  onClick={() => setIsConfirmOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light disabled:bg-slate-200 disabled:text-slate-400 text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
                >
                  <Send size={14} /> Send Broadcast Now
                </button>
              </div>
            </div>

            {/*
              Live progress. The send no longer runs inside the request that
              started it, so without this the button would return and the admin
              would have no idea whether anything was going out.
            */}
            {progress && (progress.status === 'queued' || progress.status === 'sending') && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-blue-900">
                  Sending “{progress.subject}” — {progress.sentCount} of {progress.recipientCount}{' '}
                  accepted
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-200">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-sensory"
                    style={{
                      width: `${
                        progress.recipientCount > 0
                          ? Math.min(100, (progress.sentCount / progress.recipientCount) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                {progress.failedCount > 0 && (
                  <p className="mt-2 text-xs text-blue-800">
                    {progress.failedCount} rejected by the provider.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsConfirmOpen(false);
        }}
      >
        <DialogContent className="max-w-md p-6 sm:p-8">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <DialogTitle>Confirm Broadcast Dispatch</DialogTitle>
            <DialogDescription>
              You are about to send this email blast to{' '}
              <strong className="text-secondary">{recipientCount} constituents</strong> using
              Resend. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <div>
              <span className="font-bold text-slate-500">Subject:</span> {subject}
            </div>
            <div>
              <span className="font-bold text-slate-500">Sender:</span>{' '}
              contact@indivisiblefairoaks.org
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={isSending}
              onClick={() => setIsConfirmOpen(false)}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={handleSend}
              className="flex-1 px-4 py-2.5 bg-primary text-white hover:bg-primary-light disabled:bg-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Clock size={14} className="animate-spin" /> Dispatching...
                </>
              ) : (
                <>
                  <Send size={14} /> Confirm & Blast
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast History Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
            Past Campaigns & Dispatch History ({initialBroadcasts.length})
          </h2>
        </div>

        {initialBroadcasts.length === 0 ? (
          <div className="bg-slate-50 p-12 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No broadcast campaigns sent yet. Compose your first campaign above!
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-3">Campaign Subject</th>
                    <th className="px-6 py-3">Audience Filters</th>
                    <th className="px-6 py-3">Recipients</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Sent Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {initialBroadcasts.map((b) => {
                    const isExpanded = expandedId === b.id;
                    return (
                      <Fragment key={b.id}>
                        <tr
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : b.id)}
                        >
                          <td className="px-6 py-4 font-bold text-secondary max-w-xs">
                            <span className="flex items-center gap-2">
                              <button
                                type="button"
                                className="p-0.5 text-slate-400 hover:text-secondary shrink-0"
                                aria-label={isExpanded ? 'Collapse message' : 'Expand message'}
                                aria-expanded={isExpanded}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(isExpanded ? null : b.id);
                                }}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              <span className="truncate">{b.subject}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {b.target_status.length > 0 && `Status: ${b.target_status.join(', ')} `}
                            {b.target_districts.length > 0 &&
                              `Districts: ${b.target_districts.join(', ')} `}
                            {b.target_tags.length > 0 && `Tags: ${b.target_tags.join(', ')}`}
                            {b.target_status.length === 0 &&
                              b.target_districts.length === 0 &&
                              b.target_tags.length === 0 &&
                              'All Constituents'}
                          </td>
                          <td className="px-6 py-4 font-bold text-secondary">
                            {b.recipient_count}
                            {b.failed_count > 0 && (
                              <span className="ml-1.5 text-[10px] font-black text-red-600">
                                {b.failed_count} failed
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                b.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'sending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {b.status === 'sent' && <CheckCircle2 size={10} />}
                              {b.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {b.sent_at
                              ? new Date(b.sent_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : new Date(b.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={5} className="px-6 py-4">
                              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line max-w-3xl border-l-2 border-primary pl-4">
                                {b.body || '(no message body stored)'}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
