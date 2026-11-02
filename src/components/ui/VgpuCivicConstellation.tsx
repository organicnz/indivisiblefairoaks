'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
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

// Golden ratio temporal pseudo-random hash
fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2f) -> vec2f {
  var p3 = fract(vec3f(p.xyx) * vec3f(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// C2-continuous quintic smootherstep (zero 1st/2nd derivative discontinuities)
fn smootherstep(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / max(e1 - e0, 0.00001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// C-infinity dual-lobe volumetric Gaussian envelope (zero razor cusps or sharp creases)
fn dualLobe(d: f32, coreW: f32, haloW: f32) -> f32 {
  let core = exp(-((d * d) / max(coreW * coreW, 0.00001)));
  let halo = exp(-((d * d) / max(haloW * haloW, 0.00001))) * 0.38;
  return core + halo;
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

  let t = params.time * 0.20;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseInfluence = dualLobe(mouseDist, 0.10, 0.38) * params.intensity;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  let bgDarkStart = vec3f(0.014, 0.028, 0.075);
  let bgDarkEnd   = vec3f(0.038, 0.065, 0.155);
  let bgLightStart = vec3f(0.935, 0.955, 0.992);
  let bgLightEnd   = vec3f(0.865, 0.912, 0.972);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  let bgBlend = smootherstep(-0.55, 0.45, p.y) * 0.52;
  var col = mix(bgStart, bgEnd, bgBlend);

  // Dynamic Voronoi-like nodal network
  let cellSize = 5.2;
  let gridP = p * cellSize;
  let cellId = floor(gridP);
  let localP = fract(gridP) - 0.5;

  var minDist = 10.0;
  var secondMinDist = 10.0;
  var closestNode = vec2f(0.0);
  var closestRand = 0.5;

  // Check 3x3 neighborhood for community nodes
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbor = vec2f(f32(x), f32(y));
      let rand = hash22(cellId + neighbor);

      // Orbital oscillation of nodes with smooth phase modulation
      let quantumPhase = sin(rand.x * 6.28 + t * 1.1) * 0.1 * modeSystem;
      let nodePos = neighbor + sin(rand * 6.28 + vec2f(t * 0.95, t * 0.65) + quantumPhase) * 0.30;
      let diff = nodePos - localP;
      let d = length(diff);

      if (d < minDist) {
        secondMinDist = minDist;
        minDist = d;
        closestNode = nodePos;
        closestRand = rand.x;
      } else if (d < secondMinDist) {
        secondMinDist = d;
      }
    }
  }

  // Draw node points of light (grassroots activists) with Airy diffraction + organic breathing
  let breathPulse = 0.88 + 0.12 * sin(closestRand * 6.28 + t * 2.2);
  let nodeAiryHalo = exp(-minDist * 6.5) * (1.0 + 0.25 * cos(minDist * 14.0));
  let nodeGlow = (dualLobe(minDist, 0.14, 0.45) + nodeAiryHalo * 0.25) * breathPulse;

  let nodeDarkColor   = mix(vec3f(0.20, 0.58, 0.98), vec3f(0.98, 0.78, 0.22), closestRand);
  let nodeLightColor  = mix(vec3f(0.25, 0.54, 0.94), vec3f(0.95, 0.72, 0.22), closestRand);
  let nodeSystemColor = mix(vec3f(0.12, 0.88, 0.56), vec3f(0.98, 0.76, 0.20), closestRand);
  let nodeColor = nodeLightColor * modeLight + nodeDarkColor * modeDark + nodeSystemColor * modeSystem;
  let nodeEmission = nodeColor * nodeGlow * 1.30;

  // Draw connecting energy filaments between neighboring nodes (coalition ties)
  let filamentDist = secondMinDist - minDist;
  let filamentTaper = smootherstep(1.0, 0.15, minDist);
  let filamentPulse = 0.85 + 0.15 * cos(filamentDist * 16.0 - t * 3.0);
  let filament = dualLobe(filamentDist, 0.16, 0.42) * filamentTaper * filamentPulse;

  let filamentDarkColor   = mix(vec3f(0.18, 0.50, 0.92), vec3f(0.92, 0.68, 0.22), mouseInfluence);
  let filamentLightColor  = mix(vec3f(0.22, 0.48, 0.88), vec3f(0.90, 0.65, 0.22), mouseInfluence);
  let filamentSystemColor = mix(vec3f(0.14, 0.78, 0.60), vec3f(0.90, 0.68, 0.22), mouseInfluence);
  let filamentColor = filamentLightColor * modeLight + filamentDarkColor * modeDark + filamentSystemColor * modeSystem;
  let filamentEmission = filamentColor * filament * (0.22 + mouseInfluence * 0.28);

  // Cursor civic aura & ripple
  let auraCyan = mix(vec3f(0.25, 0.72, 0.98), vec3f(0.22, 0.58, 0.95), darkFactor);
  let auraGold = mix(vec3f(0.98, 0.82, 0.28), vec3f(0.95, 0.75, 0.22), darkFactor);
  let auraEmerald = vec3f(0.18, 0.90, 0.62);
  let auraColor = (auraCyan * 0.6 + auraGold * 0.4) * (modeLight + modeDark) + (auraEmerald * 0.5 + auraGold * 0.5) * modeSystem;
  let cursorEmission = auraColor * mouseInfluence * 0.45;

  // Center text-legibility shield: preserves high contrast for foreground typography
  let textShield = mix(0.55, 1.0, smootherstep(0.05, 0.65, length(p * vec2f(0.85, 1.4))));

  let totalEmission = (nodeEmission * 0.45 + filamentEmission * 0.40 + cursorEmission) * textShield;

  // Theme-adaptive transfer: delicate, elegant ambient glow maintaining high text contrast
  let darkRad = col + totalEmission * mix(0.35, 0.55, params.intensity);
  let lightRad = col * (1.0 - (nodeGlow * 0.08 + filament * 0.06) * textShield) +
                 (nodeEmission * 0.20 + filamentEmission * 0.18 + cursorEmission * 0.18) * textShield;
  var radiance = mix(lightRad, darkRad, darkFactor);

  radiance = tonemap(radiance);

  // Golden ratio temporal blue-noise dither
  let dither = (hash21(uv * 1214.56 + vec2f(params.time * 0.015, params.time * 0.025)) - 0.5) * (1.0 / 255.0);
  radiance += vec3f(dither);

  return vec4f(clamp(radiance, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const CONSTELLATION_SHADER = prepareShader(WGSL_CONSTELLATION, 'civic-constellation.wgsl');


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

        const constellation = effect(gpu, CONSTELLATION_SHADER, {
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
        await constellation.compile(canvasSurface);
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
