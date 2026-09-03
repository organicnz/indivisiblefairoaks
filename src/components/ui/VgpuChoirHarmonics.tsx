'use client';

import { useEffect, useRef, useState } from 'react';

// WGSL Shader for Acoustic Choir Vocal Harmonics
const WGSL_CHOIR_HARMONICS = `
struct Params {
  time: f32,
  width: f32,
  height: f32,
  mouseX: f32,
  mouseY: f32,
  intensity: f32,
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

  // 1. Bass Voice: Deep, resonant, foundation wave (Indigo / Royal Sapphire)
  let bassFreq = 2.4;
  let bassW = sin(p.x * bassFreq + t * 0.6) * 0.16 
            + sin(p.x * 4.8 - t * 0.3) * 0.08
            + mouseInfluence * 0.08 * sin(p.x * 12.0 + t * 3.0);
  let distBass = abs(p.y + 0.08 - bassW);
  let bassGlow = exp(-distBass * 14.0) * 0.9;
  let colBass = vec3f(0.12, 0.28, 0.85) * bassGlow;

  // 2. Tenor Voice: Warm, rhythmic community heart (Amber Gold / Copper)
  let tenorFreq = 3.6;
  let tenorW = sin(p.x * tenorFreq - t * 0.85 + 1.2) * 0.13
             + cos(p.x * 7.2 + t * 0.5) * 0.06
             + mouseInfluence * 0.06 * cos(p.x * 15.0 - t * 2.5);
  let distTenor = abs(p.y + 0.02 - tenorW);
  let tenorGlow = exp(-distTenor * 18.0) * 0.85;
  let colTenor = vec3f(0.96, 0.72, 0.22) * tenorGlow;

  // 3. Alto Voice: Harmonic bridge (Cyan / Emerald Glow)
  let altoFreq = 5.2;
  let altoW = cos(p.x * altoFreq + t * 1.1 + 2.4) * 0.11
            + sin(p.x * 10.4 - t * 0.7) * 0.05
            + mouseInfluence * 0.07 * sin(p.x * 18.0 + t * 4.0);
  let distAlto = abs(p.y - 0.04 - altoW);
  let altoGlow = exp(-distAlto * 20.0) * 0.8;
  let colAlto = vec3f(0.15, 0.85, 0.75) * altoGlow;

  // 4. Soprano Voice: High, clear, radiant freedom call (Brilliant Cyan / Diamond White)
  let sopFreq = 7.5;
  let sopW = sin(p.x * sopFreq - t * 1.4 + 4.0) * 0.09
           + cos(p.x * 15.0 + t * 1.0) * 0.04
           + mouseInfluence * 0.09 * sin(p.x * 24.0 - t * 5.0);
  let distSop = abs(p.y - 0.10 - sopW);
  let sopGlow = exp(-distSop * 24.0) * 0.95;
  let colSop = vec3f(0.85, 0.95, 1.0) * sopGlow;

  // Background deep acoustic hall ambience
  let bgGradient = mix(
    vec3f(0.015, 0.03, 0.08),
    vec3f(0.04, 0.08, 0.20),
    smoothstep(-0.5, 0.5, p.y) * 0.4
  );

  // Subtle acoustic particle vibration dust
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

  // Interactive cursor acoustic shockwave
  let ripple = sin(mouseDist * 32.0 - t * 6.0) * 0.5 + 0.5;
  let cursorAura = exp(-mouseDist * 4.0) * (0.25 + ripple * 0.25) * params.intensity;
  let colCursor = vec3f(0.2, 0.6, 1.0) * cursorAura;

  // Blend vocal layers
  var finalColor = bgGradient + colBass + colTenor + colAlto + colSop + colCursor;
  finalColor += vec3f(0.9, 0.8, 1.0) * particleLight;

  // Vignette on edges
  let vig = (1.0 - length(uv - 0.5) * 0.75) * (1.0 - uv.y * 0.25);
  finalColor *= max(vig, 0.2);

  return vec4f(finalColor, 1.0);
}
`;

interface VgpuChoirHarmonicsProps {
  className?: string;
  intensity?: number;
  showBadge?: boolean;
}

export function VgpuChoirHarmonics({
  className = '',
  intensity = 1.0,
  showBadge = true,
}: VgpuChoirHarmonicsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let disposed = false;

    async function initHarmonics() {
      if (typeof window === 'undefined' || !('gpu' in navigator)) {
        setIsSupported(false);
        return;
      }

      try {
        const { init, surface, effect, frameLoop } = await import('vgpu');

        if (disposed) return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const gpu = await init();
        if (disposed) {
          gpu.dispose();
          return;
        }

        const canvasSurface = surface(gpu, canvas);

        const harmonics = effect(gpu, WGSL_CHOIR_HARMONICS);

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

        const updateDims = () => {
          const rect = container.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.floor(rect.width * dpr);
          const h = Math.floor(rect.height * dpr);

          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = Math.max(w, 1);
            canvas.height = Math.max(h, 1);
          }

          harmonics.set({
            params: {
              width: rect.width,
              height: rect.height,
              intensity,
            },
          });
        };

        updateDims();
        const unsubscribeResize = canvasSurface.onResize(() => {
          updateDims();
        });

        let isVisible = true;
        const observer = new IntersectionObserver(([entry]) => {
          isVisible = entry.isIntersecting;
        });
        observer.observe(container);

        setIsWebGPUActive(true);
        setIsSupported(true);

        const startTime = performance.now();
        const timeTracker = {
          get time() {
            return (performance.now() - startTime) / 1000;
          },
        };

        const loop = frameLoop(gpu, (frame) => {
          if (!isVisible) return;

          currentMouseX += (targetMouseX - currentMouseX) * 0.08;
          currentMouseY += (targetMouseY - currentMouseY) * 0.08;

          harmonics.set({
            params: {
              time: timeTracker.time,
              mouseX: currentMouseX,
              mouseY: currentMouseY,
            },
          });

          frame.pass(canvasSurface, harmonics);
        });

        cleanupFn = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          observer.disconnect();
          unsubscribeResize();
          loop.stop();
          gpu.dispose();
          setIsWebGPUActive(false);
        };
      } catch (err) {
        console.warn(
          'WebGPU choir harmonics disabled or unsupported; fallback to CSS harmony gradient.',
          err
        );
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
        className={`w-full h-full block transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback Ambient Layer for non-WebGPU devices */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950/80 to-indigo-950 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-20' : 'opacity-100'
        }`}
      >
        <div className="absolute top-[10%] left-[10%] w-[60vw] h-[25vw] rounded-full bg-blue-600/15 blur-[100px] animate-pulse duration-[7000ms]" />
        <div className="absolute bottom-[10%] right-[10%] w-[50vw] h-[25vw] rounded-full bg-amber-500/10 blur-[110px] animate-pulse duration-[9000ms]" />
      </div>

      {/* Hardware Acceleration Indicator Badge */}
      {showBadge && (
        <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono font-medium text-slate-300 shadow-lg">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWebGPUActive
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse'
                  : 'bg-blue-400'
              }`}
            />
            <span>{isWebGPUActive ? 'VGPU Harmonics 60fps' : 'Harmonic Hall'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
