'use client';

import { useEffect, useRef, useState } from 'react';
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

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.6;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseInfluence = exp(-mouseDist * 2.8) * params.intensity;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  // 1. Bass Voice: Deep, resonant, foundation wave (Indigo / Royal Cobalt)
  let bassFreq = 2.4;
  let bassW = sin(p.x * bassFreq + t * 0.6) * 0.16 
            + sin(p.x * 4.8 - t * 0.3) * 0.08
            + mouseInfluence * 0.08 * sin(p.x * 12.0 + t * 3.0);
  let distBass = abs(p.y + 0.08 - bassW);
  let bassGlow = exp(-distBass * 14.0) * 0.9;
  let bassColor = mix(vec3f(0.20, 0.42, 0.98), vec3f(0.12, 0.28, 0.85), darkFactor);
  let colBass = bassColor * bassGlow;

  // 2. Tenor Voice: Warm, rhythmic community heart (Amber Gold / Copper)
  let tenorFreq = 3.6;
  let tenorW = sin(p.x * tenorFreq - t * 0.85 + 1.2) * 0.13
             + cos(p.x * 7.2 + t * 0.5) * 0.06
             + mouseInfluence * 0.06 * cos(p.x * 15.0 - t * 2.5);
  let distTenor = abs(p.y + 0.02 - tenorW);
  let tenorGlow = exp(-distTenor * 18.0) * 0.85;
  let tenorColor = mix(vec3f(1.0, 0.80, 0.28), vec3f(0.96, 0.72, 0.22), darkFactor);
  let colTenor = tenorColor * tenorGlow;

  // 3. Alto Voice: Harmonic bridge (Cyan / Emerald Glow)
  let altoFreq = 5.2;
  let altoW = cos(p.x * altoFreq + t * 1.1 + 2.4) * 0.11
            + sin(p.x * 10.4 - t * 0.7) * 0.05
            + mouseInfluence * 0.07 * sin(p.x * 18.0 + t * 4.0);
  let distAlto = abs(p.y - 0.04 - altoW);
  let altoGlow = exp(-distAlto * 20.0) * 0.8;
  let altoColor = mix(vec3f(0.25, 0.92, 0.82), vec3f(0.15, 0.85, 0.75), darkFactor);
  let colAlto = altoColor * altoGlow;

  // 4. Soprano Voice: High, clear, radiant freedom call (Brilliant Cyan / Diamond White)
  let sopFreq = 7.5;
  let sopW = sin(p.x * sopFreq - t * 1.4 + 4.0) * 0.09
           + cos(p.x * 15.0 + t * 1.0) * 0.04
           + mouseInfluence * 0.09 * sin(p.x * 24.0 - t * 5.0);
  let distSop = abs(p.y - 0.10 - sopW);
  let sopGlow = exp(-distSop * 24.0) * 0.95;
  let sopColor = mix(vec3f(0.92, 0.98, 1.0), vec3f(0.85, 0.95, 1.0), darkFactor);
  let colSop = sopColor * sopGlow;

  // Background acoustic hall ambience
  let bgGradient = mix(
    mix(vec3f(0.06, 0.12, 0.32), vec3f(0.015, 0.03, 0.08), darkFactor),
    mix(vec3f(0.10, 0.22, 0.50), vec3f(0.04, 0.08, 0.20), darkFactor),
    smoothstep(-0.5, 0.5, p.y) * 0.4
  );

  let particleGrid = uv * vec2f(40.0 * aspect, 40.0);
  let particleCell = floor(particleGrid);
  let randVal = hash21(particleCell);
  var particleLight = 0.0;
  if (randVal > 0.965) {
    let pPos = fract(particleGrid) - 0.5;
    let pDist = length(pPos);
    let shimmer = sin(t * 3.5 + randVal * 6.28) * 0.5 + 0.5;
    particleLight = exp(-pDist * 16.0) * shimmer * 0.5;
  }

  let ripple = sin(mouseDist * 32.0 - t * 6.0) * 0.5 + 0.5;
  let cursorAura = exp(-mouseDist * 4.0) * (0.25 + ripple * 0.25) * params.intensity;
  let colCursor = mix(vec3f(0.35, 0.75, 1.0), vec3f(0.2, 0.6, 1.0), darkFactor) * cursorAura;

  var finalColor = bgGradient + colBass + colTenor + colAlto + colSop + colCursor;
  finalColor += vec3f(0.9, 0.8, 1.0) * particleLight;

  let vig = (1.0 - length(uv - 0.5) * 0.75) * (1.0 - uv.y * 0.25);
  finalColor *= max(vig, 0.2);

  return vec4f(finalColor, 1.0);
}
`;

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

        // Shared GPU uniform buffer — zero-allocation per-frame updates
        const sharedParams = uniformsFn(gpu, {
          time: 0,
          width: canvasSurface.size[0],
          height: canvasSurface.size[1],
          mouseX: 0.5,
          mouseY: 0.5,
          intensity,
          themeMode:
            themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0,
          effectiveTheme: effectiveThemeRef.current === 'dark' ? 1.0 : 0.0,
        });

        const harmonics = effect(gpu, WGSL_CHOIR_HARMONICS, {
          label: 'choir-harmonics',
          set: { params: sharedParams },
        });

        let targetMouseX = 0.5;
        let targetMouseY = 0.5;
        let currentMouseX = 0.5;
        let currentMouseY = 0.5;

        let targetEffective = effectiveThemeRef.current === 'dark' ? 1.0 : 0.0;
        let currentEffective = targetEffective;

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
        void harmonics.compile(canvasSurface);

        const renderFrame = (time: number) => {
          targetEffective = effectiveThemeRef.current === 'dark' ? 1.0 : 0.0;
          currentEffective = targetEffective;
          const currentModeValue =
            themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0;

          sharedParams.set({
            time,
            width: currentWidth,
            height: currentHeight,
            mouseX: currentMouseX,
            mouseY: currentMouseY,
            intensity,
            themeMode: currentModeValue,
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
            const currentModeValue =
              themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0;

            sharedParams.set({
              time: timeTracker.time,
              width: currentWidth,
              height: currentHeight,
              mouseX: currentMouseX,
              mouseY: currentMouseY,
              intensity,
              themeMode: currentModeValue,
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
            : 'from-blue-950 via-indigo-950/80 to-slate-900'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div className="absolute top-[10%] left-[10%] w-[60vw] h-[25vw] rounded-full bg-blue-600/15 blur-[100px] animate-pulse duration-[7000ms]" />
        <div className="absolute bottom-[10%] right-[10%] w-[50vw] h-[25vw] rounded-full bg-amber-500/10 blur-[110px] animate-pulse duration-[9000ms]" />
      </div>
    </div>
  );
}
