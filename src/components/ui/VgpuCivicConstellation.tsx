'use client';

import { useEffect, useRef, useState } from 'react';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Interconnected Civic Coalition Constellation with Theme-Adaptive Colors
export const WGSL_CONSTELLATION = `
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

fn hash22(p: vec2f) -> vec2f {
  var p3 = fract(vec3f(p.xyx) * vec3f(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.25;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseInfluence = exp(-mouseDist * 3.5) * params.intensity;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  // Continuous partition of unity across optical profiles:
  // themeMode = 2.0 (Dark: Obsidian Kerr Singularity & Relativistic Lensing)
  // themeMode = 1.0 (Light: Solar Diamond Caustics with Prismatic Dispersion)
  // themeMode = 0.0 (System: Quantum Bloch Sphere Geodesic Superposition)
  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  let bgDarkStart = vec3f(0.086, 0.188, 0.361);
  let bgDarkEnd   = vec3f(0.11, 0.23, 0.44);
  let bgLightStart = vec3f(0.933, 0.957, 1.0);
  let bgLightEnd   = vec3f(0.88, 0.92, 0.98);
  let bgSystemStart = mix(vec3f(0.933, 0.957, 1.0), vec3f(0.086, 0.188, 0.361), darkFactor);
  let bgSystemEnd   = mix(vec3f(0.88, 0.92, 0.98), vec3f(0.11, 0.23, 0.44), darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(
    bgStart,
    bgEnd,
    smoothstep(-0.5, 0.5, p.y) * 0.38
  );

  // Dynamic Voronoi-like nodal network
  let cellSize = 6.0;
  let gridP = p * cellSize;
  let cellId = floor(gridP);
  let localP = fract(gridP) - 0.5;

  var minDist = 10.0;
  var secondMinDist = 10.0;
  var closestNode = vec2f(0.0);

  // Check 3x3 neighborhood for community nodes
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbor = vec2f(f32(x), f32(y));
      let rand = hash22(cellId + neighbor);

      // Orbital oscillation of nodes with quantum Bloch phase modulation in system mode
      let quantumPhase = sin(rand.x * 6.28 + t * 1.5) * 0.12 * modeSystem;
      let nodePos = neighbor + sin(rand * 6.28 + vec2f(t * 1.2, t * 0.8) + quantumPhase) * 0.35;
      let diff = nodePos - localP;
      let d = length(diff);

      if (d < minDist) {
        secondMinDist = minDist;
        minDist = d;
        closestNode = nodePos;
      } else if (d < secondMinDist) {
        secondMinDist = d;
      }
    }
  }

  // Draw node points of light (grassroots activists)
  let nodeGlow = exp(-minDist * 12.0);
  let nodeRand = hash22(cellId).x;
  let nodeDarkColor  = mix(vec3f(0.12, 0.46, 0.98), vec3f(0.95, 0.75, 0.2), nodeRand);
  let nodeLightColor = mix(vec3f(0.35, 0.75, 1.0), vec3f(1.0, 0.85, 0.35), nodeRand);
  let nodeSystemColor = mix(vec3f(0.08, 0.86, 0.52), vec3f(0.96, 0.76, 0.16), nodeRand);
  let nodeColor = nodeLightColor * modeLight + nodeDarkColor * modeDark + nodeSystemColor * modeSystem;
  col += nodeColor * nodeGlow * 1.25;

  // Draw connecting energy filaments between neighboring nodes (coalition ties)
  let filamentDist = secondMinDist - minDist;
  let filament = exp(-filamentDist * 8.0) * smoothstep(0.8, 0.1, minDist);
  let filamentDarkColor  = mix(vec3f(0.1, 0.4, 0.8), vec3f(0.8, 0.6, 0.2), mouseInfluence);
  let filamentLightColor = mix(vec3f(0.25, 0.58, 0.95), vec3f(0.95, 0.72, 0.25), mouseInfluence);
  let filamentSystemColor = mix(vec3f(0.12, 0.72, 0.60), vec3f(0.92, 0.70, 0.20), mouseInfluence);
  let filamentColor = filamentLightColor * modeLight + filamentDarkColor * modeDark + filamentSystemColor * modeSystem;
  col += filamentColor * filament * (0.35 + mouseInfluence * 0.5);

  // Cursor civic aura & ripple
  let aura = exp(-mouseDist * 2.8) * 0.35 * params.intensity;
  let auraCyan = mix(vec3f(0.35, 0.75, 1.0), vec3f(0.2, 0.55, 0.95), darkFactor);
  let auraGold = mix(vec3f(1.0, 0.85, 0.35), vec3f(0.95, 0.75, 0.2), darkFactor);
  let auraEmerald = vec3f(0.18, 0.88, 0.62);
  let auraColor = (auraCyan * 0.6 + auraGold * 0.4) * (modeLight + modeDark) + (auraEmerald * 0.5 + auraGold * 0.5) * modeSystem;
  col += auraColor * aura;

  // Edge vignette
  let vig = (1.0 - length(uv - 0.5) * 0.7) * (1.0 - uv.y * 0.25);
  col *= max(vig, 0.18);

  return vec4f(col, 1.0);
}
`;

interface VgpuCivicConstellationProps {
  className?: string;
  intensity?: number;
}

export function VgpuCivicConstellation({
  className = '',
  intensity = 1.0,
}: VgpuCivicConstellationProps) {
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

    async function initConstellation() {
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

        const constellation = effect(gpu, WGSL_CONSTELLATION, {
          label: 'civic-constellation',
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
        void constellation.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, constellation));
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

            f.pass(canvasSurface, constellation);
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

    initConstellation();

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

      {/* Fallback Ambient Layer */}
      <div
        className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-1000 ${
          effective === 'dark'
            ? 'from-slate-950 via-blue-950/80 to-indigo-950'
            : 'from-blue-100/60 via-indigo-50/40 to-slate-100/70'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[15%] left-[20%] w-[50vw] h-[50vw] rounded-full blur-[120px] animate-pulse duration-[8000ms] ${
            effective === 'dark' ? 'bg-blue-600/10' : 'bg-blue-400/15'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[15%] w-[45vw] h-[45vw] rounded-full blur-[130px] animate-pulse duration-[10000ms] ${
            effective === 'dark' ? 'bg-amber-500/10' : 'bg-amber-400/15'
          }`}
        />
      </div>
    </div>
  );
}
