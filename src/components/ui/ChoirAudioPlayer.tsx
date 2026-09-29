'use client';

import {
  ChevronLeft,
  ChevronRight,
  Music,
  Pause,
  Play,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SongTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  notes: string;
}

const TRACKS: SongTrack[] = [
  {
    id: 'anthem-1',
    title: 'Singing for Our Lives',
    artist: 'Carmichael Resistance Choir',
    duration: '2:15',
    notes: 'Holly Near anthem arranged for community 4-part harmony',
  },
  {
    id: 'anthem-2',
    title: 'Ain’t Gonna Let Nobody Turn Me Around',
    artist: 'Carmichael Resistance Choir',
    duration: '1:48',
    notes: 'Traditional civil rights march anthem',
  },
  {
    id: 'anthem-3',
    title: 'We Shall Not Be Moved',
    artist: 'Carmichael Resistance Choir',
    duration: '2:30',
    notes: 'Union and freedom struggle rallying song',
  },
];

export function ChoirAudioPlayer() {
  const [activeTrack, setActiveTrack] = useState<SongTrack>(TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [volume, setVolume] = useState(0.12);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscNodesRef = useRef<OscillatorNode[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const [visualizerBars, setVisualizerBars] = useState<{ id: string; height: number }[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ id: `bar-${i}`, height: 25 + (i % 4) * 15 }))
  );

  // The drone loops for this long before the clock restarts. Named so the
  // progress meter and the clock readout cannot disagree.
  const BROADCAST_LENGTH_SECONDS = 150;

  // Synthetic choral harmonizer using Web Audio API
  const startChoralSynth = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Choral triad frequencies (F major / C major chord with harmonic overtone)
      const freqs = [174.61, 220.0, 261.63, 349.23, 440.0, 523.25];

      const oscs = freqs.map((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        // Gentle vibrato LFO
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 2.5;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        osc.connect(filter);
        filter.connect(masterGain);
        osc.start();
        return osc;
      });

      oscNodesRef.current = oscs;
    } catch {
      // AudioContext might be restricted until user gesture; silently ignore
    }
  };

  const stopChoralSynth = useCallback(() => {
    try {
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
      }
      setTimeout(() => {
        for (const osc of oscNodesRef.current) {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Already stopped
          }
        }
        oscNodesRef.current = [];
        if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
      }, 80);
    } catch {
      // Ignore cleanup error
    }
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      stopChoralSynth();
      setIsPlaying(false);
    } else {
      startChoralSynth();
      setIsPlaying(true);
    }
  };

  const selectTrack = (track: SongTrack) => {
    setActiveTrack(track);
    setPlaybackTime(0);
    if (isPlaying) {
      stopChoralSynth();
      window.setTimeout(() => startChoralSynth(), 100);
    }
  };

  const selectRelativeTrack = (offset: number) => {
    const index = TRACKS.findIndex((track) => track.id === activeTrack.id);
    selectTrack(TRACKS[(index + offset + TRACKS.length) % TRACKS.length]);
  };

  // Animate visualizer bars when playing
  useEffect(() => {
    if (!isPlaying) {
      setVisualizerBars(
        Array.from({ length: 12 }, (_, i) => ({ id: `bar-${i}`, height: 20 + (i % 3) * 15 }))
      );
      return;
    }

    const interval = setInterval(() => {
      setPlaybackTime((prev) => (prev + 1) % BROADCAST_LENGTH_SECONDS);
      setVisualizerBars(() =>
        Array.from({ length: 12 }, (_, i) => ({
          id: `bar-${i}`,
          height: Math.floor(Math.random() * 75) + 25,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      stopChoralSynth();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stopChoralSynth]);

  return (
    <div className="rounded-2xl bg-secondary/90 border border-white/10 p-5 md:p-6 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-bright/20 border border-primary-bright/30 flex items-center justify-center text-primary-on-dark-muted">
            <Music size={20} />
          </div>
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary-on-dark-muted flex items-center gap-1.5">
              <span className="flex items-center gap-1.5">
                <Radio size={12} /> Resistance Radio
              </span>
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping motion-reduce:animate-none"
              />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {activeTrack.title}
            </h3>
          </div>
        </div>

        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all"
          aria-label={isPlaying ? 'Pause harmonic audio' : 'Play harmonic audio'}
        >
          {isPlaying ? (
            <Pause size={20} className="fill-white" />
          ) : (
            <Play size={20} className="fill-white ml-0.5" />
          )}
        </button>
      </div>

      <p className="mb-4 max-w-xl text-xs leading-relaxed text-ink-muted-on-dark">
        A browser-based harmonic broadcast for peaceful organizing. Select a station, press play,
        and lend your voice to the movement.
      </p>

      {/* Visualizer & Progress */}
      <div className="mb-5">
        <div className="flex items-end justify-between gap-1.5 h-12 px-2 py-1 bg-secondary/60 rounded-xl border border-white/10/80">
          {visualizerBars.map((bar) => (
            <div
              key={bar.id}
              className={`flex-1 origin-bottom rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${
                isPlaying
                  ? 'bg-gradient-to-t from-primary-bright to-primary-on-dark-muted'
                  : 'bg-white/5'
              }`}
              style={{ transform: `scaleY(${bar.height / 100})` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted-on-dark mt-2 px-1">
          <span aria-hidden="true">0:{playbackTime.toString().padStart(2, '0')}</span>
          <span className="text-ink-muted-on-dark flex items-center gap-1">
            <Volume2 size={12} className="text-primary-on-dark-muted" />
            Live Choral Harmonics
          </span>
          <span>{activeTrack.duration}</span>
        </div>
        {/*
          This is a live generative drone (a Web Audio oscillator stack), not a
          recording — there is no media element and therefore nothing to seek. The
          range input that used to sit here moved local state only, so a control
          labelled "seek" silently did nothing. It is now an honest, read-only
          progress meter: a real `progressbar` with real values, which is what the
          thing actually is.
        */}
        <div
          role="progressbar"
          aria-label="Elapsed broadcast time"
          aria-valuemin={0}
          aria-valuemax={BROADCAST_LENGTH_SECONDS}
          aria-valuenow={playbackTime}
          aria-valuetext={`${playbackTime} seconds of ${BROADCAST_LENGTH_SECONDS}`}
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-primary-on-dark-muted transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${Math.min(100, (playbackTime / BROADCAST_LENGTH_SECONDS) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {volume === 0 ? (
            <VolumeX size={14} className="text-ink-muted-on-dark" />
          ) : (
            <Volume2 size={14} className="text-primary-on-dark-muted" />
          )}
          <input
            type="range"
            min="0"
            max="0.3"
            step="0.01"
            value={volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              setVolume(nextVolume);
              if (gainNodeRef.current && audioCtxRef.current) {
                gainNodeRef.current.gain.setTargetAtTime(
                  nextVolume,
                  audioCtxRef.current.currentTime,
                  0.03
                );
              }
            }}
            className="w-28 h-11 accent-primary-on-dark-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary cursor-pointer"
            aria-label="Broadcast volume"
          />
          <span className="text-[10px] uppercase tracking-wider text-ink-muted-on-dark">
            Broadcast volume
          </span>
        </div>
      </div>

      {/* Track Selection */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-secondary/40 px-3 py-2">
        <button
          type="button"
          onClick={() => selectRelativeTrack(-1)}
          className="inline-flex size-11 items-center justify-center rounded-lg text-ink-muted-on-dark hover:bg-white/5 hover:text-white transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          aria-label="Previous station"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="text-center text-[10px] uppercase tracking-widest text-ink-muted-on-dark">
          Now broadcasting · {activeTrack.artist}
        </span>
        <button
          type="button"
          onClick={() => selectRelativeTrack(1)}
          className="inline-flex size-11 items-center justify-center rounded-lg text-ink-muted-on-dark hover:bg-white/5 hover:text-white transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          aria-label="Next station"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="mb-3 text-xs italic text-ink-muted-on-dark">{activeTrack.notes}</p>
      <div className="space-y-1.5">
        {TRACKS.map((track) => {
          const isSelected = track.id === activeTrack.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => selectTrack(track)}
              aria-pressed={isSelected}
              className={`w-full min-h-11 text-left px-3.5 py-2.5 rounded-xl transition-colors duration-300 ease-out flex items-center justify-between text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
                isSelected
                  ? 'bg-primary-bright/15 border border-primary-bright/40 text-white font-semibold'
                  : // `hover:bg-white/5/50` was a malformed class that never applied.
                    'bg-secondary/40 border border-transparent text-ink-muted-on-dark hover:text-ink-on-dark hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-ink-muted-on-dark text-[10px]">
                  {track.id.split('-')[1]}
                </span>
                <span>{track.title}</span>
              </div>
              <span className="font-mono text-[10px] text-ink-muted-on-dark">{track.duration}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
