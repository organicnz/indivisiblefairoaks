'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Geomagnetic Cusp & True North Magnetic Arcs
export const WGSL_GEOMAGNETIC_CUSP = `
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

// Volumetric magnetic flux tube cross section (Gaussian core + diffuse plasma halo)
fn fluxTube(distField: f32, fi: f32) -> f32 {
  let coreScale = 14.0 - fi * 0.8;
  let haloScale = 3.6 - fi * 0.2;
  let core = exp(-pow(distField * coreScale, 2.0));
  let halo = exp(-abs(distField) * haloScale) * 0.45;
  return core + halo;
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

  // Deep magnetospheric backdrop
  let bgDarkStart = vec3f(0.03, 0.06, 0.16);
  let bgDarkEnd   = vec3f(0.06, 0.11, 0.28);
  let bgLightStart = vec3f(0.93, 0.96, 1.0);
  let bgLightEnd   = vec3f(0.86, 0.91, 0.97);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  // Magnetic Cusp Apex: Located at (0.0, -0.32)
  let cuspCenter = vec2f(0.0, -0.32);

  // Soft magnetic reconnection deflection from mouse pointer
  let mouseForce = (mouseP - p) * exp(-pow(mouseDist * 2.2, 2.0)) * 0.30 * params.intensity;
  let pWarped = p + mouseForce;

  // Fluid domain warp modeling magnetohydrodynamic turbulence
  let warpX = fbm(vec2f(pWarped.x * 2.0, t * 0.3)) * 0.04;

  var totalFlux = 0.0;
  var fluxColor = vec3f(0.0);

  let goldCol   = vec3f(0.98, 0.78, 0.24);
  let cyanCol   = vec3f(0.22, 0.78, 0.98);
  let violetCol = vec3f(0.68, 0.36, 0.98);

  // Generate 7 volumetric geomagnetic dipole arches
  for (var i = 1; i <= 7; i = i + 1) {
    let fi = f32(i);
    let archHeight = -0.30 + fi * 0.11;
    let archCurvature = 1.05 + fi * 0.42;

    // Field line equation with subtle fluid undulation
    let expectedY = archHeight - (pWarped.x * pWarped.x) * archCurvature + warpX * (fi * 0.25);
    let distField = abs(pWarped.y - expectedY);

    // Plasma flow along the magnetic flux tube
    let alongArc = pWarped.x * (1.8 + fi * 0.45);
    let flowPulse = sin(alongArc * 6.0 - t * (1.4 + fi * 0.25) + fi * 1.2) * 0.5 + 0.5;
    let waveFbm = noise(vec2f(alongArc * 3.5, t * 0.35 + fi));

    let fluxLine = fluxTube(distField, fi) * (0.55 + flowPulse * 0.45 * waveFbm);

    // Color gradient across field lines:
    // Inner cusp glows with gold/amber civic guidance, outer arches glow with sapphire cyan and violet
    let archColor = mix(goldCol, mix(cyanCol, violetCol, fi / 7.0), smoothstep(1.0, 5.0, fi));

    totalFlux += fluxLine;
    fluxColor += fluxLine * archColor;
  }

  // Central Polar Cusp Funnel Glow (True North beacon)
  let distCusp = length(pWarped - cuspCenter);
  let cuspCore = exp(-pow(distCusp * 2.8, 2.0));
  let cuspHalo = exp(-distCusp * 1.4) * 0.45;
  let cuspGlow = (cuspCore + cuspHalo) * (sin(t * 1.8) * 0.12 + 0.88);
  fluxColor += goldCol * cuspGlow * 0.9;
  totalFlux += cuspGlow * 0.65;

  // Theme-adaptive composite:
  // In Dark Mode: Luminous plasma glow against deep magnetosphere
  // In Light Mode: Saturated radiant amber-cyan guidance arcs
  let darkRadiance = fluxColor * 1.35;
  let lightRadiance = mix(col * 0.8 + fluxColor * 0.6, goldCol, 0.2);
  let sysRadiance = mix(lightRadiance, darkRadiance, darkFactor);

  let finalRadiance = lightRadiance * modeLight + darkRadiance * modeDark + sysRadiance * modeSystem;
  let intensityScale = mix(0.48, 0.92, darkFactor) * params.intensity;

  col = mix(col, col + finalRadiance, clamp(totalFlux * intensityScale, 0.0, 1.0));

  // Filmic tone-mapping to compress dynamic highlights
  col = tonemap(col);

  // Golden-ratio temporal dithering to eliminate 8-bit gradient banding
  let dither = (hash21(uv * vec2f(params.width, params.height) + fract(params.time * 0.6180339887)) - 0.5) / 255.0;
  col += vec3f(dither);

  return vec4f(col, 1.0);
}
`;

export const GEOMAGNETIC_CUSP_SHADER = prepareShader(WGSL_GEOMAGNETIC_CUSP, 'geomagnetic_cusp_shader');

export interface VgpuGeomagneticCuspProps {
  className?: string;
  intensity?: number;
}

export function VgpuGeomagneticCusp({ className = '', intensity = 1.0 }: VgpuGeomagneticCuspProps) {
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

        const cuspEffect = effect(gpu, GEOMAGNETIC_CUSP_SHADER, {
          label: 'geomagnetic-cusp',
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

        await cuspEffect.compile(canvasSurface);
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

          frame(gpu, (f) => f.pass(canvasSurface, cuspEffect));
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

            f.pass(canvasSurface, cuspEffect);
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
        console.warn('[VgpuGeomagneticCusp] WebGPU initialization bypassed:', err);
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
      {/* Fallback CSS Magnetic Aura Gradient Layer */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-0' : 'opacity-100'
        } bg-gradient-to-tr from-blue-950/20 via-slate-900/40 to-amber-950/20 dark:from-blue-950/50 dark:via-slate-950/70 dark:to-amber-950/40`}
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
