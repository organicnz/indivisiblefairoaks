import { Pause, Play } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import type { ChoirSongTrack } from './choir-audio-tracks';

type ChoirStationListProps = {
  tracks: ChoirSongTrack[];
  activeTrack: ChoirSongTrack;
  isPlaying: boolean;
  dataPoints: Record<string, string>;
  displayDuration: (track: ChoirSongTrack) => string;
  onSelectTrack: (track: ChoirSongTrack) => void;
};

export function ChoirStationList({
  tracks,
  activeTrack,
  isPlaying,
  dataPoints,
  displayDuration,
  onSelectTrack,
}: ChoirStationListProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-foreground dark:text-ink-on-dark px-1">
        <DataPoint as="span" name="choir.player.stations_heading" initialData={dataPoints}>
          Community Stations & Anthems
        </DataPoint>
      </div>
      {tracks.map((track, idx) => {
        const isSelected = track.id === activeTrack.id;
        const trackTitle = track.titleKey
          ? dataPoints[track.titleKey] || track.defaultTitle
          : track.defaultTitle;
        return (
          <button
            key={track.id}
            type="button"
            onClick={() => onSelectTrack(track)}
            aria-pressed={isSelected}
            className={`w-full min-h-12 text-left px-4 py-3 rounded-2xl transition-all duration-300 ease-out flex items-center justify-between text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
              isSelected
                ? 'bg-primary/10 border border-primary/30 text-foreground dark:bg-primary-bright/20 dark:border-primary-bright/50 dark:text-white font-bold shadow-xs'
                : 'bg-surface-card border border-border text-muted-foreground hover:text-foreground hover:bg-surface-muted dark:bg-secondary/40 dark:border-transparent dark:text-ink-on-dark dark:hover:text-white dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-primary-ink dark:text-primary-on-dark text-xs font-bold shrink-0">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="truncate">{trackTitle}</span>
              {isSelected && isPlaying && (
                <span className="inline-flex size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[10px] text-muted-foreground dark:text-ink-muted-on-dark">
                {displayDuration(track)}
              </span>
              <span
                className={`size-6 rounded-full flex items-center justify-center ${
                  isSelected
                    ? 'bg-primary text-white dark:bg-primary-bright'
                    : 'bg-surface-muted text-foreground border border-border dark:border-transparent dark:bg-white/10 dark:text-ink-on-dark'
                }`}
              >
                {isSelected && isPlaying ? (
                  <Pause size={10} className="fill-current" />
                ) : (
                  <Play size={10} className="fill-current ml-0.5" />
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
