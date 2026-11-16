import { AlertTriangle } from 'lucide-react';
import { formatDateLabel } from './data';
import type { HeatmapMeta } from './types';

export function IceAlertBanner({ meta }: { meta: HeatmapMeta }) {
  return (
    <div className="border-b border-accent/40 bg-accent/10">
      <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-foreground sm:text-[13px]">
          <strong className="font-semibold">Historical data, not a live alert map.</strong> This
          interactive map loads the latest available published FOIA snapshot: records through{' '}
          {formatDateLabel(meta.periodEnd)}, checked{' '}
          {formatDateLabel(meta.releaseCheckedAt)}. It cannot show current enforcement
          activity or dispatch help. Immediate danger? Call{' '}
          <a href="tel:911" className="font-semibold underline underline-offset-2">
            911
          </a>
          .
        </p>
      </div>
    </div>
  );
}
