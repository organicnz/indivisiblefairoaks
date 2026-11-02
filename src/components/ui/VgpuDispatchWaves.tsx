'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Free Press Telegraphic Carrier Waves & Rolling Dispatch Ribbons
export const WGSL_DISPATCH_WAVES = `
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

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.55;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseInfluence = exp(-mouseDist * 3.0) * params.intensity;

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmosphere
  let bgDarkStart = vec3f(0.06, 0.11, 0.26);
  let bgDarkEnd   = vec3f(0.08, 0.15, 0.34);
  let bgLightStart = vec3f(0.93, 0.95, 0.98);
  let bgLightEnd   = vec3f(0.88, 0.92, 0.97);
  let bgSystemStart = mix(vec3f(0.93, 0.95, 0.98), vec3f(0.06, 0.11, 0.26), darkFactor);
  let bgSystemEnd   = mix(vec3f(0.88, 0.92, 0.97), vec3f(0.08, 0.15, 0.34), darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.42);

  // 1. Primary Editorial Carrier Wave (Telegraph dispatch line)
  let w1 = sin(p.x * 3.5 + t * 1.2) * 0.12
         + cos(p.x * 7.0 - t * 0.8) * 0.05
         + mouseInfluence * 0.06 * sin(p.x * 14.0 + t * 3.0);
  let dist1 = abs(p.y + 0.08 - w1);
  let pulse1 = pow(max(0.0, sin(p.x * 8.0 - t * 3.5)), 6.0) * 0.8;
  let glow1 = (exp(-dist1 * 16.0) + pulse1 * exp(-dist1 * 8.0)) * 0.85;

  // 2. Secondary Truth Flow (Rolling press ink ribbon)
  let w2 = sin(p.x * 4.2 - t * 0.9 + 1.6) * 0.10
         + sin(p.x * 9.5 + t * 1.5) * 0.04
         + mouseInfluence * 0.05 * cos(p.x * 16.0 - t * 2.5);
  let dist2 = abs(p.y - 0.06 - w2);
  let pulse2 = pow(max(0.0, cos(p.x * 6.5 + t * 2.8)), 5.0) * 0.7;
  let glow2 = (exp(-dist2 * 18.0) + pulse2 * exp(-dist2 * 9.0)) * 0.8;

  // 3. High-Frequency Telegraphic Data Stream
  let w3 = cos(p.x * 6.0 + t * 1.8 + 3.0) * 0.07
         + sin(p.x * 12.0 - t * 1.1) * 0.03
         + mouseInfluence * 0.07 * sin(p.x * 20.0 + t * 4.0);
  let dist3 = abs(p.y - 0.14 - w3);
  let pulse3 = pow(max(0.0, sin(p.x * 11.0 - t * 4.2)), 8.0) * 0.9;
  let glow3 = (exp(-dist3 * 22.0) + pulse3 * exp(-dist3 * 10.0)) * 0.75;

  // Colors
  let goldDark   = vec3f(0.96, 0.74, 0.22);
  let goldLight  = vec3f(0.98, 0.78, 0.26);
  let goldSystem = vec3f(0.95, 0.75, 0.24);
  let goldCol = goldLight * modeLight + goldDark * modeDark + goldSystem * modeSystem;

  let cyanDark   = vec3f(0.15, 0.82, 0.88);
  let cyanLight  = vec3f(0.18, 0.72, 0.85);
  let cyanSystem = vec3f(0.16, 0.76, 0.86);
  let cyanCol = cyanLight * modeLight + cyanDark * modeDark + cyanSystem * modeSystem;

  let blueDark   = vec3f(0.22, 0.48, 0.95);
  let blueLight  = vec3f(0.32, 0.58, 0.98);
  let blueSystem = vec3f(0.28, 0.52, 0.96);
  let blueCol = blueLight * modeLight + blueDark * modeDark + blueSystem * modeSystem;

  col += blueCol * glow1;
  col += goldCol * glow2;
  col += cyanCol * glow3;

  // Mouse Beacon Ripple
  let mouseRing = exp(-mouseDist * 3.5) * pow(max(0.0, sin(mouseDist * 18.0 - t * 3.0)), 3.0) * params.intensity;
  col += mix(goldCol, cyanCol, 0.5) * mouseRing * 0.75;

  return vec4f(col, 1.0);
}
`;

export const DISPATCH_WAVES_SHADER = prepareShader(WGSL_DISPATCH_WAVES, 'dispatch-waves');

export interface VgpuDispatchWavesProps {
  intensity?: number;
  className?: string;
}

export function VgpuDispatchWaves({ intensity = 1.0, className = '' }: VgpuDispatchWavesProps) {
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

    async function initWaves() {
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

        const waves = effect(gpu, DISPATCH_WAVES_SHADER, {
          label: 'dispatch-waves',
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

        void waves.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, waves));
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

            f.pass(canvasSurface, waves);
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

    initWaves();

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
            ? 'from-slate-950 via-slate-900 to-indigo-950'
            : 'from-blue-50/70 via-slate-100/60 to-amber-50/30'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[12%] left-[15%] w-[50vw] h-[25vw] rounded-full blur-[100px] animate-pulse duration-[6500ms] ${
            effective === 'dark' ? 'bg-cyan-600/15' : 'bg-cyan-400/20'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[15%] w-[45vw] h-[25vw] rounded-full blur-[110px] animate-pulse duration-[8500ms] ${
            effective === 'dark' ? 'bg-amber-500/15' : 'bg-amber-400/20'
          }`}
        />
      </div>
    </div>
  );
}
