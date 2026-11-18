'use client';

import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Layers3,
  ShieldQuestion,
} from 'lucide-react';
import { iceSourceReportArchiveHref } from '@/lib/ice-source-report-search';
import { formatNumber } from './data';
import { buildRapidCityBrief } from './rapid-city-brief';
import type { PublicCase, RapidAlert, RapidFeedSource } from './rapid-types';
import { useCopyStatus } from './use-copy-status';
import { formatRelativeTime, isAlertActive } from './rapid-alert-utils';
import type { CityPoint } from './types';
import { useCitySourceSummary } from './use-city-source-summary';

type RapidCityWatchProps = {
  alert: RapidAlert;
  cityAlerts: RapidAlert[];
  publicCases: PublicCase[];
  historicalCity: CityPoint | null;
  community: RapidFeedSource | null;
  feedFromCache: boolean;
  now: number;
};

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-background p-2.5">
      <p className="font-display text-xl font-semibold leading-none tracking-[-0.035em]">
        {value}
      </p>
      <p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}

/**
 * A selected city is more useful than a single card. This brief keeps the
 * current feed, reviewed community cases, public-source archive, and FOIA
 * baseline in separate lanes so readers can see what each source actually
 * supports without turning overlap into a verification claim.
 */
export function RapidCityWatch({
  alert,
  cityAlerts,
  publicCases,
  historicalCity,
  community,
  feedFromCache,
  now,
}: RapidCityWatchProps) {
  const { copyState, copy } = useCopyStatus();
  const activeCount = cityAlerts.filter((item) => isAlertActive(item, now)).length;
  const sourceNames = [...new Set(cityAlerts.map((item) => item.sourceName))];
  const archive = useCitySourceSummary(alert.city, alert.stateCode);
  const archiveData = archive.data;
  const archiveHref = iceSourceReportArchiveHref({
    query: '',
    kind: 'all',
    city: alert.city,
    stateCode: alert.stateCode,
  });
  const historyHref = `/ice-alerts?view=history&foiaCity=${encodeURIComponent(
    alert.city
  )}&foiaState=${alert.stateCode}#historical-foia`;
  const recentArchive = archiveData?.recent.slice(0, 2) ?? [];
  const extractionMethods = [
    ...new Set(recentArchive.map((report) => report.extractionMethod)),
  ];

  const handleCopy = async () => {
    const brief = buildRapidCityBrief({
      place: alert.place,
      feedCount: cityAlerts.length,
      activeCount,
      sourceNames,
      feedStatus: community?.status ?? null,
      feedFromCache,
      reviewedCaseCount: publicCases.length,
      foiaCount: historicalCity?.count ?? null,
      archive: archiveData
        ? { total: archiveData.total, extractionMethods }
        : null,
      archiveUrl: `${window.location.origin}${archiveHref}`,
      mapUrl: `${window.location.origin}/ice-alerts?alert=${encodeURIComponent(
        alert.id
      )}`,
    });

    await copy(brief);
  };

  return (
    <section
      aria-labelledby="ice-city-watch-title"
      className="mt-4 border-t border-border pt-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.11em] text-accent">
          <Layers3 className="size-3.5" aria-hidden="true" />
          <span id="ice-city-watch-title">City watch</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-7 items-center gap-1 border border-border bg-background px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copyState === 'copied' ? (
              <Check className="size-2.5 text-accent" aria-hidden="true" />
            ) : (
              <Copy className="size-2.5" aria-hidden="true" />
            )}
            <span aria-live="polite">
              {copyState === 'copied'
                ? 'Brief copied'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy brief'}
            </span>
          </button>
          <span className="inline-flex items-center gap-1 border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <ShieldQuestion className="size-2.5" aria-hidden="true" />
            Separate lanes, not verification
          </span>
        </div>
      </div>

      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        All current-feed reports in this city, regardless of the active filters.
      </p>

      <div className="mt-2 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        <Stat
          label="Feed reports"
          value={formatNumber(cityAlerts.length)}
          detail="in this city"
        />
        <Stat
          label="Active <4h"
          value={formatNumber(activeCount)}
          detail="recent pulse"
        />
        <Stat
          label="Reviewed cases"
          value={formatNumber(publicCases.length)}
          detail="published city cases"
        />
        <Stat
          label="FOIA baseline"
          value={historicalCity ? formatNumber(historicalCity.count) : 'No match'}
          detail="latest release"
        />
      </div>

      {sourceNames.length > 0 ? (
        <p className="mt-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Feed {sourceNames.length === 1 ? 'source' : 'sources'}: {sourceNames.join(' · ')}
        </p>
      ) : null}

      <div className="mt-2.5 grid gap-2 lg:grid-cols-2">
        <div
          aria-live="polite"
          className="border border-border bg-background p-2.5"
        >
          <p className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground">
            <Archive className="size-3" aria-hidden="true" />
            Public source archive
          </p>

          {(archive.status === 'loading' || archive.status === 'idle') && !archiveData ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Checking archived source reports for this city…
            </p>
          ) : null}

          {archiveData ? (
            <>
              <p className="mt-1.5 text-[11px] leading-relaxed text-foreground">
                <strong className="font-semibold">
                  {formatNumber(archiveData.total)}
                </strong>{' '}
                archived {archiveData.total === 1 ? 'report' : 'reports'} indexed for this
                city.
              </p>
              {archive.status === 'loading' ? (
                <p className="mt-0.5 text-[9px] text-muted-foreground">Refreshing archive count…</p>
              ) : null}
              {archive.status === 'error' ? (
                <p className="mt-0.5 text-[9px] text-accent">
                  Refresh failed; showing the last checked summary.
                </p>
              ) : null}
              {recentArchive.length > 0 ? (
                <ul className="mt-1.5 space-y-1 border-t border-border pt-1.5">
                  {recentArchive.map((report) => (
                    <li key={report.id}>
                      <a
                        href={report.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start justify-between gap-2 text-[10px] leading-snug text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="min-w-0 flex-1">{report.displayTitle}</span>
                        <span className="shrink-0 font-mono text-[8px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                          {formatRelativeTime(report.publishedAt, now)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {extractionMethods.length > 0 ? (
                <p className="mt-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                  Indexed via {extractionMethods.join(' / ')}
                </p>
              ) : null}
            </>
          ) : null}

          {!archiveData && archive.status === 'error' ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              The public source archive could not be checked right now. The live feed and
              historical FOIA lanes above are still available.
            </p>
          ) : null}

          <a
            href={archiveHref}
            className="mt-2 inline-flex min-h-7 items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Search this city in the archive
            <ArrowUpRight className="size-2.5" aria-hidden="true" />
          </a>
        </div>

        <div className="border border-border bg-background p-2.5">
          <p className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground">
            <BookOpen className="size-3" aria-hidden="true" />
            Context lanes
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground">
            {historicalCity ? (
              <>
                <strong className="font-semibold">
                  {formatNumber(historicalCity.count)}
                </strong>{' '}
                FOIA records in the latest city-level release.
              </>
            ) : (
              'No FOIA city match in the current historical release.'
            )}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {publicCases.length === 0
              ? 'No reviewed community case has been published for this city. Raw submissions stay private and are never shown here.'
              : `${formatNumber(publicCases.length)} reviewed community ${
                  publicCases.length === 1 ? 'case is' : 'cases are'
                } published for this city.`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <a
              href={historyHref}
              className="inline-flex min-h-7 items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Historical context
              <ArrowRight className="size-2.5" aria-hidden="true" />
            </a>
            <a
              href="#reviewed-reports"
              className="inline-flex min-h-7 items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Reviewed reports
              <ArrowRight className="size-2.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
        These lanes may overlap and the archive can lag the live feed. They are not independent
        confirmation. Archive links open the original publisher; the map still shows city
        centroids only.
      </p>
    </section>
  );
}
