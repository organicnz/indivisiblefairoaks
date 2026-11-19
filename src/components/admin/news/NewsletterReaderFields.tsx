import { Archive, FileText } from 'lucide-react';
import { NewsFieldHeader } from '@/components/admin/news/NewsFieldHeader';
import { NEWSLETTER_LIMITS } from '@/lib/newsletters';

type NewsletterReaderFieldsProps = {
  body: string;
  pdfUrl: string;
  archiveUrl: string;
  onBodyChange: (value: string) => void;
  onPdfUrlChange: (value: string) => void;
  onArchiveUrlChange: (value: string) => void;
};

/**
 * The public reader destination for a bulletin.
 *
 * A bulletin used to stop at its archive summary and a request-by-email link.
 * These fields let an editor publish the full issue on its own page, or point
 * at a durable PDF / archive copy when one already exists. All three are
 * optional so older summary-only bulletins remain editable.
 */
export function NewsletterReaderFields({
  body,
  pdfUrl,
  archiveUrl,
  onBodyChange,
  onPdfUrlChange,
  onArchiveUrlChange,
}: NewsletterReaderFieldsProps) {
  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        <FileText size={14} aria-hidden="true" />
        Reader destination
      </div>
      <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
        Readers open <span className="font-mono text-[10px]">/newsletters/[slug]</span> from the
        archive card. Add the full issue here, or link a durable PDF or archive copy.
      </p>

      <div className="mt-4">
        <NewsFieldHeader
          label="Full issue text"
          htmlFor="civic-news-body"
          count={`${body.length}/${NEWSLETTER_LIMITS.body} chars`}
        />
        <textarea
          id="civic-news-body"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          maxLength={NEWSLETTER_LIMITS.body}
          rows={10}
          placeholder="Paste the full bulletin text here. Leave blank when a PDF or archive link already holds the complete issue."
          aria-describedby="civic-news-body-help"
          className="w-full resize-y rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm font-medium leading-relaxed transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p
          id="civic-news-body-help"
          className="mt-1 text-[10px] leading-relaxed text-muted-foreground"
        >
          Plain text. Blank lines separate paragraphs. This text appears on the public bulletin page
          and is included when you email the issue from the bulletin list. The email is sent only to
          CRM contacts who completed double opt-in.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <NewsFieldHeader label="PDF link" htmlFor="civic-news-pdf-url" />
          <div className="relative">
            <FileText
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="civic-news-pdf-url"
              type="url"
              inputMode="url"
              value={pdfUrl}
              onChange={(event) => onPdfUrlChange(event.target.value)}
              maxLength={NEWSLETTER_LIMITS.url}
              placeholder="https://…/bulletin.pdf"
              aria-describedby="civic-news-pdf-url-help"
              className="min-h-10 w-full rounded-sm border border-border bg-background py-2 pl-9 pr-3 text-xs font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <p
            id="civic-news-pdf-url-help"
            className="mt-1 text-[10px] leading-relaxed text-muted-foreground"
          >
            Optional. A direct, durable PDF address.
          </p>
        </div>

        <div>
          <NewsFieldHeader label="Archive link" htmlFor="civic-news-archive-url" />
          <div className="relative">
            <Archive
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="civic-news-archive-url"
              type="url"
              inputMode="url"
              value={archiveUrl}
              onChange={(event) => onArchiveUrlChange(event.target.value)}
              maxLength={NEWSLETTER_LIMITS.url}
              placeholder="https://…/archive/issue"
              aria-describedby="civic-news-archive-url-help"
              className="min-h-10 w-full rounded-sm border border-border bg-background py-2 pl-9 pr-3 text-xs font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <p
            id="civic-news-archive-url-help"
            className="mt-1 text-[10px] leading-relaxed text-muted-foreground"
          >
            Optional. An existing campaign or email archive page.
          </p>
        </div>
      </div>
    </div>
  );
}
