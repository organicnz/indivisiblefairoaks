import { Sparkles } from 'lucide-react';
import { NewsletterTextStats } from '@/components/admin/news/NewsletterTextStats';
import { analyzeNewsletterText, tidyNewsletterText } from '@/lib/news-text';
import { NEWSLETTER_LIMITS } from '@/lib/newsletters';

type NewsletterSummaryFieldProps = {
  description: string;
  onChange: (value: string) => void;
};

export function NewsletterSummaryField({
  description,
  onChange,
}: NewsletterSummaryFieldProps) {
  const descriptionCount = description.length;
  const analysis = analyzeNewsletterText(description);
  const tidied = tidyNewsletterText(description);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label
          htmlFor="civic-news-description"
          className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Summary / overview <span aria-hidden="true">*</span>
        </label>
        <span className="font-mono text-[10px] text-muted-foreground">
          {descriptionCount}/{NEWSLETTER_LIMITS.description} chars
        </span>
      </div>
      <textarea
        id="civic-news-description"
        value={description}
        onChange={(event) => onChange(event.target.value)}
        maxLength={NEWSLETTER_LIMITS.description}
        rows={5}
        placeholder="Summarize the priorities, actions, and decisions a reader should know about."
        required
        className="w-full resize-y rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm font-medium leading-relaxed transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Plain text. Keep it to a short archive summary; the full issue remains in the
          chapter&rsquo;s email or PDF archive. <NewsletterTextStats analysis={analysis} />
        </p>
        <button
          type="button"
          onClick={() => onChange(tidied)}
          disabled={!description.trim() || tidied === description}
          title="Normalize line breaks and repeated spaces without changing the wording"
          aria-label="Tidy summary spacing"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-on-dark"
        >
          <Sparkles size={11} aria-hidden="true" />
          Tidy spacing
        </button>
      </div>
    </div>
  );
}
