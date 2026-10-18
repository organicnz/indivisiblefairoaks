'use client';

import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Music,
  Pause,
  Play,
  Radio,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { getStorageUrl } from '@/lib/supabase';

interface SongTrack {
  id: string;
  titleKey: string;
  artistKey: string;
  notesKey: string;
  defaultTitle: string;
  defaultArtist: string;
  defaultNotes: string;
  duration: string;
  audioUrl?: string;
}

const DEFAULT_TRACKS: SongTrack[] = [
  {
    id: 'anthem-1',
    titleKey: 'choir.player.track1_title',
    artistKey: 'choir.player.track1_artist',
    notesKey: 'choir.player.track1_notes',
    defaultTitle: 'America the Beautiful',
    defaultArtist: 'U.S. Navy Band Sea Chanters Choral',
    defaultNotes: 'Official public domain choral arrangement of Katherine Lee Bates anthem',
    duration: '2:21',
    audioUrl: 'audio/america-the-beautiful.ogg',
  },
  {
    id: 'anthem-2',
    titleKey: 'choir.player.track2_title',
    artistKey: 'choir.player.track2_artist',
    notesKey: 'choir.player.track2_notes',
    defaultTitle: 'The Star-Spangled Banner',
    defaultArtist: "U.S. Army Field Band & Soldiers' Chorus",
    defaultNotes: "Choral anthem with band accompaniment by the Soldiers' Chorus",
    duration: '1:29',
    audioUrl: 'audio/star-spangled-banner.ogg',
  },
  {
    id: 'anthem-3',
    titleKey: 'choir.player.track3_title',
    artistKey: 'choir.player.track3_artist',
    notesKey: 'choir.player.track3_notes',
    defaultTitle: 'Battle Hymn of the Republic',
    defaultArtist: 'U.S. Air Force Band & Singing Sergeants Choral',
    defaultNotes:
      'Historical choral rallying anthem for collective resilience, justice, and solidarity',
    duration: '5:27',
    audioUrl: 'audio/battle-hymn-of-the-republic.ogg',
  },
  {
    id: 'anthem-4',
    titleKey: 'choir.player.track4_title',
    artistKey: 'choir.player.track4_artist',
    notesKey: 'choir.player.track4_notes',
    defaultTitle: 'Ode to Joy (Anthem of Peace & Europe)',
    defaultArtist: 'U.S. Navy Band Choral & Concert Orchestra',
    defaultNotes: 'Universal anthem of brotherhood, human dignity, democracy, and solidarity',
    duration: '1:56',
    audioUrl: 'audio/ode-to-joy.ogg',
  },
  {
    id: 'anthem-5',
    titleKey: 'choir.player.track5_title',
    artistKey: 'choir.player.track5_artist',
    notesKey: 'choir.player.track5_notes',
    defaultTitle: 'Ave Maria (Sacred Choral)',
    defaultArtist: 'Sea Chanters Choral Ensemble',
    defaultNotes: 'Anton Bruckner choral presentation performed by U.S. Navy Band Sea Chanters',
    duration: '3:14',
    audioUrl: 'audio/ave-maria.ogg',
  },
];

