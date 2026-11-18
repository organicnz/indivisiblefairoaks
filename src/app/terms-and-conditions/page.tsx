import { Scale } from 'lucide-react';
import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { TermsContent } from '@/components/legal/TermsContent';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'Terms for using the Indivisible Fair Oaks-Carmichael website, including contribution disclaimers and community conduct expectations.',
  path: '/terms-and-conditions',
});

export default function TermsPage() {
  return (
    <LegalPageShell
      icon={Scale}
      eyebrow="Site terms"
      title="Terms & Conditions"
      intro="These terms govern use of this website. They are not legal advice, and they do not replace the rules or disclosures provided by ActBlue or any other service we link to."
      updated="November 14, 2026"
      copyRegionId="terms-body"
    >
      <TermsContent />
    </LegalPageShell>
  );
}
