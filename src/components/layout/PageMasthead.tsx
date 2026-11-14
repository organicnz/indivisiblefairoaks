import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared type recipes so every page masthead reads as one publication. */
export const MASTHEAD_TITLE =
  'font-display text-[clamp(2.8rem,6.2vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-foreground';

/** Legal and reference pages read as documents, not landing pages. */
export const MASTHEAD_TITLE_DOCUMENT =
  'font-display text-[clamp(2.35rem,4vw,3.65rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground';

export const MASTHEAD_INTRO = 'max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg';

type PageMastheadProps = {
  /** Small uppercase label above the title. Pass a DataPoint when editable. */
  eyebrow: ReactNode;
  /** The page's own icon, used in the stamped panel on wide screens. */
  icon: LucideIcon;
  /** Optional real content plate for pages with stronger visual material. */
  visual?: ReactNode;
  /** The page h1. Pass a DataPoint so the CMS keeps ownership of the copy. */
  title: ReactNode;
  /** One-sentence standfirst. Pass a DataPoint when editable. */
  intro?: ReactNode;
  /** Optional row below the intro (actions, metadata, an anchor link). */
  meta?: ReactNode;
  /** Shorter, quieter treatment for legal and reference documents. */
  compact?: boolean;
  className?: string;
};

/**
 * Left-aligned editorial masthead shared by every public page.
 *
 * The previous page headers were centred pills over a different atmospheric
 * shader on each route. That made navigation feel like seven unrelated
 * microsites and pushed every h1 into the same generic template. This masthead
 * gives the site one recognisable front page grammar: a printed rule, a serif
 * display line, a restrained standfirst, and one stamped icon panel — or a real
 * content plate where the page has something better to show.
 */
export function PageMasthead({
  eyebrow,
  icon: Icon,
  visual,
  title,
  intro,
  meta,
  compact = false,
  className = '',
}: PageMastheadProps) {
  return (
    <section
      className={`relative overflow-hidden border-b border-border bg-background ${className}`}
    >
      <div
        aria-hidden="true"
        className="paper-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div
        className={`relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${
          compact ? 'py-10 md:py-12 lg:py-14' : 'py-12 md:py-16 lg:py-20'
        }`}
      >
        <div className="grid grid-cols-12 items-end gap-x-4 gap-y-10 sm:gap-x-8">
          <div className="col-span-12 min-w-0 lg:col-span-8">
            <div className="civic-kicker">{eyebrow}</div>
            <div className="mt-5">{title}</div>
            {intro ? (
              <div className="mt-6 border-l-2 border-accent pl-4 sm:pl-5">{intro}</div>
            ) : null}

            <div className="mt-7 flex items-center gap-3 lg:hidden" aria-hidden="true">
              <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden border border-foreground/20 bg-surface-card">
                <span className="civic-plate-halftone absolute inset-0" />
                <span className="absolute left-1.5 top-1.5 size-1.5 bg-accent" />
                <Icon aria-hidden="true" strokeWidth={0.9} className="relative size-5 text-primary" />
              </span>
              <span className="h-px flex-1 bg-foreground/20" />
              <span className="civic-meta whitespace-nowrap text-[9px]">
                Fair Oaks &middot; Carmichael
              </span>
            </div>

            {meta ? <div className="mt-7">{meta}</div> : null}
          </div>

          <div className="hidden lg:col-span-4 lg:flex lg:justify-end">
            {visual ?? (
              <div className="relative" aria-hidden="true">
                <div className="absolute -left-3 -top-3 h-full w-full border border-accent/70" />
                <div className="absolute -bottom-3 -right-3 h-full w-full border border-primary/25" />
                <div
                  className={`civic-plate relative flex aspect-square items-center justify-center overflow-hidden border border-foreground/25 ${
                    compact ? 'w-32 xl:w-36' : 'w-44 xl:w-52'
                  }`}
                >
                  <span className="civic-plate-halftone absolute inset-0" />
                  <span className="absolute inset-2 border border-foreground/10" />
                  <span className="absolute left-3 top-3 z-10 size-2 bg-accent" />
                  <span className="absolute right-3 top-3 z-10 h-px w-8 bg-foreground/30" />

                  <div
                    className={`relative flex items-center justify-center ${
                      compact ? 'size-24' : 'size-36 xl:size-40'
                    }`}
                  >
                    <span className="civic-plate-ticks absolute inset-0" />
                    <span className="absolute inset-4 rounded-full border border-foreground/15" />
                    <Icon
                      aria-hidden="true"
                      strokeWidth={0.7}
                      className={`absolute translate-x-1 translate-y-1 text-accent opacity-20 ${
                        compact ? 'size-14' : 'size-24'
                      }`}
                    />
                    <Icon
                      aria-hidden="true"
                      strokeWidth={0.7}
                      className={`relative text-primary ${compact ? 'size-14' : 'size-24'}`}
                    />
                  </div>

                  <span
                    className={`absolute inset-x-3 bottom-3 z-10 flex items-center justify-between font-mono font-bold uppercase text-muted-foreground ${
                      compact ? 'text-[6px] tracking-[0.08em]' : 'text-[7px] tracking-[0.14em]'
                    }`}
                  >
                    <span>Fair Oaks</span>
                    <span>Carmichael</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}