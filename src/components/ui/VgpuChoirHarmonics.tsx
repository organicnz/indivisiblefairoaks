'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Acoustic Choir Vocal Harmonics with Theme-Adaptive Resonances
export const WGSL_CHOIR_HARMONICS = `
struct Params {
  time: f32,
  width: f32,
  height: f32,
  mouseX: f32,
  mouseY: f32,
  intensity: f32,
  themeMode: f32,
  effectiveTheme: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash21(i + vec2f(0.0, 0.0)), hash21(i + vec2f(1.0, 0.0)), u.x),
    mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x),
    u.y
  );
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2f(100.0, 100.0);
  var q = p;
  for (var i = 0; i < 4; i = i + 1) {
    v += a * noise(q);
    q = q * 2.05 + shift;
    a *= 0.5;
  }
  return v;
}

// C-infinity smooth dual-lobe volumetric envelope (zero razor cusps)
fn dualLobe(d: f32, coreW: f32, haloW: f32) -> f32 {
  let core = exp(-((d * d) / (coreW * coreW)));
  let halo = exp(-((d * d) / (haloW * haloW))) * 0.35;
  return core + halo;
}

// Multi-octave acoustic hall domain warping
fn choirWarp(p: vec2f, t: f32) -> vec2f {
  let q = vec2f(
    fbm(p + vec2f(t * 0.05, -t * 0.04)),
    fbm(p + vec2f(3.9 - t * 0.03, 1.6 + t * 0.05))
  );
  let r = vec2f(
    fbm(p + 2.5 * q + vec2f(1.4 - t * 0.04, 7.1 + t * 0.03)),
    fbm(p + 2.5 * q + vec2f(6.2 + t * 0.04, 2.8 - t * 0.05))
  );
  return p + 0.26 * r;
}

// ACES-inspired filmic tone mapping to eliminate harsh digital clipping
fn tonemap(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.45;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseInfluence = dualLobe(mouseDist, 0.08, 0.35) * params.intensity;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background acoustic concert hall ambience
  let bgDarkStart = vec3f(0.015, 0.032, 0.08);
  let bgDarkEnd   = vec3f(0.04, 0.068, 0.16);
  let bgLightStart = vec3f(0.93, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.86, 0.91, 0.97);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  let pWarp = choirWarp(p, t * 0.2);

  // 1. Bass Voice: Deep, resonant foundation ribbon (Indigo / Royal Cobalt)
  let bassW = sin(pWarp.x * 2.2 + t * 0.5) * 0.15 + sin(pWarp.x * 4.4 - t * 0.25) * 0.06 + mouseInfluence * 0.04;
  let distBass = abs(pWarp.y + 0.08 - bassW);
  let bassGlow = dualLobe(distBass, 0.065, 0.22);
  let colBass = vec3f(0.18, 0.45, 0.98) * bassGlow;

  // 2. Tenor Voice: Warm, rhythmic community heart ribbon (Amber Gold / Copper)
  let tenorW = sin(pWarp.x * 3.4 - t * 0.7 + 1.2) * 0.12 + cos(pWarp.x * 6.8 + t * 0.4) * 0.05 - mouseInfluence * 0.03;
  let distTenor = abs(pWarp.y + 0.02 - tenorW);
  let tenorGlow = dualLobe(distTenor, 0.055, 0.20);
  let colTenor = vec3f(0.98, 0.78, 0.25) * tenorGlow;

  // 3. Alto Voice: Harmonic bridge ribbon (Cyan / Emerald Glow)
  let altoW = cos(pWarp.x * 4.8 + t * 0.9 + 2.4) * 0.10 + sin(pWarp.x * 9.6 - t * 0.5) * 0.04 + mouseInfluence * 0.03;
  let distAlto = abs(pWarp.y - 0.04 - altoW);
  let altoGlow = dualLobe(distAlto, 0.05, 0.18);
  let colAlto = vec3f(0.16, 0.92, 0.72) * altoGlow;

  // 4. Soprano Voice: High radiant freedom call ribbon (Brilliant Diamond Ice)
  let sopW = sin(pWarp.x * 6.8 - t * 1.1 + 4.0) * 0.08 + cos(pWarp.x * 13.6 + t * 0.7) * 0.03 + mouseInfluence * 0.05;
  let distSop = abs(pWarp.y - 0.10 - sopW);
  let sopGlow = dualLobe(distSop, 0.045, 0.16);
  let colSop = vec3f(0.85, 0.95, 1.0) * sopGlow;

  // Dynamic cursor acoustic resonance
  let colCursor = vec3f(0.25, 0.82, 0.98) * mouseInfluence * 1.6;

  let totalAcoustic = (colBass * 1.2 + colTenor * 1.35 + colAlto * 1.2 + colSop * 1.4 + colCursor);

  // Theme-adaptive transfer
  let darkRad = col + totalAcoustic * mix(0.7, 1.25, params.intensity);
  let lightRad = col * (1.0 - (bassGlow * 0.16 + tenorGlow * 0.16 + altoGlow * 0.16)) + (colBass * 0.65 + colTenor * 0.68 + colAlto * 0.65 + colSop * 0.72 + colCursor * 0.6);
  var radiance = mix(lightRad, darkRad, darkFactor);

  radiance = tonemap(radiance);

  // Golden ratio temporal blue-noise dither
  let dither = (hash21(uv * 1224.56 + vec2f(params.time * 0.015, params.time * 0.025)) - 0.5) * (1.0 / 255.0);
  radiance += vec3f(dither);

  return vec4f(clamp(radiance, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const CHOIR_HARMONICS_SHADER = prepareShader(WGSL_CHOIR_HARMONICS, 'choir-harmonics.wgsl');


interface VgpuChoirHarmonicsProps {
  className?: string;
  intensity?: number;
}

export function VgpuChoirHarmonics({ className = '', intensity = 1.0 }: VgpuChoirHarmonicsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [, setIsSupported] = useState<boolean | null>(null);

  const { mode, effective } = useThemeMode();
  const themeModeRef = useRef(mode);
  const effectiveThemeRef = useRef(effective);
  const isReducedMotionRef = useRef(false);
  const renderFrameRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    themeModeRef.current = mode;
    effectiveThemeRef.current = effective;
    if (isReducedMotionRef.current && renderFrameRef.current) {
      renderFrameRef.current(1.0);
    }
  }, [mode, effective]);

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let disposed = false;

    // Check reduced motion and WebGPU support before any GPU work
    if (typeof window === 'undefined' || !('gpu' in navigator)) {
      setIsSupported(false);
      return;
    }

    const isReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isReducedMotionRef.current = isReducedMotion;

    async function initHarmonics() {
      try {
        const {
          init,
          surface,
          effect,
          frame,
          frameLoop,
          clock,
          uniforms: uniformsFn,
        } = await import('vgpu');

        if (disposed) return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const gpu = await init();
        if (disposed) {
          gpu.dispose();
          return;
        }

        const rawDevice = (gpu as unknown as { device?: { lost?: Promise<unknown> } })?.device;
        rawDevice?.lost?.then(() => {
          if (!disposed) {
            setIsWebGPUActive(false);
          }
        });

        const canvasSurface = surface(gpu, canvas, { dpr: [1, 2.5] });

        let targetEffective = effectiveThemeRef.current === 'dark' ? 1.0 : 0.0;
        let currentEffective = targetEffective;
        let targetMode =
          themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0;
        let currentMode = targetMode;

        // Shared GPU uniform buffer — zero-allocation per-frame updates
        const sharedParams = uniformsFn(gpu, {
          time: 0,
          width: canvasSurface.size[0],
          height: canvasSurface.size[1],
          mouseX: 0.5,
          mouseY: 0.5,
          intensity,
          themeMode: currentMode,
          effectiveTheme: currentEffective,
        });

        const harmonics = effect(gpu, CHOIR_HARMONICS_SHADER, {
          label: 'choir-harmonics',
          set: { params: sharedParams },
        });

        let targetMouseX = 0.5;
        let targetMouseY = 0.5;
        let currentMouseX = 0.5;
        let currentMouseY = 0.5;

        const handleMouseMove = (e: MouseEvent) => {
          if (!container) return;
          const rect = container.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            targetMouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            targetMouseY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        let currentWidth = canvasSurface.size[0];
        let currentHeight = canvasSurface.size[1];

        // Pre-warm the GPU render pipeline
        await harmonics.compile(canvasSurface);
        if (disposed) return;

        const renderFrame = (time: number) => {
          targetEffective = effectiveThemeRef.current === 'dark' ? 1.0 : 0.0;
          currentEffective = targetEffective;
          targetMode =
            themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0;
          currentMode = targetMode;

          sharedParams.set({
            time,
            width: currentWidth,
            height: currentHeight,
            mouseX: currentMouseX,
            mouseY: currentMouseY,
            intensity,
            themeMode: currentMode,
            effectiveTheme: currentEffective,
          });

          frame(gpu, (f) => f.pass(canvasSurface, harmonics));
        };
        renderFrameRef.current = renderFrame;

        const unsubscribeResize = canvasSurface.onResize(({ width, height }) => {
          currentWidth = width;
          currentHeight = height;
          if (isReducedMotion) {
            renderFrame(1.0);
          }
        });

        let isVisible = true;
        const observer = new IntersectionObserver(
          ([entry]) => {
            isVisible = entry.isIntersecting;
          },
          { threshold: 0.05 }
        );
        observer.observe(container);

        setIsWebGPUActive(true);
        setIsSupported(true);

        let loop: { stop: () => void } | null = null;

        if (isReducedMotion) {
          renderFrame(1.0);
        } else {
          const timeTracker = clock(gpu);

          loop = frameLoop(gpu, (f) => {
            if (!isVisible) return;

            currentMouseX += (targetMouseX - currentMouseX) * 0.08;
            currentMouseY += (targetMouseY - currentMouseY) * 0.08;

            targetEffective = effectiveThemeRef.current === 'dark' ? 1.0 : 0.0;
            currentEffective += (targetEffective - currentEffective) * 0.08;
            targetMode =
              themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0;
            currentMode += (targetMode - currentMode) * 0.08;

            sharedParams.set({
              time: timeTracker.time,
              width: currentWidth,
              height: currentHeight,
              mouseX: currentMouseX,
              mouseY: currentMouseY,
              intensity,
              themeMode: currentMode,
              effectiveTheme: currentEffective,
            });

            f.pass(canvasSurface, harmonics);
          });
        }

        cleanupFn = () => {
          renderFrameRef.current = null;
          window.removeEventListener('mousemove', handleMouseMove);
          observer.disconnect();
          unsubscribeResize();
          loop?.stop();
          gpu.dispose();
          setIsWebGPUActive(false);
        };
      } catch {
        setIsSupported(false);
        setIsWebGPUActive(false);
      }
    }

    initHarmonics();

    return () => {
      disposed = true;
      if (cleanupFn) cleanupFn();
    };
  }, [intensity]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* WebGPU Canvas */}
      <canvas
        ref={canvasRef}
        style={{ viewTransitionName: 'none' }}
        className={`w-full h-full block transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback Ambient Layer for non-WebGPU devices */}
      <div
        className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-1000 ${
          effective === 'dark'
            ? 'from-slate-950 via-blue-950/80 to-indigo-950'
            : 'from-blue-100/60 via-indigo-50/40 to-slate-100/70'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[10%] left-[10%] w-[60vw] h-[25vw] rounded-full blur-[100px] animate-pulse duration-[7000ms] ${
            effective === 'dark' ? 'bg-blue-600/15' : 'bg-blue-400/20'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[10%] w-[50vw] h-[25vw] rounded-full blur-[110px] animate-pulse duration-[9000ms] ${
            effective === 'dark' ? 'bg-amber-500/10' : 'bg-amber-400/15'
          }`}
        />
      </div>
    </div>
  );
}
