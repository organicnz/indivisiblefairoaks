import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { PrivacyPolicyContent } from '@/components/legal/PrivacyPolicyContent';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How Indivisible Fair Oaks-Carmichael handles contact messages, account information, analytics, embedded media, and privacy requests.',
  path: '/privacy-policy',
});

export default function PrivacyPage() {
  return (
    <LegalPageShell
      icon={ShieldCheck}
      eyebrow="Privacy & trust"
      title="Privacy Policy"
      intro="We collect only what the chapter needs to answer you, run the site, and keep our organizing records straight. This page explains that in plain language."
      updated="November 17, 2026"
      copyRegionId="privacy-body"
    >
      <PrivacyPolicyContent />
    </LegalPageShell>
  );
}
