import { NewsFieldHeader } from '@/components/admin/news/NewsFieldHeader';

type NewsletterSortingFieldProps = {
  sortOrder: number;
  onChange: (value: number) => void;
};

export function NewsletterSortingField({
  sortOrder,
  onChange,
}: NewsletterSortingFieldProps) {
  return (
    <details className="rounded-sm border border-border bg-background">
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-foreground">
        Archive ordering
      </summary>
      <div className="border-t border-border px-4 py-3">
        <NewsFieldHeader label="Sort order" htmlFor="civic-news-sort" />
        <input
          id="civic-news-sort"
          type="number"
          value={sortOrder}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="w-28 rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Lower numbers appear first. Leave at 10 unless this bulletin needs to be pinned.
        </p>
      </div>
    </details>
  );
}
