'use client';

import { Play } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

/**
 * A click-to-load YouTube surface. The old raw iframe requested YouTube on
 * every page view, before anyone asked for the video, and rendered as an empty
 * box while that request was blocked or still in flight. The poster is local,
 * the player is only mounted on intent, and the nocookie host avoids setting
 * YouTube's advertising cookies for readers who never press play.
 */
export function LiteYouTube({
  videoId,
  title,
  poster,
  className = '',
}: {
  videoId: string;
  title: string;
  poster: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={`relative aspect-video overflow-hidden bg-secondary ${className}`}>
      {playing ? (
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          <Image
            src={poster}
            alt=""
            fill
            loading="eager"
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/10 to-transparent"
          />
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play film: ${title}`}
            className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-gold"
          >
            <span className="flex size-16 items-center justify-center border border-white/40 bg-background/95 text-foreground transition-transform duration-300 group-hover:scale-105">
              <Play size={22} className="ml-0.5 fill-current" aria-hidden="true" />
            </span>
            <span className="absolute bottom-3 left-3 border border-white/20 bg-secondary/80 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              Play film
            </span>
          </button>
        </>
      )}
    </div>
  );
}
