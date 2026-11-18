import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

export function ContentBackLink({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <div className="mt-20 pt-10 border-t border-border flex justify-between items-center">
      <Link
        href="/"
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:text-primary-ink"
      >
        <span>&larr;</span>{' '}
        <DataPoint as="span" name="content.back_home" initialData={dataPoints}>
          Back to Home
        </DataPoint>
      </Link>
    </div>
  );
}
