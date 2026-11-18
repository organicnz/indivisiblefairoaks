export const POPULAR_LINKS = [
  { href: '/events', label: 'Upcoming events' },
  { href: '/voter-info', label: 'Voter information' },
  { href: '/newsletters', label: 'Newsletters' },
  { href: '/gallery', label: 'Community gallery' },
] as const;

export function resultDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
