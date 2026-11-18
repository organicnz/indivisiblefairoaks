import { DataPoint } from '@/components/ui/DataPoint';

type GallerySubmitCtaProps = {
  dataPoints: Record<string, string>;
};

export function GallerySubmitCta({ dataPoints }: GallerySubmitCtaProps) {
  return (
    <div className="mx-auto mt-16 max-w-3xl space-y-4 border-y border-border bg-surface-card p-8 text-center sm:p-10">
      <DataPoint
        initialData={dataPoints}
        as="h2"
        name="gallery.cta.title"
        className="font-display text-3xl font-semibold tracking-[-0.03em]"
      >
        Have Sacramento Resistance Pics, Unity Shots, or Funny Signs?
      </DataPoint>
      <DataPoint
        initialData={dataPoints}
        as="p"
        name="gallery.cta.desc"
        className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark"
      >
        Did you snap a brilliant, witty cardboard sign, an uplifting choir moment, or neighbors
        standing in solidarity? Strictly grassroots (zero politicians, zero corporate imagery) —
        send your photos to our media circle to be included!
      </DataPoint>
      <div className="pt-2">
        <a
          href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
          className="inline-flex min-h-11 items-center border border-primary bg-primary px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
        >
          <DataPoint initialData={dataPoints} as="span" name="gallery.cta.button">
            Submit Grassroots Photos
          </DataPoint>
        </a>
      </div>
    </div>
  );
}
