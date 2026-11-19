import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared type recipes so every page masthead reads as one publication. */
export const MASTHEAD_TITLE =
  'text-balance font-display text-[clamp(2.8rem,6.2vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-foreground';

/** Legal and reference pages read as documents, not landing pages. */
export const MASTHEAD_TITLE_DOCUMENT =
  'text-balance font-display text-[clamp(2.35rem,4vw,3.65rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground';

export const MASTHEAD_INTRO =
  'max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg';

/** Section headings below a page masthead, one step below the h1. */
export const SECTION_TITLE =
  'text-balance font-display text-3xl font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-4xl';

type PageMastheadProps = {
  /** Small uppercase label above the title. Pass a DataPoint when editable. */
  eyebrow: ReactNode;
  /** The page's own icon, used by the default desktop plate. */
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
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-28 hidden select-none font-display text-[26rem] leading-none text-foreground/[0.025] md:block print:hidden"
      >
        §
      </span>
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

            {meta ? <div className="mt-7">{meta}</div> : null}
          </div>

          <div className="hidden min-w-0 lg:col-span-4 lg:flex lg:justify-end">
            {visual ?? (
              <div aria-hidden="true" className="relative shrink-0">
                {/* Registration ticks give the plate the feel of a trimmed
                    proof sheet, while the offset stock keeps it from looking
                    like a generic icon tile. */}
                <span className="absolute -left-2 -top-2 size-4 border-l border-t border-foreground/35" />
                <span className="absolute -bottom-2 -right-2 size-4 border-b border-r border-foreground/35" />
                <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 border border-foreground/20 bg-surface-deep/60" />
                <div
                  className={`relative flex aspect-square flex-col items-center justify-center border border-foreground/30 bg-surface-card ${
                    compact ? 'w-32 xl:w-36' : 'w-44 xl:w-52'
                  }`}
                >
                  <span className="absolute left-2 top-2 size-1.5 bg-accent" />
                  <Icon
                    aria-hidden="true"
                    strokeWidth={0.7}
                    className={`text-primary ${compact ? 'size-14' : 'size-24 xl:size-28'}`}
                  />
                  <span className="absolute inset-x-2 bottom-2 flex items-center justify-between border-t border-foreground/15 pt-1 font-mono text-[7px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    <span>{compact ? 'Ref.' : 'Chapter file'}</span>
                    <span>No. 01</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-4 h-0.5 w-16 bg-accent sm:left-6 lg:left-8"
        />
      </div>
    </section>
  );
}
