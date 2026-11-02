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

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmospheric horizon gradient
  let bgDarkStart = vec3f(0.015, 0.035, 0.08);
  let bgDarkEnd   = vec3f(0.04, 0.075, 0.16);
  let bgLightStart = vec3f(0.92, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.85, 0.90, 0.96);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  // Coherent Probing Beam (LIDAR atmospheric search pulse)
  // Sweeps smoothly horizontally across the field of view
  let scanX = sin(t * 0.8) * (aspect * 0.42);
  let beamAngle = -0.18 + sin(t * 0.3) * 0.06;
  let beamDist = abs((p.x - scanX) - p.y * beamAngle);

  let beamCore = exp(-beamDist * 32.0);
  let beamHalo = exp(-beamDist * 6.0) * 0.4;
  let beamPulse = sin(p.y * 30.0 - t * 8.0) * 0.5 + 0.5;

  let lidarBeam = (beamCore + beamHalo * beamPulse) * 1.5;

  // Atmospheric Inversion Layer & Mirage Waves (Fata Morgana refraction)
  let mirageBaseY = -0.18;
  let inversionDist = abs(p.y - mirageBaseY);
  let thermalWave = sin(p.x * 12.0 + t * 2.5) * 0.018 +
                    fbm(vec2f(p.x * 4.0, t * 0.4)) * 0.025;

  let mirageLayer1 = exp(-pow((p.y - mirageBaseY - thermalWave) * 24.0, 2.0));
  let mirageLayer2 = exp(-pow((p.y - (mirageBaseY + 0.06) + thermalWave * 0.7) * 20.0, 2.0));

  // Chromatic dispersion across refraction layers:
  // Emerald green flash (530 nm), Electric cyan (480 nm), Ruby amber (620 nm)
  let colEmerald = vec3f(0.22, 0.96, 0.55);
  let colCyan    = vec3f(0.20, 0.82, 0.98);
  let colAmber   = vec3f(0.98, 0.76, 0.28);
  let colViolet  = vec3f(0.68, 0.35, 0.98);

  let mirageColor = mix(colEmerald, colCyan, sin(p.x * 5.0 + t) * 0.5 + 0.5) * mirageLayer1 +
                    mix(colViolet, colAmber, cos(p.x * 6.0 - t) * 0.5 + 0.5) * mirageLayer2;

  // Active Search Optic Lens (Cursor interaction: focused caustic ring)
  let causticRing = exp(-pow((mouseDist - 0.12) * 25.0, 2.0)) * 0.7;
  let causticCore = exp(-mouseDist * 18.0) * 0.9;
  let searchOptic = (causticRing + causticCore) * params.intensity;

  // Total Luminous Emission
  let totalLidar = lidarBeam * colCyan;
  let totalMirage = mirageColor * 1.35;
  let totalOptic = searchOptic * mix(colAmber, colCyan, 0.5);

  let totalEmission = (totalLidar + totalMirage + totalOptic) * 1.4;
  let lum = (beamCore + mirageLayer1 * 0.8 + mirageLayer2 * 0.6 + causticCore * 0.8) *
            mix(0.42, 0.92, darkFactor) * params.intensity;

  col = mix(col, col + totalEmission, clamp(lum, 0.0, 1.0));

  // Rayleigh backscatter dust sparkles illuminated by search sweep
  let dustCoord = floor(p * 50.0);
  let dustRand = hash21(dustCoord);
  if (dustRand > 0.98 && darkFactor > 0.3) {
    let proximityToScan = exp(-abs(p.x - scanX) * 8.0);
    let sparkle = (sin(t * 7.0 + dustRand * 50.0) * 0.5 + 0.5) * proximityToScan;
    col += colCyan * sparkle * 0.5 * darkFactor;
  }

  return vec4f(col, 1.0);
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

        void refractionEffect.compile(canvasSurface);

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
