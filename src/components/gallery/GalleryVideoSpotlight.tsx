import { Video } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { LiteYouTube } from '@/components/ui/LiteYouTube';

type GalleryVideoSpotlightProps = {
  dataPoints: Record<string, string>;
};

export function GalleryVideoSpotlight({ dataPoints }: GalleryVideoSpotlightProps) {
  return (
    <div className="relative mt-16 overflow-hidden border-y border-border bg-surface-card p-6 sm:p-8 md:p-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-6 border-b border-border pb-6 dark:border-white/10 lg:flex-row lg:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-sm border border-accent-gold/40 bg-accent-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink-strong dark:text-accent-gold-on-dark">
            <Video size={14} />
            <DataPoint initialData={dataPoints} as="span" name="gallery.video.badge_top">
              Featured Video Archive
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
            as="h2"
            name="gallery.video.title"
            className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          >
            No Kings in America: The Movement in Motion
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            as="p"
            name="gallery.video.desc"
            className="mt-1 max-w-2xl text-xs text-muted-foreground dark:text-ink-on-dark sm:text-sm"
          >
            Watch official grassroots mobilization footage and documentary highlights from our
            Sacramento County actions defending constitutional democracy.
          </DataPoint>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DataPoint
            initialData={dataPoints}
            as="span"
            name="gallery.video.platform_tag"
            className="rounded-sm border border-border bg-surface-muted px-3 py-1.5 font-mono text-xs text-muted-foreground"
          >
            Archived from Original Platform
          </DataPoint>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <LiteYouTube
            videoId="aO2BEp8PCcY"
            title="No Kings 3 Grassroots Mobilization Video"
            poster="/images/gallery/sacramento-capitol-no-kings.jpg"
            className="border border-border"
          />
        </div>
        <div className="space-y-4 lg:col-span-5">
          <DataPoint
            initialData={dataPoints}
            as="div"
            name="gallery.video.coalition_badge"
            className="inline-block rounded-sm border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary-ink dark:border-primary-on-dark-muted/30 dark:bg-primary-bright/20 dark:text-primary-on-dark"
          >
            Indivisible National &amp; Local Coalition
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            as="h3"
            name="gallery.video.subheading"
            className="text-xl font-bold text-foreground dark:text-white"
          >
            No Kings 3 Nationwide Action
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            as="p"
            name="gallery.video.action_desc"
            className="text-xs leading-relaxed text-muted-foreground dark:text-ink-on-dark sm:text-sm"
          >
            Highlights from the nationwide peaceful rallies rejecting authoritarian impunity and
            defending the rule of law. From Sacramento to communities across the country,
            thousands gathered with signs, chants, and peaceful resolve.
          </DataPoint>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
            >
              <DataPoint initialData={dataPoints} as="span" name="gallery.video.btn_rallies">
                Upcoming Rallies
              </DataPoint>
            </Link>
            <Link
              href="/choir"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary-ink"
            >
              <DataPoint initialData={dataPoints} as="span" name="gallery.video.btn_choir">
                Choir Anthems
              </DataPoint>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
