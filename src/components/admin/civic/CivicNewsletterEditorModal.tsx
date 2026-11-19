'use client';

import { AlertCircle, CalendarClock, Check, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NewsletterBasicsFields } from '@/components/admin/news/NewsletterBasicsFields';
import { NewsletterPreviewCard } from '@/components/admin/news/NewsletterPreviewCard';
import { NewsletterPublicationField } from '@/components/admin/news/NewsletterPublicationField';
import { NewsletterReaderFields } from '@/components/admin/news/NewsletterReaderFields';
import { NewsletterSortingField } from '@/components/admin/news/NewsletterSortingField';
import { NewsletterTopicsField } from '@/components/admin/news/NewsletterTopicsField';
import { NewsSummaryField } from '@/components/admin/news/NewsSummaryField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { type CivicNewsletterRecord, saveCivicNewsletter } from '@/lib/actions/civic';
import { sendCivicNewsletterTest } from '@/lib/actions/civic-newsletter-broadcast';
import { instantToPacificInput, pacificWallToInstant } from '@/lib/calendar-time';
import { NEWSLETTER_CARD_EXCERPT_LENGTH, parseNewsletterTopicInput } from '@/lib/news-text';
import {
  NEWSLETTER_LIMITS,
  newsletterPublicationState,
  normalizeNewsletterTopics,
  slugifyNewsletter,
} from '@/lib/newsletters';

interface CivicNewsletterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsletter: CivicNewsletterRecord | null;
  /** `previousSlug` lets the caller remove the old row when a bulletin is renamed. */
  onSaved: (saved: CivicNewsletterRecord, previousSlug: string | null) => void;
}

interface NewsletterDraft {
  title: string;
  slug: string;
  dateLabel: string;
  description: string;
  body: string;
  pdfUrl: string;
  archiveUrl: string;
  topics: string[];
  sortOrder: number;
  publishedAt: string;
}

function emptyDraft(): NewsletterDraft {
  return {
    title: '',
    slug: '',
    dateLabel: '',
    description: '',
    body: '',
    pdfUrl: '',
    archiveUrl: '',
    topics: [],
    sortOrder: 10,
    publishedAt: '',
  };
}

function draftFrom(newsletter: CivicNewsletterRecord): NewsletterDraft {
  return {
    title: newsletter.title || '',
    slug: newsletter.slug || '',
    dateLabel: newsletter.date_label || '',
    description: newsletter.description || '',
    body: newsletter.body || '',
    pdfUrl: newsletter.pdf_url || '',
    archiveUrl: newsletter.archive_url || '',
    topics: Array.isArray(newsletter.topics) ? newsletter.topics : [],
    sortOrder: newsletter.sort_order ?? 10,
    publishedAt: instantToPacificInput(newsletter.published_at),
  };
}

function currentIssueLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  }).format(new Date());
}

function draftSnapshot(draft: NewsletterDraft): string {
  return JSON.stringify(draft);
}

