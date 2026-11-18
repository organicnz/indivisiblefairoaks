import { AlertTriangle } from 'lucide-react';

type ComposerSlugConflictProps = {
  slug: string;
  conflict: string;
};

export function ComposerSlugConflict({ slug, conflict }: ComposerSlugConflictProps) {
  return (
    <p
      role="status"
      className="mt-4 flex items-start gap-2 border-l-2 border-accent-gold bg-accent-gold/10 px-4 py-3 text-xs font-medium text-foreground"
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent-gold" aria-hidden="true" />
      <span>
        <strong className="font-semibold">This row is not what /{slug} serves.</strong> {conflict}{' '}
        Edits still save to the CMS row; change the slug in the editor to publish it at a reachable
        path.
      </span>
    </p>
  );
}
