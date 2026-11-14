import { Scale } from 'lucide-react';
import type { Metadata } from 'next';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'Terms for using the Indivisible Fair Oaks-Carmichael website, including contribution disclaimers and community conduct expectations.',
  path: '/terms-and-conditions',
});

export default function TermsPage() {
  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Scale}
        eyebrow="Site terms"
        title={<h1 className={MASTHEAD_TITLE}>Terms &amp; Conditions</h1>}
        intro={
          <p className={MASTHEAD_INTRO}>
            These terms govern use of this website. They are not legal advice, and they do not
            replace the rules or disclosures provided by ActBlue or any other service we link to.
          </p>
        }
        meta={<span className="civic-stamp">Last updated November 14, 2026</span>}
      />

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="civic-prose">
          <h2>Using this site</h2>
          <p>
            You may use this site for lawful civic and educational purposes. Do not attempt to
            disrupt the site, access accounts that are not yours, submit spam, or use chapter forms
            to harass or threaten anyone.
          </p>

          <h2>Community conduct</h2>
          <p>
            Indivisible Fair Oaks-Carmichael is a peaceful, non-partisan volunteer community. We
            expect participants at chapter events and on chapter platforms to act lawfully, treat
            neighbors with dignity, and de-escalate conflict. Weapons are not permitted at chapter
            events.
          </p>

          <h2>Contributions</h2>
          <p>
            Contributions made through the chapter&apos;s ActBlue portal are political
            contributions, are not tax-deductible as charitable gifts, and are subject to
            ActBlue&apos;s own terms and receipts. The chapter uses contributions for local
            organizing, meeting space, printing, sound equipment, and voter outreach.
          </p>

          <h2>Content and links</h2>
          <p>
            We work to keep chapter information accurate, but schedules, locations, and external
            resources can change. Information on this site is for civic and educational purposes
            and is not legal advice. Third-party links are provided as a convenience; their content
            and privacy practices are their own.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms as the site or chapter practices change. The date at the top
            of this page is the current version. Questions can be sent to{' '}
            <a href="mailto:contact@indivisiblefairoaks.org">contact@indivisiblefairoaks.org</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