export function CivicNewsletterEditorModal({
  isOpen,
  onClose,
  newsletter,
  onSaved,
}: CivicNewsletterEditorModalProps) {
  const [draft, setDraft] = useState<NewsletterDraft>(() =>
    newsletter ? draftFrom(newsletter) : emptyDraft()
  );
  const [baseline, setBaseline] = useState<NewsletterDraft>(() =>
    newsletter ? draftFrom(newsletter) : emptyDraft()
  );
  const [topicInput, setTopicInput] = useState('');
  const [slugTouched, setSlugTouched] = useState(Boolean(newsletter));
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const justSavedRef = useRef(false);

  // Reset only when the dialog opens. Re-running while it is open would wipe a
  // half-written bulletin whenever the parent re-rendered with the same row.
  useEffect(() => {
    if (!isOpen) return;
    const next = newsletter ? draftFrom(newsletter) : emptyDraft();
    if (!newsletter) {
      next.dateLabel = currentIssueLabel();
      next.publishedAt = instantToPacificInput(new Date().toISOString());
    }
    setDraft(next);
    setBaseline(next);
    setTopicInput('');
    setSlugTouched(Boolean(newsletter));
    setSaving(false);
    setSendingTest(false);
    setError(null);
    setConfirmingClose(false);
    justSavedRef.current = false;
  }, [isOpen, newsletter]);

  useEffect(() => {
    if (confirmingClose) keepEditingRef.current?.focus();
  }, [confirmingClose]);

  const dirty = useMemo(() => draftSnapshot(draft) !== draftSnapshot(baseline), [draft, baseline]);

  useEffect(() => {
    if (!isOpen || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, isOpen]);

  const previewTopics = useMemo(
    () => normalizeNewsletterTopics([...draft.topics, ...parseNewsletterTopicInput(topicInput)]),
    [draft.topics, topicInput]
  );

  const scheduled = draft.publishedAt
    ? newsletterPublicationState(pacificWallToInstant(draft.publishedAt)) === 'scheduled'
    : false;

  const canSave =
    dirty &&
    Boolean(draft.title.trim()) &&
    Boolean(draft.dateLabel.trim()) &&
    Boolean(draft.description.trim()) &&
    previewTopics.length <= NEWSLETTER_LIMITS.topics;

  const requestClose = useCallback(() => {
    if (saving || sendingTest) return;
    if (justSavedRef.current || !dirty) {
      setConfirmingClose(false);
      onClose();
      return;
    }
    setConfirmingClose(true);
  }, [dirty, onClose, saving, sendingTest]);

  const updateDraft = (patch: Partial<NewsletterDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  };

  const handleTitleChange = (value: string) => {
    setDraft((previous) => ({
      ...previous,
      title: value,
      slug: slugTouched ? previous.slug : slugifyNewsletter(value),
    }));
    setError(null);
  };

  const addTopic = () => {
    const parsed = parseNewsletterTopicInput(topicInput);
    if (parsed.length === 0) return;

    // Parse the whole value before merging: pasting a comma-separated list used
    // to create one chip containing every topic. Normalization also makes the
    // duplicate check case-insensitive, so "Choir" and "choir" cannot both land.
    const merged = normalizeNewsletterTopics([...draft.topics, ...parsed]);
    if (merged.length > NEWSLETTER_LIMITS.topics) {
      toast.error(`Use ${NEWSLETTER_LIMITS.topics} topics or fewer`);
      return;
    }

    setDraft((previous) => ({ ...previous, topics: merged }));
    setTopicInput('');
    setError(null);
  };

  const removeTopic = (topic: string) => {
    setDraft((previous) => ({
      ...previous,
      topics: previous.topics.filter((item) => item !== topic),
    }));
  };

  const applyCurrentTime = () => {
    updateDraft({ publishedAt: instantToPacificInput(new Date().toISOString()) });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || sendingTest) return;

    const title = draft.title.trim();
    const dateLabel = draft.dateLabel.trim();
    const description = draft.description.trim();
    const topics = normalizeNewsletterTopics([
      ...draft.topics,
      ...parseNewsletterTopicInput(topicInput),
    ]);

    if (!title) {
      setError('Give the bulletin a title before saving.');
      titleRef.current?.focus();
      return;
    }
    if (!dateLabel) {
      setError('Add the issue or date label shown on the public card.');
      return;
    }
    if (!description) {
      setError('Add a short summary so the archive card is useful.');
      return;
    }
    if (topics.length > NEWSLETTER_LIMITS.topics) {
      setError(`Use ${NEWSLETTER_LIMITS.topics} topics or fewer.`);
      return;
    }

    const publishedAt = draft.publishedAt
      ? pacificWallToInstant(draft.publishedAt)
      : new Date().toISOString();
    if (!publishedAt) {
      setError('Choose a valid publication date and time.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await saveCivicNewsletter({
        slug: draft.slug.trim() || undefined,
        original_slug: newsletter?.slug,
        title,
        date_label: dateLabel,
        description,
        body: draft.body.trim(),
        pdf_url: draft.pdfUrl.trim() || null,
        archive_url: draft.archiveUrl.trim() || null,
        topics,
        sort_order: draft.sortOrder,
        published_at: publishedAt,
      });

      if (!result.success) {
        setError(result.error);
        toast.error(result.error || 'Failed to save bulletin');
        return;
      }
      if (!result.data) {
        setError('The bulletin was saved, but its record could not be read. Refresh to confirm.');
        return;
      }

      justSavedRef.current = true;
      setBaseline({
        ...draft,
        title,
        dateLabel,
        description,
        body: draft.body.trim(),
        pdfUrl: draft.pdfUrl.trim(),
        archiveUrl: draft.archiveUrl.trim(),
        topics,
      });
      toast.success(newsletter ? 'Bulletin updated' : 'Bulletin added');
      onSaved(result.data, newsletter?.slug ?? null);
      onClose();
    } catch {
      const message =
        'The bulletin was not saved. Your text is still on screen; copy it before reloading.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (saving || sendingTest) return;

    const title = draft.title.trim();
    const dateLabel = draft.dateLabel.trim();
    const description = draft.description.trim();
    if (!title || !dateLabel || !description) {
      setError('Add a title, issue label, and summary before sending a test.');
      return;
    }

    setSendingTest(true);
    setError(null);
    try {
      const result = await sendCivicNewsletterTest({
        title,
        dateLabel,
        description,
        body: draft.body.trim(),
        pdfUrl: draft.pdfUrl.trim() || null,
        archiveUrl: draft.archiveUrl.trim() || null,
        slug: draft.slug.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error ?? 'The test email could not be sent.');
        toast.error(result.error ?? 'The test email could not be sent.');
        return;
      }
      toast.success(
        `Test sent to ${result.testRecipient ?? 'your admin address'}. The draft was not saved.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The test email could not be sent.';
      setError(message);
      toast.error(message);
    } finally {
      setSendingTest(false);
    }
  };

  const canSendTest =
    Boolean(draft.title.trim()) &&
    Boolean(draft.dateLabel.trim()) &&
    Boolean(draft.description.trim());

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden border border-border bg-surface-card p-0 text-foreground"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (saving || sendingTest) {
            event.preventDefault();
            return;
          }
          if (dirty) {
            event.preventDefault();
            setConfirmingClose(true);
          }
        }}
        onInteractOutside={(event) => {
          if (saving || sendingTest) {
            event.preventDefault();
            return;
          }
          if (dirty) {
            event.preventDefault();
            setConfirmingClose(true);
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border bg-surface-muted/50 p-5 pr-16 sm:p-6 sm:pr-16">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary-ink dark:text-primary-on-dark">
              <CalendarClock size={19} aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="font-display text-2xl tracking-[-0.03em]">
                {newsletter ? 'Edit bulletin' : 'Add bulletin'}
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Short, email-style updates for the public bulletin archive. News articles use the
                full block editor instead.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {confirmingClose ? (
          <div
            role="alertdialog"
            aria-labelledby="newsletter-discard-heading"
            aria-describedby="newsletter-discard-description"
            className="flex shrink-0 flex-col gap-3 border-b border-amber-300 bg-amber-50 px-5 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <div>
              <p id="newsletter-discard-heading" className="text-sm font-bold">
                Discard unsaved changes?
              </p>
              <p id="newsletter-discard-description" className="text-xs">
                This bulletin has edits that have not been saved.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={() => setConfirmingClose(false)}
                className="min-h-9 rounded-sm border border-amber-400 bg-surface-card px-3 py-1.5 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-500/50 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-900/40"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingClose(false);
                  onClose();
                }}
                className="min-h-9 rounded-sm bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="space-y-5 p-5 sm:p-6">
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 border border-rose-300 bg-rose-50 p-3 text-xs leading-relaxed text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}

              <NewsletterBasicsFields
                title={draft.title}
                slug={draft.slug}
                dateLabel={draft.dateLabel}
                titleInputRef={titleRef}
                onTitleChange={handleTitleChange}
                onSlugChange={(value) => {
                  setSlugTouched(true);
                  updateDraft({ slug: value });
                }}
                onDateLabelChange={(value) => updateDraft({ dateLabel: value })}
              />

              <NewsSummaryField
                id="civic-news-description"
                label="Summary / overview"
                value={draft.description}
                onChange={(value) => updateDraft({ description: value })}
                maxLength={NEWSLETTER_LIMITS.description}
                cardLength={NEWSLETTER_CARD_EXCERPT_LENGTH}
                rows={5}
                required
                placeholder="Summarize the priorities, actions, and decisions a reader should know about."
                help={
                  <>
                    Plain text. This is the short summary shown on the archive card. Add the full
                    issue below so readers can open it here.
                  </>
                }
              />

              <NewsletterReaderFields
                body={draft.body}
                pdfUrl={draft.pdfUrl}
                archiveUrl={draft.archiveUrl}
                onBodyChange={(value) => updateDraft({ body: value })}
                onPdfUrlChange={(value) => updateDraft({ pdfUrl: value })}
                onArchiveUrlChange={(value) => updateDraft({ archiveUrl: value })}
              />

              <NewsletterTopicsField
                topics={draft.topics}
                topicInput={topicInput}
                previewTopicCount={previewTopics.length}
                onTopicInputChange={setTopicInput}
                onAddTopic={addTopic}
                onRemoveTopic={removeTopic}
              />

              <NewsletterPublicationField
                publishedAt={draft.publishedAt}
                scheduled={scheduled}
                onPublishedAtChange={(value) => updateDraft({ publishedAt: value })}
                onUseCurrentTime={applyCurrentTime}
              />

              <NewsletterSortingField
                sortOrder={draft.sortOrder}
                onChange={(value) => updateDraft({ sortOrder: value })}
              />
            </div>

            <NewsletterPreviewCard
              dateLabel={draft.dateLabel}
              title={draft.title}
              description={draft.description}
              body={draft.body}
              pdfUrl={draft.pdfUrl}
              archiveUrl={draft.archiveUrl}
              topics={previewTopics}
              scheduled={scheduled}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div
              className="flex items-center gap-2 text-[11px] text-muted-foreground"
              aria-live="polite"
            >
              {sendingTest ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Sending test…
                </>
              ) : saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Saving bulletin…
                </>
              ) : dirty ? (
                <>
                  <AlertCircle size={13} className="text-amber-600" aria-hidden="true" />
                  Unsaved changes
                </>
              ) : (
                <>
                  <Check size={13} className="text-emerald-600" aria-hidden="true" />
                  {newsletter ? 'All changes saved' : 'Ready to add'}
                </>
              )}
              <span className="hidden font-mono text-[10px] sm:inline">⌘/Ctrl + Enter</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={requestClose}
                disabled={saving || sendingTest}
                className="min-h-10 rounded-sm border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={saving || sendingTest || !canSendTest}
                title="Send this draft only to your signed-in admin address"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingTest ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send size={13} aria-hidden="true" />
                )}
                <span>Send test</span>
              </button>
              <button
                type="submit"
                disabled={saving || sendingTest || !canSave}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                <span>
                  {saving
                    ? 'Saving…'
                    : newsletter
                      ? dirty
                        ? 'Save changes'
                        : 'Saved'
                      : 'Add bulletin'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
