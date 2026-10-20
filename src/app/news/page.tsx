import { Mail, Megaphone, Newspaper, Send } from 'lucide-react';
import type { Metadata } from 'next';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getNewsletters } from '@/lib/queries/civic';
import { getPublishedPosts } from '@/lib/queries/content';

export const metadata: Metadata = pageMetadata({
  title: 'Newsletters & Bulletins',
  description:
    'Read past chapter newsletters, stay informed about Sacramento County grassroots organizing, and subscribe to receive action alerts directly in your inbox.',
  path: '/news',
});

export default async function NewsPage() {
  const [newslettersRows, postsRows, dataPoints] = await Promise.all([
    getNewsletters().catch(() => []),
    getPublishedPosts(12).catch(() => []),
    getDataPoints('news'),
  ]);
  const initialNewsletters = newslettersRows.length > 0 ? newslettersRows : undefined;
  return (
    <div className="w-full bg-background text-foreground min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Constellation Network */}
      <section className="relative overflow-hidden bg-surface-muted border-b border-border text-foreground dark:bg-secondary dark:text-white py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary dark:bg-primary-bright/10 dark:border-primary-on-dark-muted/30 dark:text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Newspaper size={14} className="text-accent-gold" />
            <DataPoint initialData={dataPoints} name="news.hero.eyebrow">
              Chapter Bulletins & Insights
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
            name="news.hero.headline"
            as="h1"
            className="text-4xl sm:text-5xl font-black text-foreground dark:text-white tracking-tight mb-4"
          >
            Newsletters & Chapter Updates
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            name="news.hero.intro"
            as="p"
            className="text-lg text-muted-foreground dark:text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            Stay up to date with our grassroots organizing, local legislative actions, and community
            resistance across Fair Oaks, Carmichael, and Sacramento County.
          </DataPoint>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Newsletter Subscription Card */}
        <div className="p-8 rounded-2xl bg-surface-card border border-border dark:bg-gradient-to-tr dark:from-blue-900/60 dark:via-slate-900 dark:to-indigo-950/60 dark:border-primary-bright/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-ink-strong dark:text-accent-gold text-[11px] font-bold uppercase tracking-wider">
              <Mail size={12} />
              <DataPoint initialData={dataPoints} as="span" name="news.subscribe.badge">
                Direct To Your Inbox
              </DataPoint>
            </div>
            <DataPoint
              initialData={dataPoints}
              name="news.subscribe.headline"
              as="h2"
              className="text-2xl font-black text-foreground dark:text-white"
            >
              Subscribe to Action Alerts
            </DataPoint>
            <DataPoint
              initialData={dataPoints}
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
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent-gold hover:brightness-105 text-ink-strong font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              <Send size={16} />
              <DataPoint initialData={dataPoints} as="span" name="news.subscribe.btn">
                Email to Subscribe
              </DataPoint>
            </a>
          </div>
        </div>

        {/* Chapter Articles & Dispatches */}
        <InteractivePostsList initialPosts={postsRows} />

        {/* Bulletins Archive with In-Page Visual CRUD */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <span className="text-primary-ink dark:text-primary-on-dark-muted font-mono text-xl">
              ✦
            </span>
            <DataPoint initialData={dataPoints} as="span" name="news.archive.title">
              Past Bulletins &amp; Archives
            </DataPoint>
          </h2>

          <InteractiveNewslettersList initialNewsletters={initialNewsletters} />
        </div>

        {/* National Indivisible Wire */}
        <div className="p-8 rounded-2xl bg-surface-card border border-border space-y-4">
          <div className="flex items-center gap-3">
            <Megaphone className="text-accent-gold" size={22} />
            <DataPoint
              initialData={dataPoints}
              as="h2"
              name="news.national.title"
              className="text-xl font-bold text-foreground dark:text-white"
            >
              National Indivisible Resources
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
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
