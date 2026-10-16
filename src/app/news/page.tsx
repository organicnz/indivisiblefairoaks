import { Mail, Megaphone, Newspaper, Send } from 'lucide-react';
import type { Metadata } from 'next';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';
import { pageMetadata } from '@/lib/metadata';
import { getNewsletters, type NewsletterRow } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Newsletters & Bulletins',
  description:
    'Read past chapter newsletters, stay informed about Sacramento County grassroots organizing, and subscribe to receive action alerts directly in your inbox.',
  path: '/news',
});

export default async function NewsPage() {
  let initialNewsletters: NewsletterRow[] | undefined;
  try {
    const rows = await getNewsletters();
    if (rows.length > 0) {
      initialNewsletters = rows;
    }
  } catch {
    // falls through to fallback inside InteractiveNewslettersList
  }
  return (
    <div className="w-full bg-background text-foreground dark:bg-secondary dark:text-white min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Newspaper size={14} className="text-accent-gold" />
            <DataPoint name="news.hero.eyebrow">Chapter Bulletins & Insights</DataPoint>
          </div>
          <DataPoint
            name="news.hero.headline"
            as="h1"
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4"
          >
            Newsletters & Chapter Updates
          </DataPoint>
          <DataPoint
            name="news.hero.intro"
            as="p"
            className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            Stay up to date with our grassroots organizing, local legislative actions, and community
            resistance across Fair Oaks, Carmichael, and Sacramento County.
          </DataPoint>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Newsletter Subscription Card */}
        <div className="p-8 rounded-2xl bg-gradient-to-tr from-blue-900/60 via-slate-900 to-indigo-950/60 border border-primary-bright/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-primary-ink dark:text-accent-gold text-[11px] font-bold uppercase tracking-wider">
              <Mail size={12} />
              <DataPoint as="span" name="news.subscribe.badge">
                Direct To Your Inbox
              </DataPoint>
            </div>
            <DataPoint
              name="news.subscribe.headline"
              as="h2"
              className="text-2xl font-black text-foreground dark:text-white"
            >
              Subscribe to Action Alerts
            </DataPoint>
            <DataPoint
              name="news.subscribe.intro"
              as="p"
              className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark max-w-xl leading-relaxed"
            >
              Receive notifications for upcoming meetings, emergency rapid response rallies, choir
              rehearsal locations, and legislative call-to-action alerts.
            </DataPoint>
          </div>
          <div className="shrink-0 w-full md:w-auto">
            <a
              href="mailto:subscribe@indivisiblefairoaks.org?subject=Subscribe%20to%20Indivisible%20Fair%20Oaks%20Newsletter"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent-gold hover:bg-accent-gold text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              <Send size={16} />
              <DataPoint as="span" name="news.subscribe.btn">
                Email to Subscribe
              </DataPoint>
            </a>
          </div>
        </div>

        {/* Bulletins Archive with In-Page Visual CRUD */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <span className="text-primary-ink dark:text-primary-on-dark-muted font-mono text-xl">
              ✦
            </span>
            <DataPoint as="span" name="news.archive.title">
              Past Bulletins &amp; Archives
            </DataPoint>
          </h2>

          <InteractiveNewslettersList initialNewsletters={initialNewsletters} />
        </div>

        {/* National Indivisible Wire */}
        <div className="p-8 rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <Megaphone className="text-accent-gold" size={22} />
            <DataPoint
              as="h2"
              name="news.national.title"
              className="text-xl font-bold text-foreground dark:text-white"
            >
              National Indivisible Resources
            </DataPoint>
          </div>
          <DataPoint
            as="p"
            name="news.national.desc"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed"
          >
            Indivisible Fair Oaks-Carmichael is one of thousands of grassroots groups nationwide
            following the proven guide created by former congressional staffers. For nationwide
            campaigns, toolkits, and legislative tracking, visit the national network at{' '}
            <a
              href="https://indivisible.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
            >
              indivisible.org
            </a>
            .
          </DataPoint>
        </div>
      </div>
    </div>
  );
}
