import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared type recipes so every page masthead reads as one publication. */
export const MASTHEAD_TITLE =
  'font-display text-[clamp(2.8rem,6.2vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-foreground';

export const MASTHEAD_INTRO = 'max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg';

type PageMastheadProps = {
  /** Small uppercase label above the title. Pass a DataPoint when editable. */
  eyebrow: ReactNode;
  /** The page's own icon, used in the stamped panel on wide screens. */
  icon: LucideIcon;
  /** The page h1. Pass a DataPoint so the CMS keeps ownership of the copy. */
  title: ReactNode;
  /** One-sentence standfirst. Pass a DataPoint when editable. */
  intro?: ReactNode;
  /** Optional row below the intro (actions, metadata, an anchor link). */
  meta?: ReactNode;
  className?: string;
};

/**
 * Left-aligned editorial masthead shared by every public page.
 *
 * The previous page headers were centred pills over a different atmospheric
 * shader on each route. That made navigation feel like seven unrelated
 * microsites and pushed every h1 into the same generic template. This masthead
 * gives the site one recognisable front page grammar: a printed rule, a serif
 * display line, a restrained standfirst, and one stamped icon panel.
 */
export function PageMasthead({
  eyebrow,
  icon: Icon,
  title,
  intro,
  meta,
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
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8 lg:py-20">
        <div className="grid grid-cols-12 items-end gap-x-4 gap-y-10 sm:gap-x-8">
          <div className="col-span-12 min-w-0 lg:col-span-8">
            <div className="civic-kicker">{eyebrow}</div>
            <div className="mt-5">{title}</div>
            {intro ? (
              <div className="mt-6 border-l-2 border-accent pl-4 sm:pl-5">{intro}</div>
            ) : null}
            {meta ? <div className="mt-7">{meta}</div> : null}
          </div>

          <div className="hidden lg:col-span-4 lg:flex lg:justify-end">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -left-3 -top-3 h-full w-full border border-accent/70"
              />
              <div className="relative flex aspect-square w-44 items-center justify-center border border-foreground/25 bg-surface-card xl:w-52">
                <Icon aria-hidden="true" strokeWidth={0.7} className="size-24 text-primary" />
                <span aria-hidden="true" className="absolute left-3 top-3 size-2 bg-accent" />
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 right-3 h-px w-10 bg-foreground/30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}