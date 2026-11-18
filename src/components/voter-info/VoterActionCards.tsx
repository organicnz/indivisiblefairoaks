import { CheckCircle2, ExternalLink, Search, Vote } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type VoterActionCardsProps = {
  dataPoints: Record<string, string>;
};

export function VoterActionCards({ dataPoints }: VoterActionCardsProps) {
  return (
    <>
        {/* Quick Action Cards */}
        <div id="register" className="scroll-mt-28 grid grid-cols-1 gap-0 border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
          <a
            href="https://registertovote.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-6 transition-colors hover:bg-surface-muted"
          >
            <div>
              <div className="mb-4 flex size-11 items-center justify-center border border-border bg-background text-primary-ink">
                <Vote size={24} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.action.register_title"
                as="h2"
                className="text-xl font-bold text-foreground dark:text-white mb-2"
              >
                Register to Vote Online
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.action.register_desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                Register or update your address and party affiliation through the California
                Secretary of State portal.
              </DataPoint>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-accent-gold">
              <span>registertovote.ca.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href="https://wheresmyballot.sos.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-6 transition-colors hover:bg-surface-muted"
          >
            <div>
              <div className="mb-4 flex size-11 items-center justify-center border border-border bg-background text-accent">
                <Search size={24} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.action.track_title"
                as="h2"
                className="text-xl font-bold text-foreground dark:text-white mb-2"
              >
                Track Your Ballot
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.action.track_desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                Sign up for &ldquo;Where&apos;s My Ballot?&rdquo; to receive automatic text and
                email updates when your mail-in ballot is received and counted.
              </DataPoint>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-accent-gold">
              <span>wheresmyballot.sos.ca.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href="https://elections.saccounty.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-6 transition-colors hover:bg-surface-muted"
          >
            <div>
              <div className="mb-4 flex size-11 items-center justify-center border border-border bg-background text-primary-ink">
                <CheckCircle2 size={24} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.action.elections_title"
                as="h2"
                className="text-xl font-bold text-foreground dark:text-white mb-2"
              >
                Sacramento Elections
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.action.elections_desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                Official Sacramento County Voter Registration & Elections Division: find Vote Center
                locations and drop boxes.
              </DataPoint>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span>elections.saccounty.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>
        </div>
    </>
  );
}
