import type { ContentListRow } from '@/lib/actions/content';
import { contentPublicHref } from '@/lib/content';

const ADMIN_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Los_Angeles',
});

function adminDate(value: string | null | undefined): string {
  if (!value) return 'No date';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 'No date' : ADMIN_DATE.format(new Date(parsed));
}

export function newsPresentation(row: ContentListRow, now: number) {
  if (row.status !== 'publish') {
    return {
      label: 'Draft',
      badge:
        'border-border bg-surface-muted text-foreground',
      publicHref: null,
      dateText: `Updated ${adminDate(row.updated_at)}`,
      dateTime: row.updated_at,
    };
  }

  const published = row.published_at ? Date.parse(row.published_at) : null;
  if (published !== null && Number.isFinite(published) && published > now) {
    return {
      label: 'Scheduled',
      badge:
        'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200',
      publicHref: null,
      dateText: `Scheduled for ${adminDate(row.published_at)}`,
      dateTime: row.published_at,
    };
  }

  return {
    label: 'Published',
    badge:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200',
    publicHref: contentPublicHref(row),
    dateText: `Published ${adminDate(row.published_at ?? row.updated_at)}`,
    dateTime: row.published_at ?? row.updated_at,
  };
}
