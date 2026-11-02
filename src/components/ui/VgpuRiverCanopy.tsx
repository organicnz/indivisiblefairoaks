'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for American River Confluence Currents & Fair Oaks Oak Canopy Caustics
export const WGSL_RIVER_CANOPY = `
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

  let t = params.time * 0.38;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseInfluence = exp(-mouseDist * 3.2) * params.intensity;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmosphere: Deep Riverbed & River Bluff
  let bgDarkStart = vec3f(0.04, 0.12, 0.22);
  let bgDarkEnd   = vec3f(0.07, 0.16, 0.30);
  let bgLightStart = vec3f(0.92, 0.96, 0.98);
  let bgLightEnd   = vec3f(0.85, 0.92, 0.96);
  let bgSystemStart = mix(vec3f(0.92, 0.96, 0.98), vec3f(0.04, 0.12, 0.22), darkFactor);
  let bgSystemEnd   = mix(vec3f(0.85, 0.92, 0.96), vec3f(0.07, 0.16, 0.30), darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.45);

  // 1. American River Currents: Flowing horizontal streamline ribbons
  let riverY = p.y + 0.12;
  let flow1 = sin(p.x * 2.8 + t * 1.4) * 0.08
            + cos(p.x * 5.6 - t * 0.8) * 0.04
            + mouseInfluence * 0.08 * sin(p.x * 12.0 + t * 2.5);
  let streamDist1 = abs(riverY - flow1);
  let streamGlow1 = exp(-streamDist1 * 14.0) * 0.85;

  let flow2 = sin(p.x * 3.6 - t * 1.1 + 1.8) * 0.06
            + sin(p.x * 7.2 + t * 1.3) * 0.03
            + mouseInfluence * 0.06 * cos(p.x * 15.0 - t * 2.0);
  let streamDist2 = abs(riverY + 0.07 - flow2);
  let streamGlow2 = exp(-streamDist2 * 18.0) * 0.75;

  // 2. Oak Tree Canopy Sun-Dappled Caustics (Voronoi light caustics)
  let canopyP = p * 4.5 + vec2f(t * 0.1, t * 0.05);
  let cellId = floor(canopyP);
  let localP = fract(canopyP) - 0.5;

  var minD = 10.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbor = vec2f(f32(x), f32(y));
      let rand = hash22(cellId + neighbor);
      let pt = neighbor + sin(rand * 6.28 + t * 1.2) * 0.35;
      let d = length(pt - localP);
      minD = min(minD, d);
    }
  }

  // Dappled light filtering through foliage
  let caustic = pow(minD, 2.0) * exp(-minD * 2.5) * 1.8;

  // 3. Colors: River Teal, Sunlit Oak Amber, and Aquatic Cyan
  let tealDark   = vec3f(0.12, 0.72, 0.78);
  let tealLight  = vec3f(0.18, 0.65, 0.72);
  let tealSystem = vec3f(0.15, 0.68, 0.75);
  let tealCol = tealLight * modeLight + tealDark * modeDark + tealSystem * modeSystem;

  let goldDark   = vec3f(0.96, 0.75, 0.22);
  let goldLight  = vec3f(0.98, 0.80, 0.28);
  let goldSystem = vec3f(0.96, 0.78, 0.25);
  let goldCol = goldLight * modeLight + goldDark * modeDark + goldSystem * modeSystem;

  let riverDark   = vec3f(0.18, 0.45, 0.92);
  let riverLight  = vec3f(0.28, 0.55, 0.96);
  let riverSystem = vec3f(0.22, 0.50, 0.94);
  let riverCol = riverLight * modeLight + riverDark * modeDark + riverSystem * modeSystem;

  // Layer river currents
  col += riverCol * streamGlow1;
  col += tealCol * streamGlow2;

  // Layer sun-dappled canopy caustics
  col += goldCol * (caustic * 0.45);

  // Mouse splash / pebble ripple
  let mouseRipple = exp(-mouseDist * 3.5) * pow(max(0.0, sin(mouseDist * 20.0 - t * 4.0)), 2.5) * params.intensity;
  col += mix(tealCol, goldCol, 0.5) * mouseRipple * 0.9;

  return vec4f(col, 1.0);
}
`;

export const RIVER_CANOPY_SHADER = prepareShader(WGSL_RIVER_CANOPY, 'river-canopy');

export interface VgpuRiverCanopyProps {
  intensity?: number;
  className?: string;
}

export function VgpuRiverCanopy({ intensity = 1.0, className = '' }: VgpuRiverCanopyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const { mode, effective } = useThemeMode();

  const themeModeRef = useRef(mode);
  const effectiveThemeRef = useRef(effective);
  const renderFrameRef = useRef<((time: number) => void) | null>(null);
  const isReducedMotionRef = useRef(false);

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

    if (typeof window === 'undefined' || !('gpu' in navigator)) {
      setIsSupported(false);
      return;
    }

    const isReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isReducedMotionRef.current = isReducedMotion;

    async function initRiver() {
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

        const river = effect(gpu, RIVER_CANOPY_SHADER, {
          label: 'river-canopy',
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

        void river.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, river));
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

            f.pass(canvasSurface, river);
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

    initRiver();

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
            ? 'from-slate-950 via-slate-900 to-teal-950'
            : 'from-blue-50/70 via-teal-50/30 to-slate-100/60'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[15%] left-[20%] w-[50vw] h-[25vw] rounded-full blur-[100px] animate-pulse duration-[7000ms] ${
            effective === 'dark' ? 'bg-teal-600/15' : 'bg-teal-400/20'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[20%] w-[45vw] h-[25vw] rounded-full blur-[110px] animate-pulse duration-[9000ms] ${
            effective === 'dark' ? 'bg-amber-500/15' : 'bg-amber-400/20'
          }`}
        />
      </div>
    </div>
  );
}
