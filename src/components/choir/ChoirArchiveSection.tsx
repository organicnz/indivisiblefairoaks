import { ArrowUpRight, Camera, ExternalLink, Music } from 'lucide-react';
import type { ComponentProps } from 'react';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';

type ChoirArchiveSectionProps = {
  legacyDocuments: ComponentProps<typeof LegacyDocumentArchive>['documents'];
};

export function ChoirArchiveSection({ legacyDocuments }: ChoirArchiveSectionProps) {
  return (
    <>
        {/* Historical choir material from the old Google Sites. */}
        <div className="space-y-5 border-y border-border bg-surface-card p-6 sm:p-8">
          <div>
            <div className="civic-stamp">
              <Music size={12} />
              From the Choir Archive
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
              The story, the film, and where we sing next
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              The old chapter site introduced the choir through a feature article, a short film, and
              the Instagram and Mobilize.us links we still use. Those records are preserved here.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="https://impact.scholasticahq.com/article/166557-breathing-together-on-joining-a-resistance-choir"
              target="_blank"
              rel="noopener noreferrer"
              className="group border-t border-foreground/25 pt-4 transition-colors hover:border-primary/60"
            >
              <span className="civic-meta">
                Feature article
              </span>
              <span className="mt-2 block text-sm font-bold leading-snug text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-accent-gold">
                “Breathing Together: On Joining a Resistance Choir”
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-ink dark:text-primary-on-dark">
                Read the story <ArrowUpRight size={12} />
              </span>
            </a>
            <a
              href="https://instagram.com/CarmichaelResistanceChoir"
              target="_blank"
              rel="noopener noreferrer"
              className="group border-t border-foreground/25 pt-4 transition-colors hover:border-primary/60"
            >
              <span className="civic-meta">
                Instagram
              </span>
              <span className="mt-2 flex items-center gap-2 text-sm font-bold leading-snug text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-accent-gold">
                <Camera size={16} className="text-accent-gold" />
                @CarmichaelResistanceChoir
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-ink dark:text-primary-on-dark">
                Visit the choir <ExternalLink size={12} />
              </span>
            </a>
            <a
              href="https://www.mobilize.us/indivisible/event/1072857/"
              target="_blank"
              rel="noopener noreferrer"
              className="group border-t border-foreground/25 pt-4 transition-colors hover:border-primary/60"
            >
              <span className="civic-meta">
                Next rehearsal
              </span>
              <span className="mt-2 block text-sm font-bold leading-snug text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-accent-gold">
                Register through Mobilize.us
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-ink dark:text-primary-on-dark">
                Sign up <ExternalLink size={12} />
              </span>
            </a>
          </div>
          {legacyDocuments.length > 0 ? (
            <div className="border-t border-border pt-5">
              <LegacyDocumentArchive
                documents={legacyDocuments}
                title="Choir film & documents"
                description="The original choir film and related files. Restricted or third-party media remains at its source; cleared files are hosted here."
                limit={4}
              />
            </div>
          ) : null}
        </div>
    </>
  );
}
