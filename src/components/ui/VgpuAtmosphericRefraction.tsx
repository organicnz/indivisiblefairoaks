'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Atmospheric Refraction, Horizon Mirage & Coherent LIDAR Probing Beam
// Atmospheric dispersion & optical mirage scanning symbolizing deep search & discovery.
export const WGSL_ATMOSPHERIC_REFRACTION = `
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

// C2-continuous quintic smootherstep (zero 1st/2nd derivative discontinuities)
fn smootherstep(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / max(e1 - e0, 0.00001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// C2-continuous quintic Hermite value noise
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

// Multi-octave fractional Brownian motion with smooth octave decay
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

// C-infinity dual-lobe volumetric Gaussian envelope (zero razor cusps or sharp creases)
fn dualLobe(d: f32, coreW: f32, haloW: f32) -> f32 {
  let core = exp(-((d * d) / max(coreW * coreW, 0.00001)));
  let halo = exp(-((d * d) / max(haloW * haloW, 0.00001))) * 0.38;
  return core + halo;
}

// Multi-octave Kolmogorov atmospheric turbulence domain warping
fn mirageWarp(p: vec2f, t: f32) -> vec2f {
  let q = vec2f(
    fbm(p + vec2f(t * 0.045, -t * 0.035)),
    fbm(p + vec2f(4.2 - t * 0.03, 1.7 + t * 0.045))
  );
  let r = vec2f(
    fbm(p + 2.5 * q + vec2f(1.5 - t * 0.035, 7.8 + t * 0.03)),
    fbm(p + 2.5 * q + vec2f(6.4 + t * 0.035, 2.3 - t * 0.045))
  );
  return p + 0.26 * r;
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

  let t = params.time * 0.36;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmospheric horizon gradient with twilight Rayleigh extinction
  let bgDarkStart = vec3f(0.012, 0.026, 0.065);
  let bgDarkEnd   = vec3f(0.032, 0.058, 0.145);
  let bgLightStart = vec3f(0.935, 0.955, 0.992);
  let bgLightEnd   = vec3f(0.865, 0.905, 0.965);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  let horizonBlend = smootherstep(-0.55, 0.45, p.y) * 0.72;
  var col = mix(bgStart, bgEnd, horizonBlend);

  let pWarp = mirageWarp(p, t * 0.20);

  // 1. Volumetric Coherent LIDAR Probing Beam
  // Models Gaussian waist expansion: w(y) = w0 * sqrt(1 + ((y - y0) / zR)^2)
  let scanX = sin(t * 0.65) * (aspect * 0.38) + sin(t * 0.22) * (aspect * 0.08);
  let beamAngle = -0.14 + sin(t * 0.22) * 0.04;
  let beamCenter = scanX + (p.y + 0.5) * beamAngle;
  let beamDist = p.x - beamCenter;

  // Expanding beam waist along optical propagation axis
  let beamWaist = 0.045 + 0.025 * abs(p.y + 0.35);
  let beamHaloWaist = 0.18 + 0.08 * abs(p.y + 0.35);
  let beamGlow = dualLobe(beamDist, beamWaist, beamHaloWaist);

  // Rayleigh backscattering modulation along the LIDAR beam column
  let rayleighScatter = 0.82 + 0.18 * sin(p.y * 10.0 - t * 3.8);
  let lidarBeam = beamGlow * rayleighScatter;

  // 2. Volumetric Atmospheric Inversion Layer & Fata Morgana Horizon Mirage
  // Continuous thermal gradient with physical refractive bending
  let mirageBaseY = -0.15;
  let thermalWave = sin(pWarp.x * 5.5 + t * 1.4) * 0.018 +
                    fbm(vec2f(pWarp.x * 2.2, t * 0.28)) * 0.022;

  let mirageDist1 = pWarp.y - mirageBaseY - thermalWave;
  let mirageDist2 = pWarp.y - (mirageBaseY + 0.075) + thermalWave * 0.65;

  let mirageLayer1 = dualLobe(mirageDist1, 0.052, 0.18);
  let mirageLayer2 = dualLobe(mirageDist2, 0.058, 0.19);

  // 3. Physical Cauchy Chromatic Dispersion & Emerald Green Flash Phenomenon
  // n(lambda) = A + B / lambda^2 -> green (532 nm), cyan (488 nm), ruby amber (589 nm)
  let colEmerald = vec3f(0.22, 0.96, 0.55);
  let colCyan    = vec3f(0.20, 0.84, 0.98);
  let colAmber   = vec3f(0.98, 0.76, 0.26);
  let colViolet  = vec3f(0.66, 0.38, 0.96);

  // Upper rim grazing dispersion produces the emerald flash
  let greenFlashHorizon = exp(-((pWarp.y - (mirageBaseY + 0.02)) * (pWarp.y - (mirageBaseY + 0.02))) / 0.0016);
  let greenFlash = greenFlashHorizon * (0.6 + 0.4 * sin(pWarp.x * 4.0 + t * 2.0));

  let dispersion1 = mix(colEmerald, colCyan, sin(p.x * 2.8 + t * 0.9) * 0.5 + 0.5);
  let dispersion2 = mix(colViolet, colAmber, cos(p.x * 3.2 - t * 0.8) * 0.5 + 0.5);
  let mirageColor = dispersion1 * mirageLayer1 + dispersion2 * mirageLayer2 + colEmerald * greenFlash * 0.85;

  // 4. Active Search Optic Lens (Airy disk caustic with soft Bessel rings)
  let airyPhase = mouseDist * 28.0;
  let airyRings = cos(airyPhase) * exp(-mouseDist * 7.5) * 0.35;
  let searchOpticGlow = dualLobe(mouseDist, 0.085, 0.36);
  let searchOptic = max(0.0, searchOpticGlow + airyRings * smootherstep(0.4, 0.05, mouseDist)) * params.intensity;

  // Total Luminous Refractive Emission
  let totalEmission = lidarBeam * colCyan * 1.30 +
                      mirageColor * 1.32 +
                      searchOptic * mix(colAmber, colCyan, 0.52) * 1.75;

  // Theme-adaptive transfer
  let darkRad = col + totalEmission * mix(0.72, 1.25, params.intensity);
  let lightRad = col * (1.0 - (mirageLayer1 * 0.18 + lidarBeam * 0.16 + greenFlashHorizon * 0.12)) +
                 (lidarBeam * colCyan * 0.62 + mirageColor * 0.65 + searchOptic * colAmber * 0.72);
  var radiance = mix(lightRad, darkRad, darkFactor);

  radiance = tonemap(radiance);

  // Golden ratio temporal blue-noise dither
  let dither = (hash21(uv * 1234.56 + vec2f(params.time * 0.015, params.time * 0.025)) - 0.5) * (1.0 / 255.0);
  radiance += vec3f(dither);

  return vec4f(clamp(radiance, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const ATMOSPHERIC_REFRACTION_SHADER = prepareShader(
  WGSL_ATMOSPHERIC_REFRACTION,
  'atmospheric_refraction_shader'
);

export interface VgpuAtmosphericRefractionProps {
  className?: string;
  intensity?: number;
}

export function VgpuAtmosphericRefraction({
  className = '',
  intensity = 1.0,
}: VgpuAtmosphericRefractionProps) {
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

        const refractionEffect = effect(gpu, ATMOSPHERIC_REFRACTION_SHADER, {
          label: 'atmospheric-refraction',
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

        await refractionEffect.compile(canvasSurface);
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

          frame(gpu, (f) => f.pass(canvasSurface, refractionEffect));
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
            isVisible = entry?.isIntersecting ?? true;
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

            f.pass(canvasSurface, refractionEffect);
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
      } catch {
        if (!disposed) {
          setIsSupported(false);
          setIsWebGPUActive(false);
        }
      }
    }

    initWebGPU();

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
      <canvas
        ref={canvasRef}
        className={`w-full h-full block transition-opacity duration-700 ease-out ${
          isWebGPUActive ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ viewTransitionName: 'none' }}
      />
      {(!isWebGPUActive || isSupported === false) && (
        <div
          className="absolute inset-0 bg-radial from-emerald-600/20 via-surface-muted/30 to-background/90 dark:from-emerald-800/30 dark:via-secondary/40 dark:to-background pointer-events-none"
          style={{ viewTransitionName: 'none' }}
        />
      )}
    </div>
  );
}