export function ChoirAudioPlayer() {
  const { dataPoints } = useDataPoints('choir');
  // Durations are seeded beside the titles — the key mirrors the title key
  // (`choir.player.trackN_title` → `choir.player.trackN_duration`) — so a
  // revised recording length is editable without a deploy.
  const displayDuration = (track: SongTrack) =>
    (track.titleKey ? dataPoints[`${track.titleKey.replace(/_title$/, '')}_duration`] : '') ||
    track.duration;
  const [tracks, setTracks] = useState<SongTrack[]>(DEFAULT_TRACKS);
  const [activeTrack, setActiveTrack] = useState<SongTrack>(DEFAULT_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [volume, setVolume] = useState(0.15);
  const [previousVolume, setPreviousVolume] = useState(0.15);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [showCustomBar, setShowCustomBar] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [visualizerBars, setVisualizerBars] = useState<{ id: string; height: number }[]>(() =>
    Array.from({ length: 14 }, (_, i) => ({ id: `bar-${i}`, height: 25 + (i % 4) * 15 }))
  );

  const BROADCAST_LENGTH_SECONDS = 150;

  const playActiveTrack = useCallback(
    (track: SongTrack) => {
      setStreamError(null);
      const baseKey = track.titleKey ? track.titleKey.replace(/_title$/, '') : '';
      const configuredUrl =
        (baseKey ? dataPoints[`${baseKey}_url`] : undefined) ||
        (track.titleKey ? dataPoints[`${track.titleKey}_url`] : undefined);
      const effectiveAudioUrl = configuredUrl || track.audioUrl;

      if (effectiveAudioUrl && audioElRef.current) {
        const resolvedSrc = getStorageUrl(effectiveAudioUrl, 'media');
        if (audioElRef.current.src !== resolvedSrc) {
          audioElRef.current.src = resolvedSrc;
        }
        audioElRef.current.volume = volume;
        audioElRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err: unknown) => {
            if (err instanceof Error && err.name === 'AbortError') {
              return;
            }
            setStreamError(
              dataPoints['choir.player.stream_err_msg'] ||
                'Audio stream temporarily unreachable. Tap Retry or select another station.'
            );
            setIsPlaying(false);
          });
      } else {
        setStreamError('No audio source configured for this station.');
        setIsPlaying(false);
      }
    },
    [dataPoints, volume]
  );

  const togglePlay = () => {
    if (isPlaying) {
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      playActiveTrack(activeTrack);
    }
  };

  const selectTrack = (track: SongTrack) => {
    setActiveTrack(track);
    setPlaybackTime(0);
    if (isPlaying) {
      playActiveTrack(track);
    }
  };

  const selectRelativeTrack = (offset: number) => {
    const index = tracks.findIndex((track) => track.id === activeTrack.id);
    const nextIndex = (index + offset + tracks.length) % tracks.length;
    selectTrack(tracks[nextIndex]);
  };

  const handleCustomStreamSubmit = (e: FormEvent) => {
    e.preventDefault();
    const rawUrl = customUrlInput.trim();
    if (!rawUrl) return;

    let resolvedUrl = rawUrl;
    const isS3 =
      rawUrl.startsWith('s3://') ||
      (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'));

    if (rawUrl.startsWith('s3://')) {
      const cleanS3Path = rawUrl.replace(/^s3:\/\/(media\/)?/, '');
      resolvedUrl = getStorageUrl(cleanS3Path, 'media');
    } else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      resolvedUrl = getStorageUrl(rawUrl, 'media');
    }

    const customTrack: SongTrack = {
      id: `custom-${Date.now()}`,
      titleKey: '',
      artistKey: '',
      notesKey: '',
      defaultTitle: customTitleInput.trim() || 'Custom Stream Broadcast',
      defaultArtist: isS3 ? 'Supabase S3 Audio' : 'External Audio Stream',
      defaultNotes: rawUrl,
      duration: 'LIVE',
      audioUrl: resolvedUrl,
    };

    setTracks((prev) => [customTrack, ...prev]);
    setActiveTrack(customTrack);
    setCustomUrlInput('');
    setCustomTitleInput('');
    playActiveTrack(customTrack);
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
      if (audioElRef.current) audioElRef.current.volume = 0;
    } else {
      const restored = previousVolume || 0.15;
      setVolume(restored);
      if (audioElRef.current) audioElRef.current.volume = restored;
    }
  };

  // Animate visualizer bars when playing
  useEffect(() => {
    if (!isPlaying) {
      setVisualizerBars(
        Array.from({ length: 14 }, (_, i) => ({ id: `bar-${i}`, height: 20 + (i % 3) * 15 }))
      );
      return;
    }

    const interval = setInterval(() => {
      setVisualizerBars(() =>
        Array.from({ length: 14 }, (_, i) => ({
          id: `bar-${i}`,
          height: Math.floor(Math.random() * 80) + 20,
        }))
      );
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeTitle = activeTrack.titleKey
    ? dataPoints[activeTrack.titleKey] || activeTrack.defaultTitle
    : activeTrack.defaultTitle;
  const activeArtist = activeTrack.artistKey
    ? dataPoints[activeTrack.artistKey] || activeTrack.defaultArtist
    : activeTrack.defaultArtist;
  const activeNotes = activeTrack.notesKey
    ? dataPoints[activeTrack.notesKey] || activeTrack.defaultNotes
    : activeTrack.defaultNotes;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900/95 dark:bg-slate-900/95 border border-white/10 p-5 sm:p-7 md:p-8 backdrop-blur-2xl shadow-float text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary-bright/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 size-64 rounded-full bg-indigo-600/10 blur-3xl" />

      <audio
        ref={audioElRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => selectRelativeTrack(1)}
        onTimeUpdate={() => {
          if (audioElRef.current && !Number.isNaN(audioElRef.current.currentTime)) {
            setPlaybackTime(Math.floor(audioElRef.current.currentTime));
          }
        }}
        onError={() => {
          setStreamError(
            dataPoints['choir.player.stream_err_msg'] ||
              'Audio stream temporarily unreachable. Tap Retry or select another station.'
          );
          setIsPlaying(false);
        }}
      >
        <track kind="captions" />
      </audio>

      {/* Header bar */}
      <div className="relative flex items-center justify-between gap-4 mb-5 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-11 sm:size-12 rounded-2xl bg-primary-bright/20 border border-primary-bright/30 flex items-center justify-center text-primary-on-dark shrink-0 shadow-raised">
            <Music size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary-on-dark flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <Radio size={13} className="text-accent-gold" />
                <DataPoint as="span" name="choir.player.radio_title" initialData={dataPoints}>
                  Resistance Radio
                </DataPoint>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-semibold">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-emerald-400 animate-ping motion-reduce:animate-none"
                />
                <DataPoint as="span" name="choir.player.live_broadcast" initialData={dataPoints}>
                  Live Web Broadcast
                </DataPoint>
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-black text-white tracking-tight truncate leading-snug mt-0.5">
              {activeTitle}
            </h3>
          </div>
        </div>

        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="size-13 rounded-full bg-gradient-to-tr from-primary-bright to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-float shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-300 ease-out shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          aria-label={
            isPlaying
              ? dataPoints['choir.player.pause_label'] || 'Pause audio broadcast'
              : dataPoints['choir.player.play_label'] || 'Play audio broadcast'
          }
        >
          {isPlaying ? (
            <Pause size={22} className="fill-white" />
          ) : (
            <Play size={22} className="fill-white ml-0.5" />
          )}
        </button>
      </div>

      <DataPoint
        as="p"
        name="choir.player.radio_subtitle"
        initialData={dataPoints}
        className="mb-5 max-w-2xl text-xs sm:text-sm leading-relaxed text-ink-on-dark"
      >
        A browser-based harmonic broadcast and community protest songs for peaceful organizing. Tune
        into any stream from anywhere.
      </DataPoint>

      {/* Stream Notice / Error with Retry Action */}
      {streamError && (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wifi size={14} className="shrink-0 text-amber-400" />
            <span className="truncate">{streamError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => playActiveTrack(activeTrack)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition-colors"
            >
              <DataPoint as="span" name="choir.player.retry_btn" initialData={dataPoints}>
                Retry
              </DataPoint>
            </button>
            <button
              type="button"
              onClick={() => selectRelativeTrack(1)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] transition-colors"
            >
              <DataPoint as="span" name="choir.player.next_station_btn" initialData={dataPoints}>
                Next Station
              </DataPoint>
            </button>
          </div>
        </div>
      )}

      {/* Visualizer & Progress */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-secondary/70 p-4 sm:p-5 backdrop-blur-md">
        <div className="flex items-end justify-between gap-1.5 h-14 px-2 py-1 bg-black/30 rounded-xl border border-white/5">
          {visualizerBars.map((bar) => (
            <div
              key={bar.id}
              className={`flex-1 origin-bottom rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${
                isPlaying
                  ? 'bg-gradient-to-t from-primary-bright via-primary-on-dark-muted to-accent-gold shadow-xs'
                  : 'bg-white/10'
              }`}
              style={{ transform: `scaleY(${bar.height / 100})` }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted-on-dark mt-3 px-1">
          <span aria-hidden="true">
            {Math.floor(playbackTime / 60)}:{(playbackTime % 60).toString().padStart(2, '0')}
          </span>
          <span className="flex items-center gap-1.5 font-sans font-semibold text-primary-on-dark">
            <Volume2 size={13} />
            {dataPoints['choir.player.status_stream'] || 'Direct Audio Broadcast'}
          </span>
          <span>{displayDuration(activeTrack)}</span>
        </div>

        {/* Read-only WAI-ARIA compliant broadcast progress meter */}
        <div
          role="progressbar"
          aria-label="Elapsed broadcast time"
          aria-valuemin={0}
          aria-valuemax={BROADCAST_LENGTH_SECONDS}
          aria-valuenow={playbackTime}
          aria-valuetext={`${playbackTime} seconds of ${BROADCAST_LENGTH_SECONDS}`}
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-bright to-accent-gold transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${Math.min(100, (playbackTime / BROADCAST_LENGTH_SECONDS) * 100)}%`,
            }}
          />
        </div>

        {/* Volume & Quick Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleMute}
              className="text-primary-on-dark hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold rounded p-1"
              aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
            >
              {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={volume}
              onChange={(event) => {
                const nextVolume = Number(event.target.value);
                setVolume(nextVolume);
                if (audioElRef.current) audioElRef.current.volume = nextVolume;
              }}
              className="w-28 sm:w-36 h-2 accent-primary-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold rounded-full cursor-pointer"
              aria-label={dataPoints['choir.player.volume_label'] || 'Broadcast volume'}
            />
            <span className="text-[11px] font-mono text-ink-muted-on-dark">
              {Math.round((volume / 0.5) * 100)}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCustomBar((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-primary-on-dark hover:text-white transition-colors"
          >
            <Globe size={13} className="text-accent-gold" />
            <DataPoint as="span" name="choir.player.tune_anywhere_btn" initialData={dataPoints}>
              Tune from Anywhere
            </DataPoint>
          </button>
        </div>
      </div>

      {/* Custom Stream Input Accordion */}
      {showCustomBar && (
        <form
          onSubmit={handleCustomStreamSubmit}
          className="mb-6 p-4 rounded-2xl bg-secondary/80 border border-primary-bright/30 space-y-3 animate-in fade-in-0 duration-200"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-on-dark">
            <Globe size={14} className="text-accent-gold" />
            <DataPoint as="span" name="choir.player.custom_stream_label" initialData={dataPoints}>
              Custom Audio Stream / Song URL from Anywhere
            </DataPoint>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={customTitleInput}
              onChange={(e) => setCustomTitleInput(e.target.value)}
              placeholder={
                dataPoints['choir.player.custom_title_placeholder'] || 'Stream Title (optional)'
              }
              className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white placeholder-white/40 text-xs focus:outline-none focus:border-primary-bright"
            />
            <input
              type="text"
              required
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder={
                dataPoints['choir.player.custom_stream_placeholder'] ||
                'Stream URL (https://...), Supabase S3 path (audio/song.mp3), or s3://...'
              }
              className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white placeholder-white/40 text-xs focus:outline-none focus:border-primary-bright"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary-bright hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-raised transition-colors flex items-center gap-1.5"
            >
              <Radio size={13} />
              <DataPoint as="span" name="choir.player.custom_stream_btn" initialData={dataPoints}>
                Tune In
              </DataPoint>
            </button>
          </div>
        </form>
      )}

      {/* Station Navigation Header */}
      <div className="mb-3.5 flex items-center justify-between rounded-2xl border border-white/10 bg-secondary/50 px-4 py-2.5">
        <button
          type="button"
          onClick={() => selectRelativeTrack(-1)}
          className="inline-flex size-10 items-center justify-center rounded-xl text-ink-on-dark hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          aria-label={dataPoints['choir.player.prev_btn_label'] || 'Previous station'}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary-on-dark block">
            <DataPoint as="span" name="choir.player.now_broadcasting" initialData={dataPoints}>
              Now broadcasting
            </DataPoint>
          </span>
          <span className="text-xs font-semibold text-white/90">{activeArtist}</span>
        </div>
        <button
          type="button"
          onClick={() => selectRelativeTrack(1)}
          className="inline-flex size-10 items-center justify-center rounded-xl text-ink-on-dark hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          aria-label={dataPoints['choir.player.next_btn_label'] || 'Next station'}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <p className="mb-4 text-xs italic text-ink-muted-on-dark px-1 leading-relaxed">
        {activeNotes}
      </p>

      {/* Preset Stations List */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-ink-on-dark px-1">
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
              onClick={() => selectTrack(track)}
              aria-pressed={isSelected}
              className={`w-full min-h-12 text-left px-4 py-3 rounded-2xl transition-all duration-300 ease-out flex items-center justify-between text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
                isSelected
                  ? 'bg-primary-bright/20 border border-primary-bright/50 text-white font-bold shadow-raised'
                  : 'bg-secondary/40 border border-transparent text-ink-on-dark hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-primary-on-dark text-xs font-bold shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate">{trackTitle}</span>
                {isSelected && isPlaying && (
                  <span className="inline-flex size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[10px] text-ink-muted-on-dark">
                  {displayDuration(track)}
                </span>
                <span
                  className={`size-6 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-primary-bright text-white' : 'bg-white/10 text-ink-on-dark'
                  }`}
                >
                  {isSelected && isPlaying ? (
                    <Pause size={10} className="fill-white" />
                  ) : (
                    <Play size={10} className="fill-white ml-0.5" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
