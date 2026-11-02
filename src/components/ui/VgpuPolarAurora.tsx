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

fn tonemap(c: vec3f) -> vec3f {
  return (c * (1.0 + c * 0.22)) / (1.0 + c);
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
    q = q * 2.04 + shift;
    a *= 0.5;
  }
  return v;
}

// Dual-lobe atmospheric scattering envelope: smooth Gaussian core + expansive Rayleigh haze
fn auroralLobe(distY: f32, coreScale: f32, haloScale: f32) -> f32 {
  let core = exp(-pow(distY * coreScale, 2.0));
  let halo = exp(-abs(distY) * haloScale) * 0.42;
  return core + halo;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.40;
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

  // Interactive solar wind perturbation from cursor (soft magnetic deflection)
  let solarWind = (mouseP - p) * exp(-pow(mouseDist * 2.2, 2.0)) * 0.35 * params.intensity;
  let pWarp = p + solarWind;

  // Fluid multi-octave domain warping (advective curl turbulence)
  let warpQ = vec2f(
    fbm(vec2f(pWarp.x * 1.4 + t * 0.25, pWarp.y * 0.8)),
    fbm(vec2f(pWarp.x * 1.4 - t * 0.20, pWarp.y * 0.8 + 2.5))
  );

  // Aurora Curtain 1: Primary volumetric drapery fold (120 km altitude oxygen emission)
  let fold1 = sin(pWarp.x * 1.6 + t * 0.65 + warpQ.x * 1.8) * 0.20;
  let distY1 = pWarp.y - fold1;
  let rays1 = smoothstep(0.15, 0.85, noise(vec2f(pWarp.x * 16.0 - t * 0.28 + warpQ.y * 0.9, pWarp.y * 1.4))) * 0.85 + 0.35;
  let curtain1 = auroralLobe(distY1, 6.5, 2.4) * rays1;

  // Aurora Curtain 2: Secondary dancing ribbon (100 km nitrogen-excited shear wave)
  let fold2 = sin(pWarp.x * 2.2 - t * 0.45 + 1.8 + warpQ.y * 1.5) * 0.16 - 0.10;
  let distY2 = pWarp.y - fold2;
  let rays2 = smoothstep(0.2, 0.85, noise(vec2f(pWarp.x * 20.0 + t * 0.35 + warpQ.x * 0.8, pWarp.y * 1.6))) * 0.80 + 0.35;
  let curtain2 = auroralLobe(distY2, 7.5, 2.8) * rays2;

  // Aurora Curtain 3: Distant faint coronal veil (250 km high-altitude thermosphere)
  let fold3 = cos(pWarp.x * 1.2 + t * 0.3 + 3.2 + warpQ.x * 1.2) * 0.14 + 0.14;
  let distY3 = pWarp.y - fold3;
  let curtain3 = auroralLobe(distY3, 5.0, 1.8) * 0.55;

  // Physical emission spectral colors:
  // 1. Radiant emerald atomic oxygen transition (557.7 nm)
  let greenO2 = vec3f(0.14, 0.96, 0.54);
  // 2. Ionized molecular nitrogen border fringe (427.8 nm violet-pink)
  let violetN2 = vec3f(0.82, 0.25, 0.78);
  // 3. High-altitude nitrogen/oxygen crimson crown (630.0 nm)
  let crimsonO2 = vec3f(0.92, 0.20, 0.32);
  // 4. Cyan twilight scattering
  let cyanScatter = vec3f(0.22, 0.78, 0.96);

  // Altitude color dispersion along curtain vertical cross-sections
  let c1Col = mix(violetN2, greenO2, smoothstep(-0.22, 0.04, distY1));
  let finalC1 = mix(c1Col, crimsonO2, smoothstep(0.04, 0.32, distY1));

  let c2Col = mix(violetN2, greenO2, smoothstep(-0.18, 0.06, distY2));
  let finalC2 = mix(c2Col, crimsonO2, smoothstep(0.06, 0.28, distY2));

  let finalC3 = mix(greenO2, crimsonO2, smoothstep(-0.1, 0.25, distY3));

  let totalRadiance = (curtain1 * finalC1 + curtain2 * finalC2 + curtain3 * finalC3);
  let totalDensity = (curtain1 + curtain2 * 0.9 + curtain3 * 0.5) * params.intensity;

  // Theme-adaptive transfer function:
  // In Dark Mode: Luminous emission against Arctic night sky
  // In Light Mode: Saturated prismatic atmospheric scattering (never washing out)
  let darkEmission = totalRadiance * 1.45;
  let lightEmission = mix(col * 0.75 + totalRadiance * 0.65, cyanScatter, 0.25);
  let sysEmission = mix(lightEmission, darkEmission, darkFactor);

  let blendedEmission = lightEmission * modeLight + darkEmission * modeDark + sysEmission * modeSystem;
  let densityFactor = clamp(totalDensity * mix(0.48, 0.92, darkFactor), 0.0, 1.0);

  col = mix(col, col + blendedEmission, densityFactor);

  // Twinkling stars with atmospheric scintillation in dark mode
  let starGrid = floor(pWarp * 55.0);
  let starRand = hash21(starGrid);
  if (starRand > 0.982 && darkFactor > 0.35) {
    let starTwinkle = sin(t * 3.5 + starRand * 25.0) * 0.5 + 0.5;
    let starPos = fract(pWarp * 55.0) - 0.5;
    let starGlow = exp(-pow(length(starPos) * 12.0, 2.0)) * starTwinkle * (1.0 - clamp(totalDensity * 0.9, 0.0, 0.8));
    col += vec3f(0.85, 0.92, 1.0) * starGlow * 0.5 * darkFactor;
  }

  // Filmic tone-mapping to compress HDR highlights
  col = tonemap(col);

  // Golden-ratio temporal dithering to eliminate 8-bit gradient banding
  let dither = (hash21(uv * vec2f(params.width, params.height) + fract(params.time * 0.6180339887)) - 0.5) / 255.0;
  col += vec3f(dither);

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

        await aurora.compile(canvasSurface);
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

            f.pass(canvasSurface, aurora);
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
