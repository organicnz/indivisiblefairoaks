'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Polar Aurora Curtains (Aurora Borealis)
export const WGSL_POLAR_AURORA = `
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

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.45;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  // Partition of unity across optical profiles:
  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background twilit Arctic atmosphere
  let bgDarkStart = vec3f(0.02, 0.04, 0.10);
  let bgDarkEnd   = vec3f(0.05, 0.09, 0.22);
  let bgLightStart = vec3f(0.92, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.84, 0.90, 0.96);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  // Aurora Curtain 1: Primary drapery fold
  let fold1 = sin(p.x * 1.8 + t * 0.7 + fbm(vec2f(p.x * 1.2, t * 0.2)) * 2.2) * 0.22;
  let distY1 = p.y - fold1;
  let vertRays1 = pow(noise(vec2f(p.x * 28.0 - t * 0.35, p.y * 1.2)), 2.2) * 1.8;
  let curtain1 = exp(-abs(distY1) * 7.5) * (0.65 + vertRays1 * 0.75);

  // Aurora Curtain 2: Secondary dancing ribbon
  let fold2 = sin(p.x * 2.4 - t * 0.5 + 1.6 + fbm(vec2f(p.x * 1.5, t * 0.18)) * 1.8) * 0.18 - 0.12;
  let distY2 = p.y - fold2;
  let vertRays2 = pow(noise(vec2f(p.x * 34.0 + t * 0.4 + 2.0, p.y * 1.5)), 2.0) * 1.6;
  let curtain2 = exp(-abs(distY2) * 8.5) * (0.55 + vertRays2 * 0.7);

  // Interactive solar wind perturbation from cursor
  let solarDeflection = exp(-mouseDist * 2.8) * 0.45 * params.intensity;

  // Emission spectral colors:
  // 1. Emerald atomic oxygen (557.7 nm)
  let greenO2 = vec3f(0.12, 0.98, 0.55);
  // 2. Violet-magenta ionized nitrogen fringe (427.8 nm)
  let violetN2 = vec3f(0.85, 0.22, 0.75);
  // 3. High-altitude crimson crown (630.0 nm)
  let crimsonO2 = vec3f(0.92, 0.18, 0.32);

  // Gradient along curtain vertical profile:
  // Lower border gets nitrogen violet, center gets oxygen green, top gets crimson crown
  let c1Color = mix(violetN2, greenO2, smoothstep(-0.25, 0.05, distY1));
  let finalC1 = mix(c1Color, crimsonO2, smoothstep(0.05, 0.35, distY1));

  let c2Color = mix(violetN2, greenO2, smoothstep(-0.2, 0.08, distY2));
  let finalC2 = mix(c2Color, crimsonO2, smoothstep(0.08, 0.3, distY2));

  let totalCurtain = (curtain1 * finalC1 + curtain2 * finalC2) * (1.0 + solarDeflection);

  // Blend into base atmosphere
  let auroraLum = (curtain1 + curtain2) * 0.9;
  let intensityScale = mix(0.42, 0.95, darkFactor) * params.intensity;

  col = mix(col, col + totalCurtain * 1.35, clamp(auroraLum * intensityScale, 0.0, 1.0));

  // Subtle star field twinkle behind auroral drapery in dark mode
  let starGrid = floor(p * 55.0);
  let starRand = hash21(starGrid);
  if (starRand > 0.982 && darkFactor > 0.4) {
    let starTwinkle = sin(t * 4.0 + starRand * 20.0) * 0.5 + 0.5;
    let starGlow = smoothstep(0.982, 1.0, starRand) * starTwinkle * (1.0 - clamp(auroraLum * 1.2, 0.0, 0.8));
    col += vec3f(0.85, 0.92, 1.0) * starGlow * 0.45 * darkFactor;
  }

  return vec4f(col, 1.0);
}
`;

export const POLAR_AURORA_SHADER = prepareShader(WGSL_POLAR_AURORA, 'polar_aurora_shader');

export interface VgpuPolarAuroraProps {
  className?: string;
  intensity?: number;
}

export function VgpuPolarAurora({ className = '', intensity = 1.0 }: VgpuPolarAuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrameRef = useRef<((time: number) => void) | null>(null);

  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  const { mode, effective } = useThemeMode();
  const themeModeRef = useRef(mode);
  const effectiveThemeRef = useRef(effective);

  useEffect(() => {
    themeModeRef.current = mode;
    effectiveThemeRef.current = effective;
    if (renderFrameRef.current) {
      renderFrameRef.current(performance.now() * 0.001);
    }
  }, [mode, effective]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function initWebGPU() {
      if (typeof navigator === 'undefined' || !navigator.gpu) {
        setIsSupported(false);
        return;
      }

      try {
        const { init, surface, effect, uniforms: uniformsFn, frame, frameLoop, clock } =
          await import('vgpu');

        if (disposed) return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const gpu = await init();
        if (disposed) return;

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

        const aurora = effect(gpu, POLAR_AURORA_SHADER, {
          label: 'polar-aurora',
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

        void aurora.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, aurora));
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
          loop = frameLoop(gpu, () => {
            if (!isVisible) return;
            const t = timeTracker.time;
            currentMouseX += (targetMouseX - currentMouseX) * 0.05;
            currentMouseY += (targetMouseY - currentMouseY) * 0.05;
            renderFrame(t);
          });
        }

        cleanup = () => {
          renderFrameRef.current = null;
          window.removeEventListener('mousemove', handleMouseMove);
          observer.disconnect();
          unsubscribeResize();
          loop?.stop();
          gpu.dispose();
          setIsWebGPUActive(false);
        };
      } catch (err) {
        console.warn('[VgpuPolarAurora] WebGPU initialization bypassed:', err);
        setIsSupported(false);
      }
    }

    void initWebGPU();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [intensity]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Fallback CSS Aurora Gradient Layer */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-0' : 'opacity-100'
        } bg-gradient-to-tr from-emerald-950/20 via-slate-900/40 to-indigo-950/30 dark:from-emerald-950/50 dark:via-slate-950/70 dark:to-indigo-950/50`}
      />

      {/* Primary Hardware-Accelerated WebGPU Canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ viewTransitionName: 'none' }}
      />
    </div>
  );
}
