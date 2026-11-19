import { NewsSummaryField } from '@/components/admin/news/NewsSummaryField';
import { NEWSLETTER_CARD_EXCERPT_LENGTH } from '@/lib/news-text';
import { NEWSLETTER_LIMITS } from '@/lib/newsletters';

type NewsletterSummaryFieldProps = {
  description: string;
  onChange: (value: string) => void;
};

/** Bulletin summary editor backed by the shared news-text authoring field. */
export function NewsletterSummaryField({
  description,
  onChange,
}: NewsletterSummaryFieldProps) {
  return (
    <NewsSummaryField
      id="civic-news-description"
      label="Summary / overview"
      value={description}
      onChange={onChange}
      maxLength={NEWSLETTER_LIMITS.description}
      cardLength={NEWSLETTER_CARD_EXCERPT_LENGTH}
      rows={5}
      required
      placeholder="Summarize the priorities, actions, and decisions a reader should know about."
      help={
        <>
          Plain text. Keep it to a short archive summary; the full issue remains in the
          chapter&rsquo;s email or PDF archive.
        </>
      }
    />
  );
}
