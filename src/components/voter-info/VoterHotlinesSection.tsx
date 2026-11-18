import { Phone } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type VoterHotlinesSectionProps = {
  dataPoints: Record<string, string>;
};

export function VoterHotlinesSection({ dataPoints }: VoterHotlinesSectionProps) {
  return (
    <>
        {/* Official County Contacts & Hotlines — copy region */}
        <div
          id="hotlines"
          className="scroll-mt-28 space-y-6 border-y border-border bg-surface-card p-8"
        >
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-[-0.03em]">
            <Phone className="text-accent dark:text-accent-gold" />
            <DataPoint initialData={dataPoints} as="span" name="voter.hotlines.headline">
              Sacramento County Elections & Voter Hotlines
            </DataPoint>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark">
            <DataPoint initialData={dataPoints} as="span" name="voter.hotlines.subhead">
              Need assistance casting your ballot or report election irregularities.
            </DataPoint>
          </p>
          <CopyRegion id="voter-hotlines">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark">
              <div className="space-y-2">
                <DataPoint
                  initialData={dataPoints}
                  name="voter.hotlines.office_title"
                  as="strong"
                  className="text-foreground dark:text-white block text-base"
                >
                  Sacramento County Elections Office
                </DataPoint>
                <DataPoint initialData={dataPoints} name="voter.hotlines.office_address" as="p">
                  7000 65th Street, Suite A, Sacramento, CA 95823
                </DataPoint>
                <p>
                  <strong>Phone:</strong>{' '}
                  <DataPoint initialData={dataPoints} name="voter.hotlines.office_phone" as="span">
                    (916) 875-6451
                  </DataPoint>
                </p>
                <p>
                  <strong>Toll-Free:</strong>{' '}
                  <DataPoint
                    initialData={dataPoints}
                    name="voter.hotlines.office_tollfree"
                    as="span"
                  >
                    1-800-762-8019
                  </DataPoint>
                </p>
                <p>
                  <strong>Email:</strong>{' '}
                  <a
                    href="mailto:voterinfo@saccounty.gov"
                    className="text-primary-ink dark:text-primary-on-dark-muted hover:underline"
                  >
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.hotlines.office_email"
                      as="span"
                    >
                      voterinfo@saccounty.gov
                    </DataPoint>
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <DataPoint
                  initialData={dataPoints}
                  name="voter.hotlines.national_title"
                  as="strong"
                  className="text-foreground dark:text-white block text-base"
                >
                  Nonpartisan Election Protection Hotlines
                </DataPoint>
                <DataPoint initialData={dataPoints} name="voter.hotlines.national_desc" as="p">
                  If you encounter issues voting, call the national nonpartisan hotlines:
                </DataPoint>
                <p>
                  <strong>English:</strong>{' '}
                  <DataPoint initialData={dataPoints} name="voter.hotlines.english" as="span">
                    1-866-OUR-VOTE (1-866-687-8683)
                  </DataPoint>
                </p>
                <p>
                  <strong>Spanish:</strong>{' '}
                  <DataPoint initialData={dataPoints} name="voter.hotlines.spanish" as="span">
                    1-888-VE-Y-VOTA (1-888-839-8682)
                  </DataPoint>
                </p>
                <p>
                  <strong>Asian Languages:</strong>{' '}
                  <DataPoint
                    initialData={dataPoints}
                    name="voter.hotlines.asian_languages"
                    as="span"
                  >
                    1-888-API-VOTE (1-888-274-8683)
                  </DataPoint>
                </p>
              </div>
            </div>
          </CopyRegion>
        </div>
    </>
  );
}
