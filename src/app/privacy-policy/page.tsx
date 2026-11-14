import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How Indivisible Fair Oaks-Carmichael handles contact messages, account information, analytics, embedded media, and privacy requests.',
  path: '/privacy-policy',
});

export default function PrivacyPage() {
  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={ShieldCheck}
        eyebrow="Privacy & trust"
        title={<h1 className={MASTHEAD_TITLE}>Privacy Policy</h1>}
        intro={
          <p className={MASTHEAD_INTRO}>
            We collect only what the chapter needs to answer you, run the site, and keep our
            organizing records straight. This page explains that in plain language.
          </p>
        }
        meta={<span className="civic-stamp">Last updated November 14, 2026</span>}
      />

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="civic-prose">
          <p>
            Indivisible Fair Oaks-Carmichael is a volunteer-run chapter in Sacramento County,
            California. This policy covers this website and the chapter forms connected to it. It
            does not cover third-party sites we link to.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Contact messages:</strong> the name, email address, and message you submit
              through our contact form, plus the optional preference to receive chapter email.
            </li>
            <li>
              <strong>Account information:</strong> if you create an account, we store your email
              address and authentication data through our hosted authentication provider.
            </li>
            <li>
              <strong>Basic usage data:</strong> privacy-conscious analytics may record page views,
              approximate region, device type, and referral source. We use this to understand which
              pages are useful; we do not use it to identify individual visitors.
            </li>
            <li>
              <strong>Display preferences:</strong> your theme choice and similar interface
              settings may be stored in your browser.
            </li>
          </ul>

          <h2>Why we collect it</h2>
          <p>
            We use contact information to reply to you, coordinate volunteering, send requested
            chapter updates, and maintain the security of the site. We do not sell your personal
            information, and we do not share it with candidates or campaigns for their own
            fundraising.
          </p>

          <h2>Service providers</h2>
          <p>
            The site runs on Vercel, stores data with Supabase, and may use privacy-conscious
            analytics and error monitoring. These providers process data on the chapter&apos;s
            behalf so the site can function. Embedded YouTube videos are loaded only when you
            choose to play them, and YouTube&apos;s own privacy policy applies once you do.
          </p>

          <h2>Cookies and browser storage</h2>
          <p>
            We use cookies or local browser storage for sign-in sessions, security, and display
            preferences. We do not use advertising cookies. You can clear browser storage at any
            time; some signed-in features will then require you to sign in again.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Contact messages are kept while the chapter needs them to respond and maintain its
            organizing records. Account data is kept until you ask us to delete the account or the
            chapter no longer needs it. Analytics data is retained according to the provider&apos;s
            configured retention period.
          </p>

          <h2>Your choices</h2>
          <p>
            You can ask to see, correct, or delete personal information we hold about you, and you
            can unsubscribe from chapter email using the link in any message. Email{' '}
            <a href="mailto:contact@indivisiblefairoaks.org">contact@indivisiblefairoaks.org</a> and
            a volunteer will follow up.
          </p>

          <h2>Security and changes</h2>
          <p>
            We use reputable hosting and authentication providers, but no website can promise
            perfect security. If this policy changes materially, we will update the date at the top
            of this page and describe the change here.
          </p>
        </div>
      </div>
    </div>
  );
}
