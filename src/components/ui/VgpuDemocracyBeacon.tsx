'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Ascending Democratic Beacon Rays & Shimmering Ballot Stars
export const WGSL_DEMOCRACY_BEACON = `
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

  let t = params.time * 0.45;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseTilt = (params.mouseX - 0.5) * 0.35;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmosphere
  let bgDarkStart = vec3f(0.05, 0.10, 0.25);
  let bgDarkEnd   = vec3f(0.08, 0.16, 0.35);
  let bgLightStart = vec3f(0.92, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.86, 0.92, 0.98);
  let bgSystemStart = mix(vec3f(0.92, 0.95, 0.99), vec3f(0.05, 0.10, 0.25), darkFactor);
  let bgSystemEnd   = mix(vec3f(0.86, 0.92, 0.98), vec3f(0.08, 0.16, 0.35), darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.4);

  // 1. Ascending Democratic Beacon Rays (Pillars of civic light)
  let rayAngle = mouseTilt * 0.4;
  let rayP = vec2f(
    p.x * cos(rayAngle) - p.y * sin(rayAngle),
    p.x * sin(rayAngle) + p.y * cos(rayAngle)
  );

  let ray1 = pow(max(0.0, sin(rayP.x * 6.0 + t * 0.8)), 8.0) * exp(-abs(p.y) * 1.2);
  let ray2 = pow(max(0.0, sin(rayP.x * 10.0 - t * 0.5 + 1.8)), 10.0) * exp(-abs(p.y) * 1.5);
  let ray3 = pow(max(0.0, sin(rayP.x * 15.0 + t * 1.2 + 3.2)), 12.0) * exp(-abs(p.y) * 1.8);
  let centralBeacon = exp(-abs(rayP.x) * 4.5) * (0.8 + 0.2 * sin(t * 1.5));

  let totalRays = ray1 * 0.7 + ray2 * 0.6 + ray3 * 0.5 + centralBeacon * 0.9;

  // 2. Democratic Colors
  let goldDark   = vec3f(0.96, 0.76, 0.22);
  let goldLight  = vec3f(0.98, 0.80, 0.28);
  let goldSystem = vec3f(0.96, 0.78, 0.25);
  let goldCol = goldLight * modeLight + goldDark * modeDark + goldSystem * modeSystem;

  let blueDark   = vec3f(0.20, 0.55, 0.98);
  let blueLight  = vec3f(0.30, 0.65, 0.98);
  let blueSystem = vec3f(0.25, 0.60, 0.98);
  let blueCol = blueLight * modeLight + blueDark * modeDark + blueSystem * modeSystem;

  col += blueCol * (totalRays * 0.65);
  col += goldCol * (centralBeacon * 0.55);

  // 3. Shimmering Ballot Star Particles (Upward floating civic empowerment)
  let particleGrid = vec2f(p.x * 18.0, (p.y - t * 0.35) * 18.0);
  let cellId = floor(particleGrid);
  let localP = fract(particleGrid) - 0.5;
  let rand = hash21(cellId);

  // Only spawn on certain cells
  if (rand > 0.62) {
    let particlePos = vec2f(
      sin(rand * 6.28 + t * 2.0) * 0.25,
      cos(rand * 6.28 + t * 1.5) * 0.25
    );
    let dist = length(localP - particlePos);
    let shimmer = 0.5 + 0.5 * sin(t * 4.0 + rand * 12.0);
    let starGlow = exp(-dist * 18.0) * shimmer * (0.8 + 0.4 * params.intensity);

    let starColor = mix(goldCol, vec3f(1.0), rand);
    col += starColor * starGlow * (0.7 + centralBeacon * 0.5);
  }

  // 4. Mouse Interactive Radiance
  let mouseGlow = exp(-mouseDist * 3.8) * 0.6 * params.intensity;
  col += mix(blueCol, goldCol, 0.5) * mouseGlow;

  return vec4f(col, 1.0);
}
`;

export const DEMOCRACY_BEACON_SHADER = prepareShader(WGSL_DEMOCRACY_BEACON, 'democracy-beacon');

export interface VgpuDemocracyBeaconProps {
  intensity?: number;
  className?: string;
}

export function VgpuDemocracyBeacon({ intensity = 1.0, className = '' }: VgpuDemocracyBeaconProps) {
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

    async function initBeacon() {
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

        const beacon = effect(gpu, DEMOCRACY_BEACON_SHADER, {
          label: 'democracy-beacon',
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

        void beacon.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, beacon));
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

            f.pass(canvasSurface, beacon);
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

    initBeacon();

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
            ? 'from-slate-950 via-blue-950/80 to-indigo-950'
            : 'from-blue-50/70 via-indigo-50/30 to-slate-100/60'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[10%] left-[25%] w-[45vw] h-[28vw] rounded-full blur-[100px] animate-pulse duration-[7000ms] ${
            effective === 'dark' ? 'bg-blue-600/15' : 'bg-blue-400/20'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[20%] w-[50vw] h-[25vw] rounded-full blur-[110px] animate-pulse duration-[9000ms] ${
            effective === 'dark' ? 'bg-amber-500/15' : 'bg-amber-400/20'
          }`}
        />
      </div>
    </div>
  );
}
