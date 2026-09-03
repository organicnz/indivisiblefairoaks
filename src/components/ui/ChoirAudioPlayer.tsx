'use client';

import { Music, Pause, Play, Volume2 } from 'lucide-react';
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscNodesRef = useRef<OscillatorNode[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const [visualizerBars, setVisualizerBars] = useState<{ id: string; height: number }[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ id: `bar-${i}`, height: 25 + (i % 4) * 15 }))
  );

  // Synthetic choral harmonizer using Web Audio API
  const startChoralSynth = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
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

  // Animate visualizer bars when playing
  useEffect(() => {
    if (!isPlaying) {
      setVisualizerBars(
        Array.from({ length: 12 }, (_, i) => ({ id: `bar-${i}`, height: 20 + (i % 3) * 15 }))
      );
      return;
    }

    const interval = setInterval(() => {
      setPlaybackTime((prev) => (prev + 1) % 150);
      setVisualizerBars(() =>
        Array.from({ length: 12 }, (_, i) => ({
          id: `bar-${i}`,
          height: Math.floor(Math.random() * 75) + 25,
        }))
      );
    }, 120);

    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      stopChoralSynth();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stopChoralSynth]);

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 md:p-6 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Music size={20} />
          </div>
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <span>Resistance Soundboard</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
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

      {/* Visualizer & Progress */}
      <div className="mb-5">
        <div className="flex items-end justify-between gap-1.5 h-12 px-2 py-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
          {visualizerBars.map((bar) => (
            <div
              key={bar.id}
              className={`flex-1 rounded-full transition-all duration-100 ${
                isPlaying
                  ? 'bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-800'
              }`}
              style={{ height: `${bar.height}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2 px-1">
          <span>0:{playbackTime.toString().padStart(2, '0')}</span>
          <span className="text-slate-500 flex items-center gap-1">
            <Volume2 size={12} className="text-blue-400" />
            Live Choral Harmonics
          </span>
          <span>{activeTrack.duration}</span>
        </div>
      </div>

      {/* Track Selection */}
      <div className="space-y-1.5">
        {TRACKS.map((track) => {
          const isSelected = track.id === activeTrack.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => {
                setActiveTrack(track);
                if (isPlaying) {
                  stopChoralSynth();
                  setTimeout(() => startChoralSynth(), 100);
                }
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between text-xs ${
                isSelected
                  ? 'bg-blue-600/15 border border-blue-500/40 text-white font-semibold'
                  : 'bg-slate-950/40 border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-slate-500 text-[10px]">
                  {track.id.split('-')[1]}
                </span>
                <span>{track.title}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{track.duration}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
