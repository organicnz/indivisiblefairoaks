'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Noctilucent Mesospheric Wave Bands
export const WGSL_NOCTILUCENT_WAVES = `
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
    q = q * 2.02 + shift;
    a *= 0.5;
  }
  return v;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.32;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Deep twilit mesosphere backdrop
  let bgDarkStart = vec3f(0.02, 0.05, 0.15);
  let bgDarkEnd   = vec3f(0.04, 0.09, 0.24);
  let bgLightStart = vec3f(0.92, 0.96, 1.0);
  let bgLightEnd   = vec3f(0.85, 0.90, 0.98);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smootherstep(-0.5, 0.5, p.y) * 0.75);

  // Soft atmospheric wind shear from cursor
  let windShear = (mouseP - p) * exp(-mouseDist * mouseDist * 4.0) * 0.28 * params.intensity;
  let pWarp = p + windShear;

  // Multi-scale atmospheric gravity wave field with fluid shear instability
  let warpFlow = vec2f(
    fbm(vec2f(pWarp.x * 1.8 + t * 0.18, pWarp.y * 1.2)),
    fbm(vec2f(pWarp.x * 1.8 - t * 0.14, pWarp.y * 1.2 + 3.0))
  );

  // Primary longitudinal gravity wave
  let wave1 = sin(pWarp.x * 4.8 + pWarp.y * 2.8 - t * 0.75 + warpFlow.x * 1.4);
  // Secondary transverse billow train (Kelvin-Helmholtz curls)
  let wave2 = cos(pWarp.x * 6.8 - pWarp.y * 4.5 + t * 0.55 + warpFlow.y * 1.2);
  // Delicate sub-micron ice crystal filaments (organic undulating ripples)
  let ripples = sin(pWarp.x * 12.0 + pWarp.y * 8.0 - t * 0.85 + warpFlow.x * 0.8) * 0.5 + 0.5;

  // Gaussian height envelopes concentrating clouds in middle-upper mesopause
  let dEnv1 = (pWarp.y - 0.06);
  let envelope1 = exp(-dEnv1 * dEnv1 * 14.0);
  let dEnv2 = (pWarp.y + 0.16);
  let envelope2 = exp(-dEnv2 * dEnv2 * 18.0);

  let billows1 = smootherstep(-0.35, 0.85, (wave1 + wave2 * 0.6) * 0.55) * (0.65 + ripples * 0.35);
  let billows2 = smootherstep(-0.40, 0.80, (-wave1 * 0.65 + wave2) * 0.50) * (0.70 + ripples * 0.30);

  let nlcDensity = (billows1 * envelope1 + billows2 * envelope2 * 0.75);

  // Wavelength colors: Sub-horizon sunlight scattering on pure ice crystals (85 km)
  let iceCyan    = vec3f(0.25, 0.82, 0.98);
  let iceSilver  = vec3f(0.90, 0.96, 1.0);
  let deepAzure  = vec3f(0.14, 0.48, 0.92);
  let twilightGold = vec3f(0.98, 0.82, 0.45);

  let nlcColor = mix(iceCyan, iceSilver, smootherstep(0.15, 0.75, nlcDensity));

  // Center text-legibility shield: preserves high contrast for foreground typography
  let textShield = mix(0.55, 1.0, smootherstep(0.05, 0.65, length(p * vec2f(0.85, 1.4))));

  // Theme-adaptive composite: soft mesospheric glow ensuring clear text legibility
  let darkRadiance = (nlcColor * nlcDensity * 0.38 + deepAzure * (nlcDensity * 0.15)) * textShield;
  let lightRadiance = mix(col * 0.90 + nlcColor * (nlcDensity * 0.18), twilightGold, 0.06 * nlcDensity) * textShield;
  let sysRadiance = mix(lightRadiance, darkRadiance, darkFactor);

  let finalRadiance = lightRadiance * modeLight + darkRadiance * modeDark + sysRadiance * modeSystem;
  let intensityScale = mix(0.28, 0.48, darkFactor) * params.intensity;

  col = mix(col, col + finalRadiance, clamp(nlcDensity * intensityScale * textShield, 0.0, 1.0));

  // Filmic tone-mapping to compress dynamic highlights
  col = tonemap(col);

  // Golden-ratio temporal dithering to eliminate 8-bit gradient banding
  let dither = (hash21(uv * vec2f(params.width, params.height) + fract(params.time * 0.6180339887)) - 0.5) / 255.0;
  col += vec3f(dither);

  return vec4f(col, 1.0);
}
`;

export const NOCTILUCENT_WAVES_SHADER = prepareShader(WGSL_NOCTILUCENT_WAVES, 'noctilucent_waves_shader');

export interface VgpuNoctilucentWavesProps {
  className?: string;
  intensity?: number;
}

export function VgpuNoctilucentWaves({ className = '', intensity = 1.0 }: VgpuNoctilucentWavesProps) {
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

        const nlcEffect = effect(gpu, NOCTILUCENT_WAVES_SHADER, {
          label: 'noctilucent-waves',
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

        await nlcEffect.compile(canvasSurface);
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

          frame(gpu, (f) => f.pass(canvasSurface, nlcEffect));
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

            f.pass(canvasSurface, nlcEffect);
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
        console.warn('[VgpuNoctilucentWaves] WebGPU initialization bypassed:', err);
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
      {/* Fallback CSS Noctilucent Wave Gradient Layer */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-0' : 'opacity-100'
        } bg-gradient-to-tr from-cyan-950/20 via-slate-900/40 to-blue-950/30 dark:from-cyan-950/50 dark:via-slate-950/70 dark:to-blue-950/50`}
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
