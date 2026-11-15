'use client';

import { ImageOff, RefreshCw, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import type { CityPoint } from './types';
import {
  useIceCaseBrief,
  type IceCaseBriefData,
  type IceCaseImage,
} from './use-ice-case-brief';

type IceCaseBriefProps = {
  city: CityPoint;
};

function BriefImage({ image }: { image: IceCaseImage }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 border border-border bg-surface-muted px-3 text-center">
        <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Reference image unavailable
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] overflow-hidden border border-border bg-surface-muted">
      <Image
        src={image.url}
        alt={image.alt}
        fill
        unoptimized
        sizes="(min-width: 1024px) 22rem, 100vw"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function BriefBody({ data }: { data: IceCaseBriefData }) {
  return (
    <div className="mt-3">
      <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
        {data.headline}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.brief}</p>

      {data.image ? (
        <figure className="mt-3">
          <BriefImage key={data.image.url} image={data.image} />
          <figcaption className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            City reference image, not a case photograph. {data.image.credit}
            {data.image.license ? ' · ' : ''}
            {data.image.licenseUrl ? (
              <a
                href={data.image.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
              >
                {data.image.license}
              </a>
            ) : (
              data.image.license
            )}
            {' · '}
            <a
              href={data.image.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
            >
              Wikimedia Commons
            </a>
          </figcaption>
        </figure>
      ) : (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-muted px-3 py-5 text-center">
          <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            No case photographs
          </p>
          <p className="max-w-[24ch] text-[10px] leading-relaxed text-muted-foreground">
            This FOIA release contains city totals only; it has no images from individual cases.
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {data.caveats.map((caveat, index) => (
          <li
            key={`${index}-${caveat}`}
            className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground"
          >
            <span className="mt-[0.35em] size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span>{caveat}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-accent/20 pt-2 text-[10px] leading-relaxed text-muted-foreground">
        {data.imageNotice} Generated {data.generatedBy === 'ai' ? 'by AI ' : ''}from the
        published city total, not from a case file.{' '}
        {data.generatedBy === 'ai' ? 'AI text can be wrong; verify against the source. ' : ''}
        Not legal advice.{' '}
        <a
          href={data.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
        >
          Data source
        </a>
      </p>
    </div>
  );
}

export function IceCaseBrief({ city }: IceCaseBriefProps) {
  const { state, retry } = useIceCaseBrief(city);

  return (
    <section
      aria-labelledby="ice-ai-brief-title"
      aria-busy={state.status === 'loading'}
      className="mt-4 border-t border-accent/30 pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
          <h3
            id="ice-ai-brief-title"
            className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            AI context brief
          </h3>
        </div>
        <span className="civic-stamp">
          {state.status === 'ready'
            ? state.data.generatedBy === 'dataset'
              ? 'Snapshot note'
              : 'AI-generated'
            : state.status === 'error'
              ? 'Unavailable'
              : 'Generating'}
        </span>
      </div>

      {state.status === 'idle' || state.status === 'loading' ? (
        <div role="status" className="mt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Generating a grounded city brief…
          </p>
          <div className="mt-2 space-y-1.5" aria-hidden="true">
            <span className="block h-2 w-full bg-border" />
            <span className="block h-2 w-11/12 bg-border" />
            <span className="block h-2 w-4/5 bg-border" />
          </div>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div role="status" className="mt-3 border border-border bg-surface-muted p-3">
          <p className="text-xs font-semibold leading-relaxed text-foreground">
            {state.message}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            The city total above is still from the published snapshot.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 inline-flex min-h-8 items-center gap-1.5 border border-border bg-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}

      {state.status === 'ready' ? <BriefBody data={state.data} /> : null}
    </section>
  );
}
