export function formatBytes(value: number | null): string {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function dateLabel(value: string | null): string {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function pageAnchor(sourcePath: string): string {
  return sourcePath === '/' ? 'home' : sourcePath.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-');
}

export function hostLabel(value: string | null): string {
  if (!value) return 'Source';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}
