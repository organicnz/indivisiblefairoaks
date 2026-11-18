import type { ComponentProps } from 'react';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';

type LegacyNewslettersSectionProps = {
  documents: ComponentProps<typeof LegacyDocumentArchive>['documents'];
};

export function LegacyNewslettersSection({ documents }: LegacyNewslettersSectionProps) {
  if (documents.length === 0) return null;

  return (
    <div className="border-t border-border pt-4">
      <LegacyDocumentArchive
        documents={documents}
        title="Legacy newsletter PDFs"
        description="The original newsletter files from the chapter’s Google Sites. Each entry identifies whether the file is hosted here or points to its original source."
        limit={12}
      />
    </div>
  );
}
