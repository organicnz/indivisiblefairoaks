import { Calendar, PenLine } from 'lucide-react';
import Link from 'next/link';
import type { PublishedPostSummary } from '@/lib/queries/content';

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

function postDate(post: PublishedPostSummary): { label: string; dateTime: string } | null {
  const value = post.published_at ?? post.created_at;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    label: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: PACIFIC_TIME_ZONE,
    }),
    dateTime: date.toISOString(),
  };
}

export function PostDate({ post }: { post: PublishedPostSummary }) {
  const date = postDate(post);
  if (!date) return null;
  return (
    <time
      dateTime={date.dateTime}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground dark:text-ink-muted-on-dark"
    >
      <Calendar size={13} className="text-accent-gold" aria-hidden="true" />
      {date.label}
    </time>
  );
}

export function AdminEditLink({ postId }: { postId: number }) {
  return (
    <Link
      href={`/admin/content/${postId}`}
      className="inline-flex min-h-8 items-center gap-1 border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title="Edit post in admin editor"
    >
      <PenLine size={11} aria-hidden="true" />
      <span>Edit</span>
    </Link>
  );
}
