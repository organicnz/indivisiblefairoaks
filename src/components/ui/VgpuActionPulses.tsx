'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Grassroots Mobilization & Concentric Action Pulses
export const WGSL_ACTION_PULSES = `
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

  let t = params.time * 0.7;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  // Continuous partition of unity across optical profiles:
  // themeMode = 2.0 (Dark)
  // themeMode = 1.0 (Light)
  // themeMode = 0.0 (System)
  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmosphere
  let bgDarkStart = vec3f(0.06, 0.12, 0.28);
  let bgDarkEnd   = vec3f(0.09, 0.18, 0.38);
  let bgLightStart = vec3f(0.92, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.85, 0.90, 0.97);
  let bgSystemStart = mix(vec3f(0.92, 0.95, 0.99), vec3f(0.06, 0.12, 0.28), darkFactor);
  let bgSystemEnd   = mix(vec3f(0.85, 0.90, 0.97), vec3f(0.09, 0.18, 0.38), darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.45);

  // 1. Hub 1: Fair Oaks Center
  let hub1 = vec2f(-0.35 * aspect, -0.05);
  let d1 = length(p - hub1);
  let pulse1 = sin(d1 * 16.0 - t * 2.2);
  let wave1 = exp(-d1 * 2.2) * pow(max(0.0, pulse1), 3.0);

  // 2. Hub 2: Carmichael Gathering
  let hub2 = vec2f(0.28 * aspect, 0.12);
  let d2 = length(p - hub2);
  let pulse2 = sin(d2 * 14.0 - t * 1.8 + 1.5);
  let wave2 = exp(-d2 * 2.0) * pow(max(0.0, pulse2), 3.0);

  // 3. Hub 3: Sacramento Regional Rally
  let hub3 = vec2f(-0.05 * aspect, 0.22);
  let d3 = length(p - hub3);
  let pulse3 = sin(d3 * 18.0 - t * 2.5 + 3.0);
  let wave3 = exp(-d3 * 2.5) * pow(max(0.0, pulse3), 3.0);

  // 4. Interactive Mouse Hub (Citizen Direct Action)
  let mouseWave = exp(-mouseDist * 3.2) * pow(max(0.0, sin(mouseDist * 22.0 - t * 4.0)), 2.5) * params.intensity;

  // Combine pulses with constructive interference
  let totalAction = (wave1 * 0.65 + wave2 * 0.6 + wave3 * 0.5 + mouseWave * 1.2);

  // Colors: Community Navy, Democracy Gold, and Activist Radiant Cyan
  let goldDark   = vec3f(0.96, 0.72, 0.22);
  let goldLight  = vec3f(0.98, 0.76, 0.25);
  let goldSystem = vec3f(0.95, 0.74, 0.20);
  let goldCol = goldLight * modeLight + goldDark * modeDark + goldSystem * modeSystem;

  let cyanDark   = vec3f(0.18, 0.78, 0.98);
  let cyanLight  = vec3f(0.15, 0.65, 0.92);
  let cyanSystem = vec3f(0.16, 0.72, 0.95);
  let cyanCol = cyanLight * modeLight + cyanDark * modeDark + cyanSystem * modeSystem;

  col += goldCol * (wave1 * 0.5 + wave2 * 0.45 + mouseWave * 0.85);
  col += cyanCol * (wave3 * 0.6 + mouseWave * 0.65);

  // Concentric focal cores (glowing civic meetup points)
  let core1 = exp(-d1 * 24.0) * 0.9;
  let core2 = exp(-d2 * 24.0) * 0.85;
  let core3 = exp(-d3 * 28.0) * 0.8;
  let mouseCore = exp(-mouseDist * 32.0) * 1.2 * params.intensity;

  let coreColor = mix(goldCol, vec3f(1.0), 0.5);
  col += coreColor * (core1 + core2 + core3 + mouseCore);

  // Subtle micro-rhythm background grid
  let gridP = fract(p * 12.0) - 0.5;
  let gridDist = min(abs(gridP.x), abs(gridP.y));
  let gridGlow = exp(-gridDist * 35.0) * 0.05 * (1.0 + totalAction);
  col += cyanCol * gridGlow;

  return vec4f(col, 1.0);
}
`;

export const ACTION_PULSES_SHADER = prepareShader(WGSL_ACTION_PULSES, 'action-pulses');

export interface VgpuActionPulsesProps {
  intensity?: number;
  className?: string;
}

export function VgpuActionPulses({ intensity = 1.0, className = '' }: VgpuActionPulsesProps) {
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

    async function initPulses() {
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

        const pulses = effect(gpu, ACTION_PULSES_SHADER, {
          label: 'action-pulses',
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

        void pulses.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, pulses));
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

            f.pass(canvasSurface, pulses);
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

    initPulses();

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
            ? 'from-slate-950 via-blue-950/80 to-slate-900'
            : 'from-blue-50/70 via-amber-50/30 to-slate-100/60'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[15%] left-[20%] w-[50vw] h-[25vw] rounded-full blur-[100px] animate-pulse duration-[6000ms] ${
            effective === 'dark' ? 'bg-amber-500/15' : 'bg-amber-400/20'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[15%] w-[45vw] h-[25vw] rounded-full blur-[110px] animate-pulse duration-[8000ms] ${
            effective === 'dark' ? 'bg-blue-600/15' : 'bg-blue-400/20'
          }`}
        />
      </div>
    </div>
  );
}
