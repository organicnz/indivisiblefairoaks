'use client';

import {
  AlertCircle,
  CalendarClock,
  Check,
  Clock3,
  Eye,
  Loader2,
  Plus,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { type CivicNewsletterRecord, saveCivicNewsletter } from '@/lib/actions/civic';
import { instantToPacificInput, pacificWallToInstant } from '@/lib/calendar-time';
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

function formatPublicationTime(instant: string | null): string {
  if (!instant) return 'Choose a valid Pacific date and time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  }).format(new Date(instant));
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
    setError(null);
    setConfirmingClose(false);
    justSavedRef.current = false;
  }, [isOpen, newsletter]);

  useEffect(() => {
    if (confirmingClose) keepEditingRef.current?.focus();
  }, [confirmingClose]);

  const dirty = useMemo(
    () => draftSnapshot(draft) !== draftSnapshot(baseline),
    [draft, baseline]
  );

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
    () => normalizeNewsletterTopics([...draft.topics, topicInput]),
    [draft.topics, topicInput]
  );

  const publicationInstant = draft.publishedAt
    ? pacificWallToInstant(draft.publishedAt)
    : new Date().toISOString();
  const scheduled =
    publicationInstant !== null &&
    newsletterPublicationState(publicationInstant) === 'scheduled';
  const descriptionCount = draft.description.length;

  const canSave =
    dirty &&
    Boolean(draft.title.trim()) &&
    Boolean(draft.dateLabel.trim()) &&
    Boolean(draft.description.trim()) &&
    previewTopics.length <= NEWSLETTER_LIMITS.topics;

  const requestClose = useCallback(() => {
    if (saving) return;
    if (justSavedRef.current || !dirty) {
      setConfirmingClose(false);
      onClose();
      return;
    }
    setConfirmingClose(true);
  }, [dirty, onClose, saving]);

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
    const value = topicInput.trim();
    if (!value) return;
    // Compare against the committed chips, not `previewTopics`: the preview
    // includes the text still sitting in this input, so checking it here made
    // every value look like a duplicate of itself. The blur handler fired
    // first on a button click, cleared the input, and the tag never landed.
    if (draft.topics.length >= NEWSLETTER_LIMITS.topics) {
      toast.error(`Use ${NEWSLETTER_LIMITS.topics} topics or fewer`);
      return;
    }
    if (draft.topics.some((topic) => topic.toLowerCase() === value.toLowerCase())) {
      setTopicInput('');
      return;
    }
    setDraft((previous) => ({
      ...previous,
      topics: normalizeNewsletterTopics([...previous.topics, value]),
    }));
    setTopicInput('');
    setError(null);
  };

  const removeTopic = (topic: string) => {
    setDraft((previous) => ({
      ...previous,
      topics: previous.topics.filter((item) => item !== topic),
    }));
  };

  const useCurrentTime = () => {
    updateDraft({ publishedAt: instantToPacificInput(new Date().toISOString()) });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const title = draft.title.trim();
    const dateLabel = draft.dateLabel.trim();
    const description = draft.description.trim();
    const topics = normalizeNewsletterTopics([...draft.topics, topicInput]);

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
      setBaseline({ ...draft, title, dateLabel, description, topics });
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
          if (saving) {
            event.preventDefault();
            return;
          }
          if (dirty) {
            event.preventDefault();
            setConfirmingClose(true);
          }
        }}
        onInteractOutside={(event) => {
          if (saving) {
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

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label
                    htmlFor="civic-news-title"
                    className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Bulletin title <span aria-hidden="true">*</span>
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {draft.title.length}/{NEWSLETTER_LIMITS.title}
                  </span>
                </div>
                <input
                  ref={titleRef}
                  id="civic-news-title"
                  type="text"
                  value={draft.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  maxLength={NEWSLETTER_LIMITS.title}
                  placeholder="e.g. Summer Action Bulletin & Town Hall Recap"
                  required
                  className="min-h-11 w-full rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="civic-news-slug"
                    className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Public identifier
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="civic-news-slug"
                      type="text"
                      value={draft.slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        updateDraft({ slug: event.target.value });
                      }}
                      maxLength={NEWSLETTER_LIMITS.slug}
                      placeholder="auto-generated-from-title"
                      className="min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSlugTouched(true);
                        updateDraft({ slug: slugifyNewsletter(draft.title) });
                      }}
                      title="Generate the slug from the title"
                      aria-label="Generate the public identifier from the title"
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    Stored identifier:{' '}
                    <span className="font-mono">
                      {draft.slug || slugifyNewsletter(draft.title) || 'auto-generated'}
                    </span>
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="civic-news-date-label"
                    className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Issue / date label <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="civic-news-date-label"
                    type="text"
                    value={draft.dateLabel}
                    onChange={(event) => updateDraft({ dateLabel: event.target.value })}
                    maxLength={NEWSLETTER_LIMITS.dateLabel}
                    placeholder="e.g. July 2026"
                    required
                    className="min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Printed above the title in the public archive.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label
                    htmlFor="civic-news-description"
                    className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Summary / overview <span aria-hidden="true">*</span>
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {descriptionCount}/{NEWSLETTER_LIMITS.description}
                  </span>
                </div>
                <textarea
                  id="civic-news-description"
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  maxLength={NEWSLETTER_LIMITS.description}
                  rows={5}
                  placeholder="Summarize the priorities, actions, and decisions a reader should know about."
                  required
                  className="w-full resize-y rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm font-medium leading-relaxed transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Plain text. Keep it to a short archive summary; the full issue remains in the
                  chapter&rsquo;s email or PDF archive.
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Key topics &amp; campaign tags
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {previewTopics.length}/{NEWSLETTER_LIMITS.topics}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="civic-news-topic-input"
                    type="text"
                    aria-label="Add a topic"
                    value={topicInput}
                    onChange={(event) => setTopicInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        addTopic();
                      }
                    }}
                    onBlur={() => {
                      if (topicInput.trim()) addTopic();
                    }}
                    maxLength={NEWSLETTER_LIMITS.topic}
                    placeholder="e.g. Election Defense, Choir Actions, Food Drive"
                    className="min-h-10 flex-1 rounded-sm border border-border bg-background px-3 py-2 text-xs font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={addTopic}
                    disabled={!topicInput.trim() || previewTopics.length >= NEWSLETTER_LIMITS.topics}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-sm border border-border bg-secondary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Add tag
                  </button>
                </div>

                {draft.topics.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {draft.topics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center gap-1 rounded-sm border border-accent-gold/40 bg-accent-gold/15 px-2.5 py-1 text-xs font-bold text-ink-strong dark:text-accent-gold"
                      >
                        <Tag size={11} aria-hidden="true" />
                        <span>{topic}</span>
                        <button
                          type="button"
                          onClick={() => removeTopic(topic)}
                          className="rounded-sm p-0.5 transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/20"
                          aria-label={`Remove topic ${topic}`}
                        >
                          <span aria-hidden="true" className="block text-sm leading-none">
                            ×
                          </span>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Press Enter or comma after each topic.
                  </p>
                )}
              </div>

              <div className="rounded-sm border border-border bg-surface-muted/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1">
                    <label
                      htmlFor="civic-news-published-at"
                      className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Publication time (Pacific)
                    </label>
                    <input
                      id="civic-news-published-at"
                      type="datetime-local"
                      value={draft.publishedAt}
                      onChange={(event) => updateDraft({ publishedAt: event.target.value })}
                      className="min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-xs font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={useCurrentTime}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Clock3 size={14} aria-hidden="true" />
                    Use now
                  </button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                  {scheduled
                    ? `Scheduled for ${formatPublicationTime(publicationInstant)}. It stays out of the public archive until then.`
                    : `Publishes immediately (${formatPublicationTime(publicationInstant)}). A future time schedules it instead.`}
                </p>
              </div>

              <details className="rounded-sm border border-border bg-background">
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-foreground">
                  Archive ordering
                </summary>
                <div className="border-t border-border px-4 py-3">
                  <label
                    htmlFor="civic-news-sort"
                    className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Sort order
                  </label>
                  <input
                    id="civic-news-sort"
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      updateDraft({ sortOrder: Number(event.target.value) || 0 })
                    }
                    className="w-28 rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Lower numbers appear first. Leave at 10 unless this bulletin needs to be pinned.
                  </p>
                </div>
              </details>
            </div>

            <aside
              aria-label="Public archive preview"
              className="border-t border-border bg-surface-muted/30 p-5 lg:border-l lg:border-t-0 sm:p-6"
            >
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                <Eye size={14} aria-hidden="true" />
                Public card preview
              </div>
              <div className="mt-3 border border-border bg-surface-card p-5 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary-ink dark:text-accent-gold">
                    {draft.dateLabel || 'Issue date'}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Chapter bulletin
                  </span>
                </div>
                <h3 className="mt-3 font-display text-2xl font-semibold leading-snug tracking-[-0.02em]">
                  {draft.title || 'Bulletin title'}
                </h3>
                <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-muted-foreground">
                  {draft.description || 'A short summary of this bulletin will appear here.'}
                </p>
                {previewTopics.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {previewTopics.map((topic) => (
                      <span
                        key={topic}
                        className="border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3 text-[10px] font-bold text-muted-foreground">
                  <span>Request full issue</span>
                  <span>PDF &amp; email archive</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
                <p className="inline-flex items-center gap-1.5 font-bold text-foreground">
                  {scheduled ? (
                    <>
                      <CalendarClock size={13} aria-hidden="true" />
                      Scheduled
                    </>
                  ) : (
                    <>
                      <Check size={13} aria-hidden="true" />
                      Publishes now
                    </>
                  )}
                </p>
                <p>
                  This is the card readers see at{' '}
                  <span className="font-mono text-[10px]">/newsletters</span>. It uses the same
                  fields the public archive renders.
                </p>
              </div>
            </aside>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground" aria-live="polite">
              {saving ? (
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
                disabled={saving}
                className="min-h-10 rounded-sm border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !canSave}
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
