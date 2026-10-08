'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Eye,
  Loader2,
  Mail,
  Megaphone,
  PenTool,
  Radio,
  Save,
  Send,
  SendHorizonal,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMPager } from '@/components/admin/crm/CRMPager';
import { DevicePreviewFrame } from '@/components/admin/crm/composer/DevicePreviewFrame';
import { parseBodyToBlocks, serializeBlocksToBody } from '@/components/admin/crm/composer/parser';
import { CAMPAIGN_TEMPLATES } from '@/components/admin/crm/composer/templates';
import type { ComposerBlock, ComposerTemplate } from '@/components/admin/crm/composer/types';
import { VisualComposerCanvas } from '@/components/admin/crm/composer/VisualComposerCanvas';
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
  markCRMBroadcastFailed,
  previewCRMBroadcast,
  saveCRMBroadcastDraft,
  sendCRMBroadcast,
  sendCRMBroadcastSelfTest,
} from '@/lib/actions/crm';
import { BROADCAST_RECIPIENT_CEILING } from '@/lib/crm-broadcast';
import { countPages, pageRange } from '@/lib/crm-filters';
import { BROADCAST_HISTORY_PAGE_SIZE, PROGRESS_POLL_TIMEOUT_MS } from '@/lib/crm-limits';

interface Props {
  initialBroadcasts: CRMBroadcast[];
  /**
   * How many campaigns exist in total, not how many are on this page.
   *
   * The heading used to render `initialBroadcasts.length`, which reads as the size
   * of the history — so a chapter with seventy campaigns saw "(25)" and had no way
   * to know whether that was everything or a truncated read. The pager needs the
   * real total for the same reason.
   */
  totalBroadcastCount: number;
  /** 1-based page currently shown. */
  historyPage: number;
  /** Unsent work in progress. Kept out of `initialBroadcasts` on purpose. */
  initialDrafts?: CRMBroadcast[];
  segments: CRMSegment[];
  /** True when the server cut the segment list at its cap (see `getCRMSegments`). */
  segmentsTruncated?: boolean;
  existingTags: string[];
  /**
   * `getCRMExistingTags` stopped at its row ceiling, so `existingTags` may be
   * missing tags that exist in the database.
   *
   * This is not the same as the 40-chip cap below, which hides a tag that was
   * read and remains reachable by typing. A tag missing from an exhausted scan is
   * invisible by every route: no chip, no suggestion, and no way to discover that
   * the constituents carrying it still exist.
   */
  tagsMayBeIncomplete?: boolean;
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
  totalBroadcastCount,
  historyPage,
  initialDrafts = [],
  segments,
  segmentsTruncated = false,
  existingTags,
  tagsMayBeIncomplete = false,
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
  const [composerMode, setComposerMode] = useState<'visual' | 'text'>('visual');
  const [blocks, setBlocks] = useState<ComposerBlock[]>(() => parseBodyToBlocks(''));
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CRMBroadcast[]>(initialDrafts);
  const [savingDraft, setSavingDraft] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);

  // Audience size
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [calculatingCount, setCalculatingCount] = useState(false);
  const [countFailed, setCountFailed] = useState(false);
  /*
   * A segment applied whose consent filter the composer cannot honour.
   *
   * The composer has no consent chips — broadcasts only reach people who
   * agreed — so applying a segment saved from an "Opted Out" view leaves chips
   * that resolve to the *opted-in* people: the exact opposite of the segment.
   * A toast warning vanishes; Send is therefore withheld until the author
   * touches any audience filter, which is the review gesture that clears this.
   */
  const [segmentConsentMismatch, setSegmentConsentMismatch] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  // Sending status
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSelfTesting, setIsSelfTesting] = useState(false);

  // Expandable history rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /**
   * Real tags from the directory, plus any currently selected (may be stale).
   *
   * Capped at 40 with no indication, which is its own bug: a chapter with more
   * than 40 distinct tags gets chips that simply stop, and a tag that sorts past
   * the cap is unselectable for a broadcast — so a constituent tagged only with
   * it cannot be targeted at all. The cap now *says* it is a cap, and the
   * currently-selected tags are added after it so an active selection is never
   * the thing that disappeared.
   */
  const allTagChips = [...new Set([...existingTags, ...FALLBACK_TAGS])];
  const TAG_CHIP_CAP = 40;
  const tagChips = [...allTagChips].slice(0, TAG_CHIP_CAP);
  const hiddenTagCount = Math.max(0, allTagChips.length - TAG_CHIP_CAP);
  const tagsMissingFromChips = [...selectedTags, ...(segments.flatMap((s) => s.tags) || [])].filter(
    (t) => !tagChips.includes(t)
  );

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
          setRecipientCount(count.count);
          setExcludedCount(count.excludedCount);
          setCountFailed(false);
        }
      } catch {
        if (active) {
          // Zero would be a lie: the audience is unknown, not empty. Keep the
          // last good number hidden and tell the author the count could not be
          // taken — an empty badge reads as "no one matches".
          setRecipientCount(null);
          setCountFailed(true);
        }
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

  const toggleStatus = (id: string) => {
    setSegmentConsentMismatch(null);
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleDistrict = (id: string) => {
    setSegmentConsentMismatch(null);
    setSelectedDistricts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleTag = (t: string) => {
    setSegmentConsentMismatch(null);
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
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // Each poll is bounded, *in the browser*. `getBroadcastProgress` is a
        // server action with no client-side timeout, and the `catch` below is
        // the only thing that could end the loop — so a request that hangs
        // rather than rejects froze the loop with no fallback and a frozen
        // "Sending 120 of 5,000". Racing a timeout turns a hang into the
        // visible failure the catch was written for.
        const current = await Promise.race([
          getBroadcastProgress(broadcastId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), PROGRESS_POLL_TIMEOUT_MS)),
        ]);
        // `null` is ambiguous: it is also what a finished-and-deleted row
        // returns. Distinguish them by the attempt count — the give-up below
        // handles exhaustion, so here it means the poll did not answer.
        if (current === null) {
          if (attempt >= maxAttempts) break;
          setProgress((prev) => (prev ? { ...prev, stillWatching: false } : prev));
          toast.error('Lost the progress feed — reload to check the campaign');
          startTransition(() => router.refresh());
          return;
        }
        setProgress(current);
        if (current.status !== 'queued' && current.status !== 'sending') {
          startTransition(() => router.refresh());
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    } catch {
      // One failed poll used to end the readout permanently with the last
      // number frozen on screen. Freeze is still possible — reloading is the
      // recovery — but the author is told instead of left to read a stale
      // "Sending 120 of 5,000".
      setProgress((current) => (current ? { ...current, stillWatching: false } : current));
      toast.error('Lost the progress feed — reload to check the campaign');
      startTransition(() => router.refresh());
      return;
    }

    // Still in flight after roughly half an hour. Not an error — the send may
    // well be fine — but the operator needs to know this tab has stopped
    // watching, because the row they are looking at is not the row in the
    // database.
    setProgress((current) => (current ? { ...current, stillWatching: false } : current));
    startTransition(() => router.refresh());
  };

  const followProgressRef = useRef(followProgress);
  useEffect(() => {
    followProgressRef.current = followProgress;
  });

  // A campaign that is mid-send when this page loads still deserves a progress
  // readout. Progress lived in a callback reached only from the send action, so a
  // reload between "queued" and "sent" stranded the row reading `sending`
  // forever — with the only progress number sitting unused on the row itself.
  useEffect(() => {
    const inFlight = initialBroadcasts.find(
      (b) => !b.test_only && (b.status === 'queued' || b.status === 'sending')
    );
    if (inFlight) void followProgressRef.current(inFlight.id);
  }, [initialBroadcasts]);

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
      setPreviewFailed(false);
      return;
    }
    let active = true;
    const load = async () => {
      setPreviewLoading(true);
      try {
        const result = await previewCRMBroadcast({ subject, body });
        if (active) {
          setPreviewHtml(result.html);
          setPreviewFailed(false);
        }
      } catch {
        if (active) {
          setPreviewHtml(null);
          setPreviewFailed(true);
        }
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
        startTransition(() => router.refresh());
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
    try {
      const res = await saveCRMBroadcastDraft({
        broadcastId: draftId,
        subject,
        body,
        targetStatus: selectedStatuses,
        targetDistricts: selectedDistricts,
        targetTags: selectedTags,
      });
      if (!res.success) {
        toast.error(res.error || 'Failed to save draft');
        return;
      }
      setDraftId(res.broadcastId ?? null);
      // The composer's `drafts` state is the only list of unsent drafts on
      // screen: `initialDrafts` seeds it once and router.refresh() does not
      // re-initialise it, so a save that returned only an id would leave the
      // row it just wrote invisible, and a loaded-then-saved draft would look
      // new again. Fold the saved row in here.
      setDrafts((current) => {
        const id = res.broadcastId;
        if (!id) return current;
        const index = current.findIndex((d) => d.id === id);
        const previous = index >= 0 ? current[index] : {};
        const row = {
          ...previous,
          id,
          subject,
          body,
          target_status: selectedStatuses,
          target_districts: selectedDistricts,
          target_tags: selectedTags,
          status: 'draft',
          updated_at: new Date().toISOString(),
        } as CRMBroadcast;
        if (index >= 0) {
          const next = [...current];
          next[index] = row;
          return next;
        }
        return [row, ...current];
      });
      toast.success('Draft saved');
      startTransition(() => router.refresh());
    } catch {
      // Without this, a dropped connection left the button reading
      // "Saving…" forever — the same dead-button class the editor fixed
      // in Phase 0.
      toast.error('Draft could not be saved — the text is still in the composer');
    } finally {
      setSavingDraft(false);
    }
  };

  /**
   * Load a saved draft back into the composer.
   *
   * The composer holds exactly one draft id, so loading replaces what is on
   * screen. That is destructive to unsent typing, so it goes through the same
   * confirm step the discard does — losing an afternoon of copy because you
   * clicked the wrong row is the failure mode this whole surface is prone to.
   */
  const handleBlocksChange = (nextBlocks: ComposerBlock[]) => {
    setBlocks(nextBlocks);
    setBody(serializeBlocksToBody(nextBlocks));
  };

  const handleSwitchComposerMode = (nextMode: 'visual' | 'text') => {
    if (nextMode === 'visual') {
      setBlocks(parseBodyToBlocks(body));
    } else {
      setBody(serializeBlocksToBody(blocks));
    }
    setComposerMode(nextMode);
  };

  const handleApplyTemplate = (tmpl: ComposerTemplate) => {
    setSubject(tmpl.subject);
    setBlocks(tmpl.blocks);
    setBody(serializeBlocksToBody(tmpl.blocks));
    setIsTemplatesOpen(false);
    toast.success(`Applied template “${tmpl.name}”`);
  };

  const handleLoadDraft = (draft: CRMBroadcast) => {
    setSubject(draft.subject ?? '');
    const draftBody = draft.body ?? '';
    setBody(draftBody);
    setBlocks(parseBodyToBlocks(draftBody));
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

  /**
   * Declare a stranded campaign failed.
   *
   * The action refuses a row the sender may still own, so this reports rather
   * than retries: a refusal here is a correct answer, not a failure to work
   * around, and silently doing something else would be the dangerous version.
   */
  const handleMarkFailed = async (id: string) => {
    try {
      const res = await markCRMBroadcastFailed(id);
      if (!res.success) {
        toast.warning(res.error || 'That campaign could not be marked failed');
        return;
      }
      toast.success('Campaign marked failed. Compose a new, narrower campaign for the rest.');
      setProgress(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark the campaign failed');
    }
  };

  const overCeiling = (recipientCount ?? 0) > BROADCAST_RECIPIENT_CEILING;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please provide both subject and message body');
      return;
    }

    if (countFailed) {
      toast.error('The audience could not be counted — Send is withheld');
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
        setSelectedStatuses([]);
        setSelectedDistricts([]);
        setSelectedTags([]);
        setIsConfirmOpen(false);

        /*
          Delete the draft this send consumed, *before* clearing `draftId`.
          `setDraftId(null)` only forgot it locally: the row stayed
          `status = 'draft'` in the database, so it reappeared under "Unsent
          drafts" offering Resume — loading copy that had already gone to the
          whole list, with the same audience chips, into a composer one click
          from Confirm & Blast again.

          Fire-and-forget on purpose, and the local clear happens either way. A
          failure here leaves a stale draft, which is the pre-existing behaviour
          and recoverable; blocking the UI on it would report a delivered
          campaign as a failure.
        */
        const sentDraftId = draftId;
        setDraftId(null);
        if (sentDraftId)
          void deleteCRMBroadcastDraft(sentDraftId).then((r) => {
            if (!r.success) {
              toast.warning(
                'The sent draft could not be cleared from your drafts — delete it manually so it cannot be sent twice.'
              );
            }
          });

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

  const totalHistoryPages = countPages(totalBroadcastCount, BROADCAST_HISTORY_PAGE_SIZE);
  // `pageRange` owns the zero-case (`0–0`, not `1–0`): the inline arithmetic
  // this replaces omitted it, so an empty history read "Showing 1–0".
  const [historyFirst, historyLast] = pageRange(
    historyPage,
    BROADCAST_HISTORY_PAGE_SIZE,
    totalBroadcastCount
  );
  /*
   * Nothing else lives in this page's query string today, and passing the pager an
   * empty `URLSearchParams` rather than `undefined` is deliberate: `CRMPager` reads
   * `params` to build every href, so omitting it produces bare paths that drop
   * whatever a future filter adds. When a filter lands here, it goes in this
   * object and the pager keeps it across pages for free.
   */
  const historyParams = new URLSearchParams();

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
              ) : countFailed ? (
                <span className="text-accent-red text-sm font-bold">Count unavailable</span>
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

            {/*
              Saved-segment prefill.

              A segment with a search term cannot be pre-filled here, and this is
              the second half of that: the old `onChange` set the status, district
              and tag chips, ignored `seg.query`, and then announced success
              *specifically when a query existed* — so the toast fired exactly
              when the applied audience was wrong. A segment saved from a directory
              search became a whole-segment blast in the composer, announced as
              applied.

              Now the audience that cannot be represented is named, and the live
              count beside it is the real check: applying a query-only segment
              leaves every chip empty, and an empty chip set against a saved
              search segment is visibly not the same audience.
            */}
            {segments.length > 0 && (
              <div className="space-y-2">
                {segmentsTruncated && (
                  <p
                    role="status"
                    className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5"
                  >
                    Showing the 500 most recent saved segments — older ones exist but are not listed
                    here.
                  </p>
                )}
                <label
                  htmlFor="segment-prefill"
                  className="block text-[11px] font-black uppercase tracking-wider text-slate-500"
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
                    /*
                     * Consent is a directory filter, not a broadcast chip — the
                     * composer has no control for it, because broadcasts only
                     * reach people who agreed. Applying a segment saved from an
                     * "Opted Out" view without saying so produces chips that
                     * resolve to the *opted-in* people: the exact opposite of
                     * the segment, announced with a success toast. `seg.query`
                     * got this warning and a label; `seg.consent` got neither.
                     */
                    const inapplicable: string[] = [];
                    if (seg.query) inapplicable.push(`text search "${seg.query}"`);
                    if (seg.consent && seg.consent !== 'opted_in') {
                      inapplicable.push(
                        seg.consent === 'opted_out'
                          ? 'the "Opted Out of Email" filter (broadcasts only reach people who agreed)'
                          : `the "${seg.consent}" consent filter (broadcasts only reach people who agreed)`
                      );
                      // Persistent rather than toast-only, and Send is withheld
                      // until a chip changes: the chips left behind resolve to
                      // the opted-in subset — the opposite of this segment — and
                      // a transient toast is not where that misunderstanding
                      // should live.
                      setSegmentConsentMismatch(
                        `"${seg.name}" partially applied — it also filters on ${inapplicable.join(' and ')}, which broadcasts cannot target. The audience above is the opted-in subset, not that segment.`
                      );
                    } else {
                      setSegmentConsentMismatch(null);
                      if (inapplicable.length > 0) {
                        toast.message(
                          `"${seg.name}" partially applied — it also filters on ${inapplicable.join(' and ')}, which broadcasts cannot target. Check the recipient count before sending.`
                        );
                      } else {
                        toast.message(`Segment "${seg.name}" applied`);
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-slate-50/50"
                >
                  <option value="">Choose a saved segment…</option>
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                      {seg.query || (seg.consent && seg.consent !== 'opted_in')
                        ? ' (partly not applicable here — see note after applying)'
                        : ''}
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
                      aria-pressed={isSelected}
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

                {/* Tags that would otherwise be unreachable. A cap that hides a
                    tag means a constituent carrying only that tag cannot be
                    targeted, which is a silent hole in the audience rather than a
                    cosmetic one. */}
                {hiddenTagCount > 0 && (
                  <p className="w-full text-[11px] font-medium text-slate-500 mt-1">
                    {hiddenTagCount} more tag{hiddenTagCount === 1 ? '' : 's'} not shown — this
                    panel lists the first {TAG_CHIP_CAP} alphabetically. Target one from the{' '}
                    <Link href="/admin/crm" className="text-primary font-bold hover:underline">
                      directory
                    </Link>
                    .
                  </p>
                )}

                {/*
   A stronger claim than the cap above, and it has to be worded differently.

   The cap hides tags that were *read* and remain reachable from the directory. An
   exhausted scan hides tags that were never read: no chip, no suggestion, no
   discovery route. So this does not point at the directory — a tag missing from
   this list may be missing from the directory's filter too, since both read the
   same scan — and it says the list may be incomplete rather than that tags are
   hidden, because the chapter genuinely does not know which ones.
*/}
                {tagsMayBeIncomplete && (
                  <p className="w-full text-[11px] font-bold text-accent-red mt-1">
                    This chapter’s directory is too large to list every tag, so this list may be
                    incomplete. A tag you cannot see here cannot be targeted from here — narrow the
                    audience with status or district filters, or search the{' '}
                    <Link href="/admin/crm" className="text-primary font-bold hover:underline">
                      directory
                    </Link>{' '}
                    by name.
                  </p>
                )}

                {tagsMissingFromChips.length > 0 && (
                  <div className="w-full flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-bold text-primary">Also targeting:</span>
                    {tagsMissingFromChips.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        aria-pressed
                        className="px-2.5 py-1 rounded-md bg-primary text-white text-xs font-bold"
                      >
                        #{t} ×
                      </button>
                    ))}
                  </div>
                )}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                <h2 className="text-xs font-black uppercase tracking-widest text-secondary">
                  2. Message Content
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplatesOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  <Sparkles size={13} />
                  Templates
                </button>

                <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSwitchComposerMode('visual')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                      composerMode === 'visual'
                        ? 'bg-white text-secondary shadow-2xs'
                        : 'text-slate-500 hover:text-secondary'
                    }`}
                  >
                    <PenTool size={12} />
                    Visual Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchComposerMode('text')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                      composerMode === 'text'
                        ? 'bg-white text-secondary shadow-2xs'
                        : 'text-slate-500 hover:text-secondary'
                    }`}
                  >
                    <Code size={12} />
                    Raw Text
                  </button>
                </div>

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

                {composerMode === 'visual' ? (
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      Visual Block Canvas
                    </span>
                    <VisualComposerCanvas blocks={blocks} onChange={handleBlocksChange} />
                  </div>
                ) : null}

                <div className={composerMode === 'text' ? 'block' : 'sr-only'}>
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
                    onChange={(e) => {
                      const next = e.target.value;
                      setBody(next);
                      setBlocks(parseBodyToBlocks(next));
                    }}
                    placeholder="Dear Neighbor,&#10;&#10;Join us this Saturday at Carmichael Park as we rally for democracy...&#10;&#10;Here are the three ways to take immediate action..."
                    aria-describedby="broadcast-body-hint"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm text-slate-800 leading-relaxed font-sans placeholder:text-slate-400"
                  />
                  <p id="broadcast-body-hint" className="mt-1.5 text-[11px] text-slate-500">
                    Plain text / Markdown. Blank lines become paragraph breaks; URLs become
                    clickable in recipient email clients.
                  </p>
                </div>
              </div>
            ) : null}

            {previewMode && (
              <DevicePreviewFrame
                previewHtml={previewHtml || ''}
                previewLoading={previewLoading}
                previewFailed={previewFailed}
                subject={subject}
              />
            )}

            {/* Dispatch Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Will be delivered to{' '}
                <strong className="text-secondary">{recipientCount ?? 0}</strong> constituents.
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  {excludedCount > 0 ? (
                    <>
                      {excludedCount.toLocaleString()} matching{' '}
                      {excludedCount === 1 ? 'contact is' : 'contacts are'} opted out and excluded.
                      {recipientCount === 0
                        ? ' Nobody on this list will receive it.'
                        : ' Every email includes a one-click unsubscribe link.'}
                    </>
                  ) : (
                    <>
                      Opted-out contacts are excluded automatically. Every email includes a
                      one-click unsubscribe link.
                    </>
                  )}
                </span>
                {countFailed && (
                  <span role="alert" className="mt-1 block font-bold text-accent-red">
                    The audience could not be counted, so Send is withheld until it can be. Change a
                    filter to try again.
                  </span>
                )}
                {overCeiling && (
                  <span role="alert" className="mt-1 block font-bold text-accent-red">
                    This is over the {BROADCAST_RECIPIENT_CEILING.toLocaleString()}-recipient limit
                    for a single broadcast. Narrow the audience before sending.
                  </span>
                )}
                {segmentConsentMismatch && (
                  <span role="alert" className="mt-1 block font-bold text-accent-red">
                    {segmentConsentMismatch} Change any audience filter above to confirm you have
                    reviewed it — Send stays withheld until then.
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
                    overCeiling ||
                    segmentConsentMismatch !== null
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
                    <ConfirmAction
                      label={`Resume draft ${draft.subject || 'untitled'}`}
                      message={`Loading “${draft.subject || 'Untitled'}” replaces whatever is in the composer now. Unsaved typing in the composer will be lost.`}
                      confirmLabel="Load draft"
                      disabled={loaded}
                      idleClassName="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      onConfirm={() => handleLoadDraft(draft)}
                    >
                      {loaded ? 'Loaded' : 'Resume'}
                    </ConfirmAction>
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
            Past Campaigns &amp; Dispatch History
            {/*
   The total, not `initialBroadcasts.length`.

   The page size is 25 and this list has no "load more", so rendering the rows
   shown says "(25)" for a chapter that has sent seventy — which reads as
   "twenty-five campaigns exist" and is the reason a chapter believed its whole
   history had been deleted after losing access for a while.
*/}
            {totalBroadcastCount > initialBroadcasts.length ? (
              <>
                {' '}
                <span className="text-secondary font-black">
                  {totalBroadcastCount.toLocaleString()}
                </span>
              </>
            ) : (
              <> ({initialBroadcasts.length})</>
            )}
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
            {/*
              `tabIndex={0}` + `role="region"` on the scroll container. An
              `overflow-x-auto` element is no longer focusable by default in
              Chrome or Firefox, so without it a keyboard user cannot scroll this
              five-column table sideways at all on a narrow viewport — and this is
              the table an organizer reads to find out what has already gone out.
              Same pattern as `CRMContactList`'s directory table; see AGENTS.md.
            */}
            <section
              className="overflow-x-auto"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
              tabIndex={0}
              aria-label="Campaign history"
            >
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Past campaigns, newest first, with the audience each reached and its outcome
                </caption>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th scope="col" className="px-6 py-3">
                      Campaign Subject
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Audience Filters
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Recipients
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Sent Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {initialBroadcasts.map((b) => {
                    const isExpanded = expandedId === b.id;
                    /*
                      A row an organizer may declare stuck.

                      The trigger is the state, not the clock: `sending`/`queued`
                      with no `marked_failed_at`. The timestamp is what *removes*
                      the control, because marking the row failed is what sets it —
                      so `marked_failed_at` here would look for the control's own
                      effect and it would never appear.

                      A test row is excluded: a self-test resolves in one request
                      and "stranded" is not a state it can be in.

                      The action itself refuses a row dispatched in the last
                      fifteen minutes, so a campaign that is merely slow reports
                      that refusal rather than being killed.
                    */
                    const canMarkStranded =
                      !b.test_only &&
                      (b.status === 'sending' || b.status === 'queued') &&
                      !b.marked_failed_at;
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
                            <td colSpan={5} className="px-6 py-4 space-y-3">
                              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line max-w-3xl border-l-2 border-primary pl-4">
                                {b.body || '(no message body stored)'}
                              </div>

                              {/*
                                The documented recovery, made actionable. A row
                                stuck at `sending` with `dispatched_at` set is the
                                one state docs/crm-operations.md says must never be
                                re-dispatched — clearing that flag re-mails everyone
                                already delivered to. Until now the guidance was
                                correct and unreachable: the composer had no control
                                that could mark a row failed, so two organizers
                                staring at a stuck campaign could do nothing or edit
                                the database by hand.

                                One-directional on purpose. `markCRMBroadcastFailed`
                                can only move a row to `failed`, never back to a
                                sendable state, and it refuses a row dispatched
                                within the last fifteen minutes — so it cannot be
                                used to cut short a send that is merely slow.
                              */}
                              {canMarkStranded && (
                                <div className="max-w-3xl rounded-xl bg-amber-50 border border-amber-200 p-3">
                                  <p className="text-xs font-bold text-amber-950">
                                    This campaign has not finished.
                                  </p>
                                  <p className="text-[11px] text-amber-900 mt-1 mb-3">
                                    {b.sent_count ?? 0} of {b.recipient_count ?? 0} accepted so far.
                                    If it is genuinely stuck, mark it failed — that re-sends
                                    nothing, and the remainder needs a new, narrower campaign. A
                                    campaign dispatched in the last fifteen minutes will be refused.
                                  </p>
                                  <ConfirmAction
                                    label={`Mark campaign ${b.subject} as failed`}
                                    message="Mark this campaign failed? Nobody is emailed, and the remainder still needs a new, narrower campaign."
                                    confirmLabel="Mark failed"
                                    danger
                                    idleClassName="inline-flex items-center gap-1.5 rounded-xl bg-amber-200 px-3 py-1.5 text-xs font-black text-amber-950 transition-colors hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                                    onConfirm={() => void handleMarkFailed(b.id)}
                                  >
                                    <AlertCircle size={13} aria-hidden="true" />
                                    Mark as failed
                                  </ConfirmAction>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/*
   The pager, and it is here rather than "load more" on purpose.

   `getCRMBroadcastHistoryPage` exists and the composer was not using it, so this
   table rendered the first 25 campaigns and stopped — the same unreachable-row
   problem `deleteCRMBroadcastDraft`'s comment describes for drafts, except here
   the rows are read-only so nobody can tell they are missing. A chapter past 25
   campaigns simply could not confirm what it had sent.

   Reusing `CRMPager` is the point: numbered links reach page 6 directly, where
   Next-only would mean five clicks, and it already renders an accessible
   current-page state.
*/}
            {totalHistoryPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-500">
                  Showing{' '}
                  <span className="text-secondary font-black">
                    {historyFirst}–{historyLast}
                  </span>{' '}
                  of{' '}
                  <span className="text-secondary font-black">
                    {totalBroadcastCount.toLocaleString()}
                  </span>{' '}
                  campaigns
                </p>
                <CRMPager
                  page={historyPage}
                  totalCount={totalBroadcastCount}
                  pageSize={BROADCAST_HISTORY_PAGE_SIZE}
                  basePath="/admin/crm/broadcasts"
                  params={historyParams}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campaign Template Chooser Dialog */}
      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase text-secondary">
              <Sparkles className="text-amber-500" size={18} />
              Activisi Campaign Templates
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pick a ready-to-use template with formatted blocks, action items, and CTA links.
              Applying a template sets the subject and blocks in your canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 max-h-[70vh] overflow-y-auto">
            {CAMPAIGN_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-primary/50 hover:bg-slate-50/50 transition-all text-left shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {tmpl.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {tmpl.blocks.length} sections
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-secondary mb-1">{tmpl.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{tmpl.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="w-full py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors shadow-2xs"
                >
                  Use This Template
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
