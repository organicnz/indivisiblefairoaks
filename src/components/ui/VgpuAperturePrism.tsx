'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Camera Aperture Blades, Prismatic Lens Dispersion & Bokeh Orbs
export const WGSL_APERTURE_PRISM = `
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

  let t = params.time * 0.4;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseAngle = atan2(mouseP.y, mouseP.x);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background atmosphere: Photographic studio ambiance
  let bgDarkStart = vec3f(0.05, 0.09, 0.22);
  let bgDarkEnd   = vec3f(0.08, 0.14, 0.30);
  let bgLightStart = vec3f(0.93, 0.95, 0.98);
  let bgLightEnd   = vec3f(0.87, 0.91, 0.97);
  let bgSystemStart = mix(vec3f(0.93, 0.95, 0.98), vec3f(0.05, 0.09, 0.22), darkFactor);
  let bgSystemEnd   = mix(vec3f(0.87, 0.91, 0.97), vec3f(0.08, 0.14, 0.30), darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.4);

  // 1. Camera Aperture Iris: 8-bladed polygonal diaphragm
  let center = vec2f(0.0, 0.0);
  let lensDist = length(p - center);
  let baseAngle = atan2(p.y, p.x) + t * 0.5 + mouseAngle * 0.2;

  // Modulate 8 blades
  let bladeAngle = fract(baseAngle * 1.27323954) - 0.5; // 8 / (2*PI)
  let bladeDist = lensDist * cos(bladeAngle * 0.785398); // PI / 4

  let irisOpening = 0.22 + 0.05 * sin(t * 1.2) + (params.mouseX - 0.5) * 0.08;
  let irisEdge = abs(bladeDist - irisOpening);
  let bladeGlow = exp(-irisEdge * 16.0) * 0.75;

  // Secondary outer aperture ring
  let outerRing = abs(lensDist - (irisOpening + 0.16));
  let ringGlow = exp(-outerRing * 22.0) * 0.65;

  // 2. Prismatic Optical Dispersion (RGB chromatic aberration)
  let dispersion = 0.02 * (1.0 + params.intensity);
  let rDist = abs(length(p + vec2f(dispersion, 0.0)) - irisOpening);
  let bDist = abs(length(p - vec2f(dispersion, 0.0)) - irisOpening);

  let rGlow = exp(-rDist * 18.0) * 0.7;
  let bGlow = exp(-bDist * 18.0) * 0.7;

  // 3. Floating Bokeh Orbs (Soft out-of-focus camera specular points)
  let bokehGrid = p * 6.5 + vec2f(t * 0.15, sin(t * 0.3) * 0.1);
  let cellId = floor(bokehGrid);
  let localP = fract(bokehGrid) - 0.5;
  let rand = hash21(cellId);

  var bokehGlow = 0.0;
  if (rand > 0.55) {
    let bokehPos = vec2f(sin(rand * 6.28 + t) * 0.2, cos(rand * 6.28 + t * 0.8) * 0.2);
    let d = length(localP - bokehPos);
    let radius = 0.15 + 0.1 * rand;
    // Characteristic annular bokeh ring (bright edge, soft center)
    bokehGlow = smoothstep(radius, radius - 0.02, d) * (0.4 + 0.6 * smoothstep(0.0, radius, d)) * exp(-lensDist * 1.5);
  }

  // Colors: Prismatic Sapphire, Democracy Gold, and Iridescent Magenta
  let goldDark   = vec3f(0.96, 0.76, 0.22);
  let goldLight  = vec3f(0.98, 0.80, 0.28);
  let goldSystem = vec3f(0.95, 0.78, 0.25);
  let goldCol = goldLight * modeLight + goldDark * modeDark + goldSystem * modeSystem;

  let sapphireDark   = vec3f(0.18, 0.55, 0.98);
  let sapphireLight  = vec3f(0.28, 0.65, 0.98);
  let sapphireSystem = vec3f(0.22, 0.60, 0.98);
  let sapphireCol = sapphireLight * modeLight + sapphireDark * modeDark + sapphireSystem * modeSystem;

  let rubyCol = vec3f(0.95, 0.35, 0.55);
  let cyanCol = vec3f(0.25, 0.85, 0.95);

  col += sapphireCol * (bladeGlow + ringGlow);
  col += rubyCol * rGlow;
  col += cyanCol * bGlow;
  col += goldCol * (bokehGlow * 0.5);

  // Mouse optical flare
  let mouseFlare = exp(-mouseDist * 3.6) * 0.7 * params.intensity;
  col += mix(goldCol, sapphireCol, 0.5) * mouseFlare;

  return vec4f(col, 1.0);
}
`;

export const APERTURE_PRISM_SHADER = prepareShader(WGSL_APERTURE_PRISM, 'aperture-prism');

export interface VgpuAperturePrismProps {
  intensity?: number;
  className?: string;
}

export function VgpuAperturePrism({ intensity = 1.0, className = '' }: VgpuAperturePrismProps) {
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

    async function initAperture() {
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

        const aperture = effect(gpu, APERTURE_PRISM_SHADER, {
          label: 'aperture-prism',
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

        void aperture.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, aperture));
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

            f.pass(canvasSurface, aperture);
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

    initAperture();

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
            ? 'from-slate-950 via-slate-900 to-blue-950'
            : 'from-blue-50/70 via-slate-100/60 to-purple-50/30'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute top-[10%] left-[20%] w-[45vw] h-[25vw] rounded-full blur-[100px] animate-pulse duration-[6500ms] ${
            effective === 'dark' ? 'bg-blue-600/15' : 'bg-blue-400/20'
          }`}
        />
        <div
          className={`absolute bottom-[10%] right-[20%] w-[50vw] h-[25vw] rounded-full blur-[110px] animate-pulse duration-[8500ms] ${
            effective === 'dark' ? 'bg-purple-500/15' : 'bg-purple-400/20'
          }`}
        />
      </div>
    </div>
  );
}
