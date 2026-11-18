import { ExternalLink, Music } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { LiteYouTube } from '@/components/ui/LiteYouTube';

type ChoirVideoSectionProps = {
  dataPoints: Record<string, string>;
};

export function ChoirVideoSection({ dataPoints }: ChoirVideoSectionProps) {
  return (
    <>
        {/* Video Demonstrations */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <DataPoint
              name="choir.videos.eyebrow"
              as="span"
              initialData={dataPoints}
              className="civic-kicker mb-2"
            >
              Watch Us In Action
            </DataPoint>
            <DataPoint
              name="choir.videos.title"
              as="h2"
              initialData={dataPoints}
              className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl"
            >
              Singing Out On The Streets
            </DataPoint>
            <DataPoint
              name="choir.videos.desc"
              as="p"
              initialData={dataPoints}
              className="text-xs sm:text-sm text-muted-foreground dark:text-ink-muted-on-dark mt-2"
            >
              Demonstrations at Fair Oaks Blvd & Manzanita Ave in Carmichael, CA.
            </DataPoint>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3 border-y border-border bg-surface-card p-4">
              <LiteYouTube
                videoId="BhdjDlRUMUw"
                title="Carmichael Resistance Choir Singing Demonstration 1"
                poster="/images/gallery/carmichael-resistance-choir.jpg"
              />
              <DataPoint
                name="choir.videos.v1_title"
                as="h3"
                initialData={dataPoints}
                className="font-bold text-foreground dark:text-white text-sm"
              >
                Rush Hour Singing Demonstration
              </DataPoint>
              <DataPoint
                name="choir.videos.v1_desc"
                as="p"
                initialData={dataPoints}
                className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
              >
                Carrying songs of peace, civil rights, and democratic defense to community drivers.
              </DataPoint>
            </div>

            <div className="space-y-3 border-y border-border bg-surface-card p-4">
              <div className="aspect-video overflow-hidden bg-surface-deep">
                {/* The original video (M631H68kLCE) was removed from YouTube. */}
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <Music size={28} className="text-accent-gold" aria-hidden="true" />
                  <p className="text-sm font-bold text-foreground dark:text-white">
                    Video no longer available
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                    The original recording was removed from YouTube. Watch the choir’s latest
                    performances on Instagram.
                  </p>
                  <a
                    href="https://instagram.com/CarmichaelResistanceChoir"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary-ink dark:border-white/15 dark:bg-white/5 dark:text-ink-on-dark dark:hover:text-accent-gold"
                  >
                    Watch on Instagram
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <DataPoint
                name="choir.videos.v2_title"
                as="h3"
                initialData={dataPoints}
                className="font-bold text-foreground dark:text-white text-sm"
              >
                Community Voices in Harmony
              </DataPoint>
              <DataPoint
                name="choir.videos.v2_desc"
                as="p"
                initialData={dataPoints}
                className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
              >
                Rehearsing chants and classic civil rights hymns for upcoming demonstrations.
              </DataPoint>
            </div>
          </div>
        </div>
    </>
  );
}
