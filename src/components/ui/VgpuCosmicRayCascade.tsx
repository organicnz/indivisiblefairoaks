'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Cosmic Ray Cherenkov Filament Cascades
export const WGSL_COSMIC_RAY_CASCADE = `
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

fn hash11(p: f32) -> f32 {
  var p3 = fract(vec3f(p) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn distToSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.7;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Deep space celestial backdrop
  let bgDarkStart = vec3f(0.015, 0.03, 0.09);
  let bgDarkEnd   = vec3f(0.04, 0.07, 0.18);
  let bgLightStart = vec3f(0.93, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.85, 0.89, 0.96);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.75);

  var totalCascade = vec3f(0.0);
  var cascadeLum = 0.0;

  let cherenkovBlue = vec3f(0.18, 0.45, 0.98);
  let ionizationViolet = vec3f(0.72, 0.32, 0.98);
  let trackWhite = vec3f(0.95, 0.98, 1.0);

  // Simulate 8 ongoing cosmic ray cascade air-showers
  for (var i = 0; i < 8; i = i + 1) {
    let fi = f32(i);
    let cycleTime = 2.4 + fi * 0.3;
    let localTime = fract((t + fi * 0.73) / cycleTime);
    let epoch = floor((t + fi * 0.73) / cycleTime);

    // Initial shower origin
    let originX = (hash11(epoch * 17.3 + fi) - 0.5) * aspect * 1.4;
    let originY = -0.6 + hash11(epoch * 31.7 + fi) * 0.2;
    let startPoint = vec2f(originX, originY);

    // Trajectory angle with downward momentum
    let angle = -1.1 + (hash11(epoch * 43.1 + fi) - 0.5) * 0.45;
    let lengthTrack = 0.45 + hash11(epoch * 59.2 + fi) * 0.35;
    let dir = vec2f(cos(angle), -sin(angle));

    let progress = smoothstep(0.0, 0.6, localTime);
    let currentTip = startPoint + dir * (lengthTrack * progress);
    let currentTail = startPoint + dir * (lengthTrack * max(0.0, progress - 0.35));

    let distLine = distToSegment(p, currentTail, currentTip);
    let lifeFade = exp(-pow(localTime - 0.3, 2.0) * 12.0);

    // Sharp ionization core and diffuse Cherenkov cone
    let core = exp(-distLine * 95.0) * lifeFade * 1.5;
    let cherenkovGlow = exp(-distLine * 16.0) * lifeFade * 0.65;

    let particleColor = mix(cherenkovBlue, trackWhite, clamp(core * 1.2, 0.0, 1.0));
    let showerCol = particleColor * core + ionizationViolet * cherenkovGlow;

    totalCascade += showerCol;
    cascadeLum += (core + cherenkovGlow);
  }

  // Interactive mouse ionization shower
  let mouseGlow = exp(-mouseDist * 18.0) * 0.8 * params.intensity;
  let mouseCone = exp(-mouseDist * 3.5) * 0.3 * params.intensity;
  totalCascade += (trackWhite * mouseGlow + cherenkovBlue * mouseCone);
  cascadeLum += (mouseGlow + mouseCone);

  let intensityScale = mix(0.48, 0.95, darkFactor) * params.intensity;
  col = mix(col, col + totalCascade * 1.4, clamp(cascadeLum * intensityScale, 0.0, 1.0));

  // Distant stars visible through photographic plate
  let starHash = hash21(floor(p * 60.0));
  if (starHash > 0.985 && darkFactor > 0.35) {
    let twinkle = sin(t * 3.0 + starHash * 15.0) * 0.5 + 0.5;
    col += vec3f(0.85, 0.92, 1.0) * (starHash - 0.985) * 60.0 * twinkle * darkFactor;
  }

  return vec4f(col, 1.0);
}
`;

export const COSMIC_RAY_CASCADE_SHADER = prepareShader(WGSL_COSMIC_RAY_CASCADE, 'cosmic_ray_cascade_shader');

export interface VgpuCosmicRayCascadeProps {
  className?: string;
  intensity?: number;
}

export function VgpuCosmicRayCascade({ className = '', intensity = 1.0 }: VgpuCosmicRayCascadeProps) {
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

        const cascadeEffect = effect(gpu, COSMIC_RAY_CASCADE_SHADER, {
          label: 'cosmic-ray-cascade',
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

        void cascadeEffect.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, cascadeEffect));
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

            f.pass(canvasSurface, cascadeEffect);
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
        console.warn('[VgpuCosmicRayCascade] WebGPU initialization bypassed:', err);
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
      {/* Fallback CSS Cosmic Cherenkov Gradient Layer */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-0' : 'opacity-100'
        } bg-gradient-to-tr from-indigo-950/20 via-slate-900/40 to-blue-950/30 dark:from-indigo-950/50 dark:via-slate-950/70 dark:to-blue-950/50`}
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
