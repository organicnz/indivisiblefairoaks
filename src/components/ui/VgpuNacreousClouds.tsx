'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Polar Stratospheric Nacreous Iridescence (Mother-of-Pearl Clouds)
export const WGSL_NACREOUS_CLOUDS = `
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

// C2-continuous quintic smootherstep eliminating Mach banding and optical creasing
fn smootherstep(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / max(0.00001, e1 - e0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// C-infinity soft maximum eliminating derivative seams
fn softMax(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / max(0.0001, k), 0.0, 1.0);
  return mix(a, b, h) + k * h * (1.0 - h);
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

// C2 quintic Hermite value noise for organic, seamless fluid movement
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

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
    q = q * 2.04 + shift;
    a *= 0.5;
  }
  return v;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.28;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Stratospheric twilight atmosphere
  let bgDarkStart = vec3f(0.04, 0.06, 0.16);
  let bgDarkEnd   = vec3f(0.08, 0.12, 0.26);
  let bgLightStart = vec3f(0.94, 0.96, 1.0);
  let bgLightEnd   = vec3f(0.86, 0.90, 0.98);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smootherstep(-0.5, 0.5, p.y) * 0.7);

  // Gentle barometric perturbation from mouse pointer
  let mousePush = (mouseP - p) * exp(-mouseDist * mouseDist * 3.5) * 0.25 * params.intensity;
  let pShifted = p + mousePush;

  // Fluid multi-octave domain warping for lenticular stratospheric clouds
  let warpQ = vec2f(
    fbm(vec2f(pShifted.x * 1.3 + t * 0.12, pShifted.y * 1.0)),
    fbm(vec2f(pShifted.x * 1.3 - t * 0.10, pShifted.y * 1.0 + 2.4))
  );

  // Smooth lenticular wave crests with zero sharp creases
  let wave1 = sin(pShifted.x * 1.8 + t * 0.30 + warpQ.x * 1.4) * 0.16;
  let wave2 = cos(pShifted.x * 2.2 - t * 0.24 + warpQ.y * 1.2) * 0.14 - 0.08;

  // Gaussian thickness profiles for billowy stratospheric ice sheets
  let d1 = (pShifted.y - wave1 - 0.03);
  let distSheet1 = exp(-d1 * d1 * 12.0);
  let d2 = (pShifted.y - wave2 + 0.09);
  let distSheet2 = exp(-d2 * d2 * 14.0);
  let cloudDensity = softMax(distSheet1 * 0.88, distSheet2 * 0.78, 0.12);

  // Gentle diffraction phase: slow, continuous color dispersion without Moire banding
  let diffPhase = cloudDensity * 2.8 + pShifted.x * 1.8 + sin(pShifted.y * 2.4 - t * 0.4) * 0.6;

  // Mother-of-pearl iridescent diffraction spectral palette:
  // 1. Soft Rose Peach (1.0, 0.78, 0.70)
  let peachOpal = vec3f(1.0, 0.78, 0.70);
  // 2. Iridescent Seafoam Aqua (0.45, 0.94, 0.84)
  let seafoamAqua = vec3f(0.45, 0.94, 0.84);
  // 3. Lavender Amethyst (0.85, 0.72, 0.96)
  let amethystViolet = vec3f(0.85, 0.72, 0.96);
  // 4. Champagne Pearl Gold (0.98, 0.92, 0.65)
  let champagneGold = vec3f(0.98, 0.92, 0.65);

  let irid1 = sin(diffPhase) * 0.5 + 0.5;
  let irid2 = cos(diffPhase * 1.05 + 1.4) * 0.5 + 0.5;

  let pearlescent = mix(
    mix(peachOpal, seafoamAqua, irid1),
    mix(amethystViolet, champagneGold, irid2),
    0.5
  );

  // Center text-legibility shield: preserves high contrast for foreground typography
  let textShield = mix(0.55, 1.0, smootherstep(0.05, 0.65, length(p * vec2f(0.85, 1.4))));

  // Theme-adaptive transfer function: soft nacreous cloud veil ensuring clear text legibility
  let darkRadiance = pearlescent * (cloudDensity * 0.38) * textShield;
  let lightRadiance = mix(col * 0.90 + pearlescent * (cloudDensity * 0.18), champagneGold, 0.06 * cloudDensity) * textShield;
  let sysRadiance = mix(lightRadiance, darkRadiance, darkFactor);

  let finalRadiance = lightRadiance * modeLight + darkRadiance * modeDark + sysRadiance * modeSystem;
  let intensityScale = mix(0.28, 0.48, darkFactor) * params.intensity;

  col = mix(col, col + finalRadiance, clamp(cloudDensity * intensityScale * textShield, 0.0, 1.0));

  // Filmic tone-mapping to compress dynamic highlights
  col = tonemap(col);

  // Golden-ratio temporal dithering to eliminate 8-bit gradient banding
  let dither = (hash21(uv * vec2f(params.width, params.height) + fract(params.time * 0.6180339887)) - 0.5) / 255.0;
  col += vec3f(dither);

  return vec4f(col, 1.0);
}
`;

export const NACREOUS_CLOUDS_SHADER = prepareShader(WGSL_NACREOUS_CLOUDS, 'nacreous_clouds_shader');

export interface VgpuNacreousCloudsProps {
  className?: string;
  intensity?: number;
}

export function VgpuNacreousClouds({ className = '', intensity = 1.0 }: VgpuNacreousCloudsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrameRef = useRef<((time: number) => void) | null>(null);
  const isReducedMotionRef = useRef(false);

  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  const { mode, effective } = useThemeMode();
  const themeModeRef = useRef(mode);
  const effectiveThemeRef = useRef(effective);

  useEffect(() => {
    themeModeRef.current = mode;
    effectiveThemeRef.current = effective;
    if (isReducedMotionRef.current && renderFrameRef.current) {
      renderFrameRef.current(1.0);
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
        isReducedMotionRef.current = isReducedMotion;

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

        const nacreousEffect = effect(gpu, NACREOUS_CLOUDS_SHADER, {
          label: 'nacreous-clouds',
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

        await nacreousEffect.compile(canvasSurface);
        if (disposed) {
          gpu.dispose();
          return;
        }

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

          frame(gpu, (f) => f.pass(canvasSurface, nacreousEffect));
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

            currentMouseX += (targetMouseX - currentMouseX) * 0.05;
            currentMouseY += (targetMouseY - currentMouseY) * 0.05;

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

            f.pass(canvasSurface, nacreousEffect);
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
        console.warn('[VgpuNacreousClouds] WebGPU initialization bypassed:', err);
        setIsSupported(false);
        setIsWebGPUActive(false);
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
      {/* Fallback CSS Nacreous Pastel Iridescence Gradient Layer */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-0' : 'opacity-100'
        } bg-gradient-to-tr from-purple-950/20 via-slate-900/40 to-teal-950/20 dark:from-purple-950/50 dark:via-slate-950/70 dark:to-teal-950/40`}
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
