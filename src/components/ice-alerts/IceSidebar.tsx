import { Database, ExternalLink, MapPin, X } from 'lucide-react';
import { IceCaseBrief } from './IceCaseBrief';
import { TOP_CITY_LIMIT } from './constants';
import {
  DATA,
  cityKey,
  cityRank,
  citySharePercent,
  formatDateLabel,
  formatNumber,
} from './data';
import type { CityPoint } from './types';

type IceSidebarProps = {
  selectedCity: CityPoint | null;
  onSelectCity: (city: CityPoint) => void;
  onClearSelectedCity: () => void;
};

export function IceSidebar({ selectedCity, onSelectCity, onClearSelectedCity }: IceSidebarProps) {
  const topCities = DATA.cities.slice(0, TOP_CITY_LIMIT);
  const selectedRank = selectedCity ? cityRank(selectedCity) : null;
  const selectedShare = selectedCity ? citySharePercent(selectedCity) : null;

  return (
    <div className="min-w-0 space-y-5">
      <section className="border border-border bg-surface-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="civic-section-index">Snapshot at a glance</p>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-3xl">
              A national picture, city by city.
            </h2>
          </div>
          <MapPin className="size-6 shrink-0 text-accent" aria-hidden="true" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The circles group nearby city totals built from the city named in each ICE arrest
          record. They are not a record of where every enforcement action happened, and they are
          not live.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
          <div className="bg-surface-muted p-3">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Mapped records
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {formatNumber(DATA.meta.mappedRecords)}
            </p>
          </div>
          <div className="bg-surface-muted p-3">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              City points
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {formatNumber(DATA.meta.mappedCities)}
            </p>
          </div>
          <div className="bg-surface-muted p-3">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Coverage
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {(DATA.meta.mappedShareOfAll * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-surface-muted p-3">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Highest city total
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {formatNumber(DATA.meta.maxCityCount)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Coverage is the share of all de-duplicated arrest records with a usable U.S. city
          and coordinates. The rest remain in the source data but are not on this map.
        </p>
      </section>

      <section aria-labelledby="ice-top-cities-title" className="border border-border bg-surface-card">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="civic-section-index">Highest assigned counts</p>
              <h2
                id="ice-top-cities-title"
                className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl"
              >
                Cities in the snapshot
              </h2>
            </div>
            <span className="civic-stamp">Top {TOP_CITY_LIMIT}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Select a city in this list or open a city dot or cluster popup on the map to see
            its assigned count and context brief.
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {topCities.map((city, index) => {
            const selected = selectedCity ? cityKey(city) === cityKey(selectedCity) : false;
            return (
              <button
                key={cityKey(city)}
                type="button"
                onClick={() => onSelectCity(city)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 border-b border-border p-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                  selected ? 'border-l-2 border-l-accent bg-accent/5' : ''
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                    {city.city}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {city.state}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-bold tabular-nums text-foreground">
                    {formatNumber(city.count)}
                  </span>
                  <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    records
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedCity ? (
        <section
          aria-live="polite"
          aria-labelledby="ice-selected-city-title"
          className="border border-accent/40 bg-accent/5 p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="civic-section-index">Selected city</p>
              <h2
                id="ice-selected-city-title"
                className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.035em]"
              >
                {selectedCity.city}, {selectedCity.stateCode}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClearSelectedCity}
              aria-label="Clear selected city"
              className="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Assigned records
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
                {formatNumber(selectedCity.count)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                National rank
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
                #{selectedRank}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {selectedShare}% of mapped records. The circle is a Census place point, not an exact
            arrest address.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            This FOIA extract is aggregated by city; it does not include individual names, case
            narratives, or photographs. Every record represents a person, and the brief below
            explains the selected total without inventing their identity. It is not a case file.
          </p>
          <IceCaseBrief city={selectedCity} />
        </section>
      ) : null}

      <section className="border border-border bg-surface-muted p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="civic-section-index">Source &amp; release</p>
            <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.02em]">
              Latest FOIA release: {formatDateLabel(DATA.meta.periodEnd)}.
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {DATA.meta.sourceRelease} {DATA.meta.sourceName} is a processed release of
              government records provided to the Deportation Data Project through FOIA
              litigation.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Checked {formatDateLabel(DATA.meta.releaseCheckedAt)}; no newer ICE release was
              available. The page does not present the snapshot as a current live feed.
            </p>
            <p className="mt-2 break-words text-[10px] leading-relaxed text-muted-foreground">
              {DATA.meta.sourceCitation} Coordinates are U.S. Census Bureau 2025 place
              internal points, with manual coordinates for selected cities and neighborhoods.
            </p>
            <a
              href={DATA.meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Read the source
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
