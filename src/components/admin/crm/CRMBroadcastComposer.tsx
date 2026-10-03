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
  SendHorizonal,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
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
  sendCRMBroadcastSelfTest,
} from '@/lib/actions/crm';
import { BROADCAST_RECIPIENT_CEILING } from '@/lib/crm-broadcast';

interface Props {
  initialBroadcasts: CRMBroadcast[];
  /** Unsent work in progress. Kept out of `initialBroadcasts` on purpose. */
  initialDrafts?: CRMBroadcast[];
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

export function CRMBroadcastComposer({
  initialBroadcasts,
  initialDrafts = [],
  segments,
  existingTags,
}: Props) {
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
  const [drafts, setDrafts] = useState<CRMBroadcast[]>(initialDrafts);
  const [savingDraft, setSavingDraft] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);

  // Audience size
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [calculatingCount, setCalculatingCount] = useState(false);

  // Sending status
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSelfTesting, setIsSelfTesting] = useState(false);

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

  // Update recipient count when targeting changes.
  //
  // Debounced. `getBroadcastRecipientCount` is an uncapped `count: 'exact'` over
  // `crm_contacts`, so it ran on every single chip click — four tags tapped in a
  // row meant four full counts inside half a second. The number is a display
  // affordance; a slightly stale one for 300ms is invisible, and the action
  // re-resolves the audience and re-checks the ceiling on send, so nothing
  // downstream depends on this being exact at any instant.
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

    const timer = setTimeout(fetchCount, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedStatuses, selectedDistricts, selectedTags]);

  // A campaign that is mid-send when this page loads still deserves a progress
  // readout. Progress lived in a callback reached only from the send action, so a
  // reload between "queued" and "sent" stranded the row reading `sending`
  // forever — with the only progress number sitting unused on the row itself.
  useEffect(() => {
    const inFlight = initialBroadcasts.find(
      (b) => !b.test_only && (b.status === 'queued' || b.status === 'sending')
    );
    if (inFlight) void followProgress(inFlight.id);
    // One-shot: the in-tab follow loop owns the row once it starts, and the row
    // itself cannot change underneath this tab to a state that needs a second
    // loop.
  }, [initialBroadcasts]);

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

  /**
   * Poll until the sender leaves an in-flight state.
   *
   * The give-up is now visible. It used to return silently after 180 seconds,
   * never calling `router.refresh()`, so a large campaign — the sender moves ten
   * recipients per round-trip, and 5,000 is five hundred rounds — outlived the
   * poll and left the row in this tab reading `sending` forever, with no
   * indication that anything was still happening or that the page needed a
   * refresh. An admin who saw that had no way to tell a slow send from a stuck
   * one, and the recovery procedure for a stuck send is in the docs.
   *
   * So: say so, refresh what is known, and keep the number of attempts
   * proportional to the ceiling rather than a fixed 90.
   */
  const followProgress = async (broadcastId: string) => {
    // The sender batches ten at a time, so the worst case is the full ceiling
    // plus slack for the audience query and the final status write.
    const maxAttempts = Math.ceil(BROADCAST_RECIPIENT_CEILING / 10) + 30;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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

    // Still in flight after roughly half an hour. Not an error — the send may
    // well be fine — but the operator needs to know this tab has stopped
    // watching, because the row they are looking at is not the row in the
    // database.
    setProgress((current) => (current ? { ...current, stillWatching: false } : current));
    startTransition(() => router.refresh());
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

  /**
   * Send this exact message to the signed-in admin and nobody else.
   *
   * The address is never collected. That is the whole point: a self-test that
   * asked for a recipient would be a send button with a narrow default, and
   * the failure mode of getting it wrong lands in strangers' inboxes. So the
   * server decides, from the session, and the button cannot be pointed.
   */
  const handleSelfTest = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Add a subject and message before sending a test');
      return;
    }
    if (isSelfTesting) return;
    setIsSelfTesting(true);
    try {
      const res = await sendCRMBroadcastSelfTest({ subject, body });
      if (res.success) {
        toast.success(`Test sent to ${res.recipient}. Nobody else received it.`, {
          duration: 6000,
        });
      } else {
        toast.error(res.error || 'Test could not be sent');
      }
    } catch {
      toast.error('Test could not be sent');
    } finally {
      setIsSelfTesting(false);
    }
  };

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

  /**
   * Load a saved draft back into the composer.
   *
   * The composer holds exactly one draft id, so loading replaces what is on
   * screen. That is destructive to unsent typing, so it goes through the same
   * confirm step the discard does — losing an afternoon of copy because you
   * clicked the wrong row is the failure mode this whole surface is prone to.
   */
  const handleLoadDraft = (draft: CRMBroadcast) => {
    setSubject(draft.subject ?? '');
    setBody(draft.body ?? '');
    setSelectedStatuses(draft.target_status ?? []);
    setSelectedDistricts(draft.target_districts ?? []);
    setSelectedTags(draft.target_tags ?? []);
    setDraftId(draft.id);
    setProgress(null);
    toast.success(`Loaded “${draft.subject}”`);
    startTransition(() => router.refresh());
  };

  const handleDiscardDraft = async (id: string) => {
    const res = await deleteCRMBroadcastDraft(id);
    if (!res.success) {
      toast.error(res.error || 'Failed to delete draft');
      return;
    }
    // Only clear the composer if it was the draft on screen that went away.
    setDraftId((current) => (current === id ? null : current));
    setDrafts((current) => current.filter((d) => d.id !== id));
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
        // The sender is still finishing the recipient loop after this toast; the
        // progress readout below reports the rest.
        toast.success(
          `Broadcast accepted for ${res.recipientCount ?? 0} constituents. It is being delivered; this page reports progress.`
        );
        // The sender computed this warning; it used to go nowhere.
        if (res.warning) toast.warning(res.warning);
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

  /**
   * Previews live in the same history as real campaigns, deliberately: a test is
   * something the author did, and hiding it would leave a campaign in the record
   * with no visible trace. Counting them here keeps the headline number from
   * reading as "campaigns sent to the list".
   */
  const testCount = initialBroadcasts.filter((b) => b.test_only).length;

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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelfTest}
                  disabled={isSelfTesting || !subject.trim() || !body.trim()}
                  title="Send this message to your own inbox. Nobody else receives it."
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:hover:bg-slate-100"
                >
                  {isSelfTesting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <SendHorizonal size={14} />
                  )}
                  Send a test to me
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <Eye size={14} />
                  {previewMode ? 'Edit Draft' : 'Sensory Preview'}
                </button>
              </div>
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
                  <ConfirmAction
                    label="Discard draft"
                    message="Delete this unsent draft. Anything written in it is gone."
                    confirmLabel="Delete draft"
                    danger
                    idleClassName="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-600 hover:text-accent-red text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                    onConfirm={() => {
                      if (draftId) void handleDiscardDraft(draftId);
                    }}
                  >
                    <Trash2 size={14} /> Discard draft
                  </ConfirmAction>
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

              Two states, not one. "Sending" is a claim about the database. Once
              the poll gives up — a 5,000-recipient campaign is five hundred
              round-trips in the sender — the number here stops moving while the
              send carries on, so continuing to say "Sending" is a lie about
              this view. The second branch says plainly that the send may well be
              fine and that this tab has stopped watching, and offers the refresh
              rather than leaving the operator to guess which kind of stuck it is.
            */}
            {progress && (progress.status === 'queued' || progress.status === 'sending') && (
              <div
                role="status"
                aria-live="polite"
                className={`rounded-xl border px-4 py-3 ${
                  progress.stillWatching
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-accent-gold/40 bg-surface-muted'
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    progress.stillWatching ? 'text-blue-900' : 'text-secondary'
                  }`}
                >
                  {progress.stillWatching ? (
                    <>
                      Sending “{progress.subject}” — {progress.sentCount} of{' '}
                      {progress.recipientCount} accepted
                    </>
                  ) : (
                    <>Still sending, but this view has stopped updating</>
                  )}
                </p>
                {!progress.stillWatching && (
                  <>
                    <p className="mt-1 text-xs text-slate-600">
                      {progress.sentCount} of {progress.recipientCount} accepted as of the last
                      check. The send continues in the background — it is not stuck. Refresh to pick
                      it up again.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.refresh()}
                      className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Refresh
                    </button>
                  </>
                )}
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
              {/* `contact@…` here used to be a hardcoded literal. The real sender is
                  the `RESEND_FROM_EMAIL` secret on the crm-broadcast-send function,
                  which can be onboarding@resend.dev while a domain is being set up.
                  An author who confirms "contact@…" deserves to know which of the two
                  they are actually sending as. */}
              <span className="font-bold text-slate-500">Sender:</span> the chapter&apos;s
              configured Resend address — set in the Edge Function secrets, fix it there if it reads
              as onboarding or a placeholder.
            </div>
            <div>
              <span className="font-bold text-slate-500">Audience:</span>{' '}
              {selectedStatuses.length === 0 &&
              selectedDistricts.length === 0 &&
              selectedTags.length === 0 ? (
                'All constituents'
              ) : (
                <>
                  {selectedStatuses.length > 0 &&
                    `Statuses: ${
                      AVAILABLE_STATUSES.filter((s) => selectedStatuses.includes(s.id))
                        .map((s) => s.label)
                        .join(', ') || selectedStatuses.join(', ')
                    } · `}
                  {selectedDistricts.length > 0 && `Districts: ${selectedDistricts.join(', ')} · `}
                  {selectedTags.length > 0 && `Tags: ${selectedTags.join(', ')} · `}
                  all of them required to match
                </>
              )}
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

      {/*
        Unsent drafts, above the history.

        These used to be interleaved with sent campaigns, which is worse than it
        sounds: a row in "Past Campaigns & Dispatch History" is a claim that
        people were contacted, and an unsent draft there makes that claim for
        nobody. Drafts also have no other way in — the composer's id lived in
        component state, so a reload lost the handle and left the row
        unreachable — which is why `getCRMBroadcasts` filters them out and
        `getCRMBroadcastDrafts` reads them separately.
      */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Save size={16} className="text-slate-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
              Unsent drafts ({drafts.length})
            </h2>
          </div>
          <ul className="space-y-2">
            {drafts.map((draft) => {
              const loaded = draft.id === draftId;
              return (
                <li
                  key={draft.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-secondary">
                      {draft.subject || 'Untitled draft'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Saved{' '}
                      {new Date(
                        draft.updated_at ?? draft.created_at ?? Date.now()
                      ).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadDraft(draft)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {loaded ? 'Loaded' : 'Resume'}
                    </button>
                    <ConfirmAction
                      label={`Delete draft ${draft.subject || 'untitled'}`}
                      message={`Delete the unsent draft “${draft.subject || 'Untitled'}”. Anything written in it is gone.`}
                      confirmLabel="Delete draft"
                      danger
                      idleClassName="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-accent-red"
                      onConfirm={() => void handleDiscardDraft(draft.id)}
                    >
                      <Trash2 size={14} />
                    </ConfirmAction>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Broadcast History Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
            Past Campaigns & Dispatch History ({initialBroadcasts.length})
          </h2>
        </div>

        {testCount > 0 && (
          <p className="text-xs text-amber-800">
            {`${testCount} ${testCount === 1 ? 'row is' : 'rows are'} a test sent to yourself. Nobody else received ${
              testCount === 1 ? 'it' : 'them'
            }.`}
          </p>
        )}

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
                          className={`transition-colors cursor-pointer hover:bg-slate-50/70 ${
                            b.test_only ? 'bg-amber-50/50' : ''
                          }`}
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
                              {b.test_only && (
                                <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                                  Test
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {b.test_only ? (
                              // Never "All Constituents" for a preview. The row
                              // is saved with no audience filters at all, so
                              // rendering it the way a real campaign renders
                              // would tell the admin the whole list was mailed.
                              <span className="font-bold text-amber-800">
                                Nobody — sent only to you
                              </span>
                            ) : (
                              <>
                                {b.target_status.length > 0 &&
                                  `Status: ${b.target_status.join(', ')} `}
                                {b.target_districts.length > 0 &&
                                  `Districts: ${b.target_districts.join(', ')} `}
                                {b.target_tags.length > 0 && `Tags: ${b.target_tags.join(', ')}`}
                                {b.target_status.length === 0 &&
                                  b.target_districts.length === 0 &&
                                  b.target_tags.length === 0 &&
                                  'All Constituents'}
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold text-secondary">
                            {b.test_only ? (
                              <span className="text-amber-800">1 (you)</span>
                            ) : (
                              b.recipient_count
                            )}
                            {!b.test_only && b.sent_count > 0 && (
                              // "Accepted by the provider" — not "delivered". Resend returning
                              // 2xx is an acceptance, not a delivery; bounces land later, and a
                              // claim of delivery would be a promise the system cannot keep.
                              <span className="ml-1.5 text-[10px] font-black text-emerald-700">
                                {b.sent_count} accepted
                              </span>
                            )}
                            {b.failed_count > 0 && (
                              <span className="ml-1.5 text-[10px] font-black text-red-600">
                                {b.failed_count} did not send
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                b.test_only
                                  ? 'bg-amber-100 text-amber-900'
                                  : b.status === 'sent'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : b.status === 'sending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {b.status === 'sent' && !b.test_only && <CheckCircle2 size={10} />}
                              {b.test_only ? 'test' : b.status}
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
