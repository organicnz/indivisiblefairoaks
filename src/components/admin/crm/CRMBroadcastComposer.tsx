'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BroadcastAudiencePanel } from '@/components/admin/crm/BroadcastAudiencePanel';
import { BroadcastComposerHeader } from '@/components/admin/crm/BroadcastComposerHeader';
import { BroadcastConfirmationDialog } from '@/components/admin/crm/BroadcastConfirmationDialog';
import { BroadcastDispatchBar } from '@/components/admin/crm/BroadcastDispatchBar';
import { BroadcastDraftsList } from '@/components/admin/crm/BroadcastDraftsList';
import { BroadcastHistoryTable } from '@/components/admin/crm/BroadcastHistoryTable';
import { BroadcastMessageEditor } from '@/components/admin/crm/BroadcastMessageEditor';
import { FALLBACK_TAGS } from '@/components/admin/crm/broadcast-options';
import { CampaignTemplateDialog } from '@/components/admin/crm/CampaignTemplateDialog';
import { parseBodyToBlocks, serializeBlocksToBody } from '@/components/admin/crm/composer/parser';
import {
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
import { createClient } from '@/lib/supabase';
import type { BroadcastMetrics, BroadcastProgress, CRMBroadcast, CRMSegment } from '@/types/crm';
import type { BackendStatus, ComposerBlock, ComposerTemplate } from '@/types/unified';

interface Props {
  initialBroadcasts: CRMBroadcast[];
  /** SQL aggregates for `initialBroadcasts`, keyed by campaign id. */
  broadcastMetrics?: Record<string, BroadcastMetrics>;
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
  /** Live infrastructure readiness from Supabase DB, S3 Storage, and Edge Function. */
  backendStatus?: BackendStatus;
}

export function CRMBroadcastComposer({
  initialBroadcasts,
  broadcastMetrics = {},
  totalBroadcastCount,
  historyPage,
  initialDrafts = [],
  segments,
  segmentsTruncated = false,
  existingTags,
  tagsMayBeIncomplete = false,
  backendStatus,
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
  const [templateModalTab, setTemplateModalTab] = useState<'presets' | 'drafts'>('presets');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CRMBroadcast[]>(initialDrafts);
  const [savingDraft, setSavingDraft] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);
  const resumeInFlightRef = useRef(false);

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
   * Watch a broadcast until it leaves an in-flight state.
   *
   * Primary path: a Supabase Realtime subscription fires on every UPDATE to the
   * broadcast row, so progress updates land immediately rather than after a 2s
   * wait.
   *
   * Fallback: a 10s heartbeat poll via getBroadcastProgress() handles the case
   * where Realtime is unavailable (network partition, WebSocket blocked). The
   * heartbeat also drives the give-up logic — maxAttempts counts 10s intervals
   * instead of 2s ones, preserving the same total time budget.
   *
   * The give-up is visible: it used to return silently after 180 seconds, leaving
   * the row reading `sending` forever in this tab. An admin had no way to tell a
   * slow send from a stuck one, and the recovery procedure for a stuck send is in
   * the docs. Now it says so, refreshes what is known, and keeps attempts
   * proportional to the ceiling.
   */
  const followProgress = async (broadcastId: string) => {
    // 10s heartbeat intervals. maxAttempts is derived from the sender's batch
    // ceiling plus slack; at the ceiling this is roughly 90 minutes, longer than
    // the 15-minute dispatch bound, so a valid send is not abandoned by the view.
    const HEARTBEAT_MS = 10_000;
    // The sender batches ten at a time, so the worst case is the full ceiling
    // plus slack for the audience query and the final status write.
    const maxAttempts = Math.ceil(BROADCAST_RECIPIENT_CEILING / 10) + 30;

    // Set up Realtime subscription for live updates.
    const supabase = createClient();
    const channel = supabase.channel(`broadcast:${broadcastId}`).on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'crm_broadcasts',
        filter: `id=eq.${broadcastId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const status = row.status as BroadcastProgress['status'] | undefined;
        const sentCount = (row.sent_count as number | null) ?? 0;
        const failedCount = (row.failed_count as number | null) ?? 0;
        const recipientCount = (row.recipient_count as number | null) ?? 0;
        const sentAt = (row.sent_at as string | null) ?? null;
        const subject = (row.subject as string | null) ?? null;
        const createdAt = (row.created_at as string) ?? new Date().toISOString();

        if (!status) return;

        setProgress((prev) => ({
          id: broadcastId,
          subject: subject ?? prev?.subject ?? null,
          status,
          recipientCount,
          sentCount,
          failedCount,
          sentAt,
          createdAt,
          stillWatching: true,
        }));

        const isTerminal = status !== 'queued' && status !== 'sending';
        if (isTerminal) {
          startTransition(() => router.refresh());
          void channel.unsubscribe();
          supabase.removeChannel(channel);
        }
      }
    );

    channel.subscribe();

    // Heartbeat: poll once every 10s as a fallback for when Realtime is not
    // delivering. This also drives the give-up logic. The first poll is
    // immediate to preserve the original behavior (fast path to error reporting
    // when the first server-action call fails or times out).
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // Wait before polling (except on the first attempt — immediate first poll
        // preserves the original behavior for fast error detection).
        if (attempt > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, HEARTBEAT_MS));
        }

        // Each poll is bounded, *in the browser*. `getBroadcastProgress` is a
        // server action with no client-side timeout, and the `catch` below is
        // the only thing that could end the loop — so a request that hangs
        // rather than rejects froze the loop with no fallback. Racing a timeout
        // turns a hang into the visible failure the catch was written for.
        const current = await Promise.race([
          getBroadcastProgress(broadcastId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), PROGRESS_POLL_TIMEOUT_MS)),
        ]);

        // `null` means the poll timed out (PROGRESS_POLL_TIMEOUT_MS). It is
        // also what a finished-and-deleted row returns, but exhaustion is
        // handled by the loop; here it means the heartbeat did not answer.
        if (current === null) {
          setProgress((prev) => (prev ? { ...prev, stillWatching: false } : prev));
          toast.error('Lost the progress feed — reload to check the campaign');
          startTransition(() => router.refresh());
          void channel.unsubscribe();
          supabase.removeChannel(channel);
          return;
        }

        // `getBroadcastProgress` reads the row and has no client-only
        // `stillWatching`; without this the first successful poll erased the
        // live state and made a healthy feed look stopped. This loop is
        // watching right now, so the poll cannot claim otherwise.
        setProgress(current ? { ...current, stillWatching: true } : current);
        if (current.status !== 'queued' && current.status !== 'sending') {
          startTransition(() => router.refresh());
          void channel.unsubscribe();
          supabase.removeChannel(channel);
          return;
        }
      }
    } catch {
      // One failed heartbeat used to end the readout permanently with the last
      // number frozen on screen. Freeze is still possible — reloading is the
      // recovery — but the author is told instead of left to read a stale
      // "Sending 120 of 5,000".
      setProgress((current) => (current ? { ...current, stillWatching: false } : current));
      toast.error('Lost the progress feed — reload to check the campaign');
      startTransition(() => router.refresh());
      void channel.unsubscribe();
      supabase.removeChannel(channel);
      return;
    }

    // Still in flight after the full time budget. Not an error — the send may
    // well be fine — but the operator needs to know this tab has stopped
    // watching, because the row they are looking at is not the row in the
    // database.
    setProgress((current) => (current ? { ...current, stillWatching: false } : current));
    startTransition(() => router.refresh());
    void channel.unsubscribe();
    supabase.removeChannel(channel);
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
    if (!inFlight) return;

    // Seed the readout from the row we already have. Without this, a failure on
    // the very first poll leaves `progress` null, so no card renders and the
    // operator has no Resume control to fall back to.
    setProgress((current) =>
      current?.id === inFlight.id
        ? current
        : {
            id: inFlight.id,
            subject: inFlight.subject ?? null,
            status: inFlight.status as BroadcastProgress['status'],
            recipientCount: inFlight.recipient_count ?? 0,
            sentCount: inFlight.sent_count ?? 0,
            failedCount: inFlight.failed_count ?? 0,
            sentAt: inFlight.sent_at ?? null,
            createdAt: inFlight.created_at ?? new Date().toISOString(),
            stillWatching: true,
          }
    );
    void followProgressRef.current(inFlight.id);
  }, [initialBroadcasts]);

  /**
   * Reattach the progress feed without reloading the page or re-dispatching.
   *
   * `stillWatching: false` is a fact about this tab, not the campaign. A page
   * refresh restarts the whole view; this starts only a fresh read loop and
   * leaves the send, the composer and the history untouched. The optimistic
   * flag removes the control immediately, and the ref stops a double click from
   * opening two subscriptions before that render lands.
   */
  const handleResumeProgress = () => {
    if (!progress || progress.stillWatching || resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;
    setProgress((current) => (current ? { ...current, stillWatching: true } : current));
    void followProgressRef.current(progress.id).finally(() => {
      resumeInFlightRef.current = false;
    });
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
   * Position (1-based) of the first image block with no image, or -1.
   *
   * New image blocks start empty — chosen later from Supabase storage — so an
   * unsent one would deliver the literal text `![alt]()`. Drafts may hold one
   * (resumable work round-trips through the parser); sends and self-tests may
   * not. In text mode the blocks state is stale, so the check parses what is
   * on screen instead of what the canvas last committed.
   */
  const findEmptyImageBlock = (): number => {
    const live = composerMode === 'visual' ? blocks : parseBodyToBlocks(body);
    const index = live.findIndex((b) => b.type === 'image' && !b.url.trim());
    return index < 0 ? -1 : index + 1;
  };

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
    const emptyImage = findEmptyImageBlock();
    if (emptyImage > 0) {
      toast.error(
        `Image block #${emptyImage} has no image yet — choose one from storage or remove the block before sending`
      );
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
        if (res.warning) toast.warning(res.warning);
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
      if (res.warning) toast.warning(res.warning);
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
    try {
      const res = await deleteCRMBroadcastDraft(id);
      if (!res.success) {
        toast.error(res.error || 'Failed to delete draft');
        return;
      }
      // Only clear the composer if it was the draft on screen that went away.
      setDraftId((current) => (current === id ? null : current));
      setDrafts((current) => current.filter((d) => d.id !== id));
      toast.success('Draft discarded');
      if (res.warning) toast.warning(res.warning);
      startTransition(() => router.refresh());
    } catch {
      // A transport rejection here used to leave the confirmation step with no
      // answer at all; the draft is still in the list, and the author needs to
      // know the click did nothing.
      toast.error('Draft could not be deleted — it is still in the list');
    }
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
      if (res.warning) toast.warning(res.warning);
      setProgress(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark the campaign failed');
    }
  };

  const handleReuseCampaign = (b: CRMBroadcast) => {
    setSubject(`Copy of ${b.subject}`);
    const rawBody = b.body || '';
    setBody(rawBody);
    setBlocks(parseBodyToBlocks(rawBody));
    setSelectedStatuses(b.target_status || []);
    setSelectedDistricts(b.target_districts || []);
    setSelectedTags(b.target_tags || []);
    setDraftId(null);
    setComposerMode('visual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success('Campaign loaded into visual composer as new draft');
  };

  const overCeiling = (recipientCount ?? 0) > BROADCAST_RECIPIENT_CEILING;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please provide both subject and message body');
      return;
    }

    const emptyImage = findEmptyImageBlock();
    if (emptyImage > 0) {
      toast.error(
        `Image block #${emptyImage} has no image yet — choose one from storage or remove the block before sending`
      );
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
          void deleteCRMBroadcastDraft(sentDraftId)
            .then((r) => {
              if (!r.success) {
                toast.warning(
                  'The sent draft could not be cleared from your drafts — delete it manually so it cannot be sent twice.'
                );
              }
            })
            .catch(() => {
              toast.warning(
                'The sent draft could not be cleared from your drafts — delete it manually so it cannot be sent twice.'
              );
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
      <BroadcastComposerHeader
        backendStatus={backendStatus}
        calculatingCount={calculatingCount}
        countFailed={countFailed}
        recipientCount={recipientCount}
      />

      {/* Main Grid: Targeting & Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <BroadcastAudiencePanel
          segments={segments}
          segmentsTruncated={segmentsTruncated ?? false}
          selectedStatuses={selectedStatuses}
          selectedDistricts={selectedDistricts}
          selectedTags={selectedTags}
          onStatusesChange={setSelectedStatuses}
          onDistrictsChange={setSelectedDistricts}
          onTagsChange={setSelectedTags}
          onToggleStatus={toggleStatus}
          onToggleDistrict={toggleDistrict}
          onToggleTag={toggleTag}
          tagChips={tagChips}
          hiddenTagCount={hiddenTagCount}
          tagsMayBeIncomplete={tagsMayBeIncomplete ?? false}
          tagsMissingFromChips={tagsMissingFromChips}
          onSegmentConsentMismatch={setSegmentConsentMismatch}
        />

        {/* Right Column: Message Composer & Live Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
            <BroadcastMessageEditor
              setIsTemplatesOpen={setIsTemplatesOpen}
              composerMode={composerMode}
              handleSwitchComposerMode={handleSwitchComposerMode}
              handleSelfTest={handleSelfTest}
              isSelfTesting={isSelfTesting}
              subject={subject}
              setSubject={setSubject}
              body={body}
              setBody={setBody}
              setBlocks={setBlocks}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
              blocks={blocks}
              handleBlocksChange={handleBlocksChange}
              previewHtml={previewHtml}
              previewLoading={previewLoading}
              previewFailed={previewFailed}
            />

            <BroadcastDispatchBar
              recipientCount={recipientCount}
              excludedCount={excludedCount}
              countFailed={countFailed}
              overCeiling={overCeiling}
              segmentConsentMismatch={segmentConsentMismatch}
              draftId={draftId}
              handleDiscardDraft={(id) => void handleDiscardDraft(id)}
              handleSaveDraft={() => void handleSaveDraft()}
              savingDraft={savingDraft}
              subject={subject}
              body={body}
              setIsConfirmOpen={setIsConfirmOpen}
              progress={progress}
              handleResumeProgress={handleResumeProgress}
            />
          </div>
        </div>
      </div>

      <BroadcastConfirmationDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        recipientCount={recipientCount}
        subject={subject}
        selectedStatuses={selectedStatuses}
        selectedDistricts={selectedDistricts}
        selectedTags={selectedTags}
        isSending={isSending}
        onSend={handleSend}
      />

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
      <BroadcastDraftsList
        drafts={drafts}
        loadedDraftId={draftId}
        onLoadDraft={handleLoadDraft}
        onDiscardDraft={(id) => void handleDiscardDraft(id)}
      />

      <BroadcastHistoryTable
        broadcasts={initialBroadcasts}
        metricsById={broadcastMetrics}
        totalCount={totalBroadcastCount}
        testCount={testCount}
        expandedId={expandedId}
        onToggleExpanded={setExpandedId}
        onReuse={handleReuseCampaign}
        onMarkFailed={(id) => void handleMarkFailed(id)}
        page={historyPage}
        first={historyFirst}
        last={historyLast}
        totalPages={totalHistoryPages}
        params={historyParams}
      />

      <CampaignTemplateDialog
        open={isTemplatesOpen}
        onOpenChange={setIsTemplatesOpen}
        tab={templateModalTab}
        onTabChange={setTemplateModalTab}
        drafts={drafts}
        onApplyTemplate={handleApplyTemplate}
        onLoadDraft={(draft) => {
          handleLoadDraft(draft);
          setIsTemplatesOpen(false);
        }}
        onDiscardDraft={(id) => void handleDiscardDraft(id)}
      />
    </div>
  );
}
