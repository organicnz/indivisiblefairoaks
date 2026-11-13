import { Archive, ArrowUpRight, Download, ExternalLink, FileText } from 'lucide-react';
import { legacyDocumentUrl, type LegacyDocumentRow } from '@/lib/queries/legacy';

function formatBytes(value: number | null): string {
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LegacyDocumentArchive({
  documents,
  title = 'From the chapter archive',
  description = 'Documents preserved from the chapter’s earlier Google Sites. Cleared files are hosted here; other items link to their original public source.',
  limit = 8,
}: {
  documents: LegacyDocumentRow[];
  title?: string;
  description?: string;
  limit?: number;
}) {
  if (documents.length === 0) return null;
  const visible = documents.slice(0, limit);

  return (
    <section className="space-y-5" aria-labelledby="legacy-documents-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2
            id="legacy-documents-heading"
            className="text-2xl font-black tracking-tight text-foreground dark:text-white flex items-center gap-2"
          >
            <Archive size={20} className="text-accent-gold" />
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            {description}
          </p>
        </div>
        <a
          href="/archive"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-card px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground hover:border-primary/40 hover:text-primary-ink dark:text-ink-on-dark dark:hover:text-accent-gold transition-colors"
        >
          Full archive
          <ArrowUpRight size={13} />
        </a>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map((document) => {
          const href = legacyDocumentUrl(document);
          const hosted = Boolean(document.file_path || document.public_url);
          return (
            <li
              key={document.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink dark:bg-primary-bright/15 dark:text-primary-on-dark">
                    <FileText size={16} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark">
                    {categoryLabel(document.category)}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold leading-snug text-foreground dark:text-white">
                  {document.title}
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                  {document.mime_type?.replace('application/', '').replace('image/', '') || 'Document'}
                  {document.byte_size ? ` · ${formatBytes(document.byte_size)}` : ''}
                  {hosted ? ' · Hosted copy' : ' · Original source'}
                </p>
              </div>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${hosted ? 'Download' : 'Open source for'} ${document.title}`}
                  className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-primary-dark transition-colors"
                >
                  {hosted ? <Download size={12} /> : <ExternalLink size={12} />}
                  {hosted ? 'Download' : 'Source'}
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      {documents.length > visible.length ? (
        <a
          href="/archive"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:underline"
        >
          View all {documents.length} archived documents
          <ArrowUpRight size={13} />
        </a>
      ) : null}
    </section>
  );
}
