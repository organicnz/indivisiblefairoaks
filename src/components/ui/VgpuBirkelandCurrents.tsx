'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Birkeland Field-Aligned Helical Plasma Currents (Interconnected Civic Networks)
export const WGSL_BIRKELAND_CURRENTS = `
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

  let t = params.time * 0.5;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background deep ionospheric twilight gradient
  let bgDarkStart = vec3f(0.02, 0.035, 0.09);
  let bgDarkEnd   = vec3f(0.045, 0.07, 0.18);
  let bgLightStart = vec3f(0.93, 0.96, 0.99);
  let bgLightEnd   = vec3f(0.86, 0.91, 0.97);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  // Dual intertwined helical Birkeland current ropes
  let helixFreq = 5.5;
  let helixSpeed = t * 1.5;
  let helixPhase1 = p.x * helixFreq + helixSpeed;
  let helixPhase2 = p.x * helixFreq + helixSpeed + 3.14159;

  let yHelix1 = sin(helixPhase1) * 0.18 + fbm(vec2f(p.x * 2.0, t * 0.2)) * 0.08;
  let yHelix2 = sin(helixPhase2) * 0.18 + fbm(vec2f(p.x * 2.0 + 1.5, t * 0.2)) * 0.08;

  let distH1 = abs(p.y - yHelix1);
  let distH2 = abs(p.y - yHelix2);

  // Filamentary sub-threads within the current rope
  let fineFilaments1 = pow(noise(vec2f(p.x * 32.0 - t * 2.0, p.y * 14.0)), 2.0) * 1.6;
  let fineFilaments2 = pow(noise(vec2f(p.x * 32.0 + t * 2.0, p.y * 14.0)), 2.0) * 1.6;

  let currentRope1 = exp(-distH1 * 12.0) * (0.7 + fineFilaments1 * 0.7);
  let currentRope2 = exp(-distH2 * 12.0) * (0.7 + fineFilaments2 * 0.7);

  // Electrostatic node discharge around mouse position
  let cursorDischarge = exp(-mouseDist * 3.0) * 0.55 * params.intensity;

  // Emission spectral colors:
  // 1. Electric Sapphire (470 nm)
  let sapphire = vec3f(0.18, 0.65, 0.98);
  // 2. Ionized Emerald (557.7 nm)
  let emerald  = vec3f(0.15, 0.95, 0.60);
  // 3. Auroral Amethyst (427.8 nm)
  let amethyst = vec3f(0.78, 0.28, 0.92);

  let colorRope1 = mix(sapphire, emerald, sin(p.x * 3.0 + t) * 0.5 + 0.5);
  let colorRope2 = mix(amethyst, sapphire, cos(p.x * 3.0 - t) * 0.5 + 0.5);

  let totalEmission = (currentRope1 * colorRope1 + currentRope2 * colorRope2 + cursorDischarge * emerald) * 1.45;

  let lum = (currentRope1 + currentRope2 + cursorDischarge * 0.8) * mix(0.42, 0.94, darkFactor) * params.intensity;
  col = mix(col, col + totalEmission, clamp(lum, 0.0, 1.0));

  // High-altitude ion flow sparkles
  let ionCoord = floor(p * 45.0);
  let ionRand = hash21(ionCoord);
  if (ionRand > 0.978 && darkFactor > 0.35) {
    let ionTwinkle = sin(t * 5.0 + ionRand * 30.0) * 0.5 + 0.5;
    col += sapphire * ionTwinkle * 0.4 * darkFactor;
  }

  return vec4f(col, 1.0);
}
`;

export const BIRKELAND_CURRENTS_SHADER = prepareShader(
  WGSL_BIRKELAND_CURRENTS,
  'birkeland_currents_shader'
);

export interface VgpuBirkelandCurrentsProps {
  className?: string;
  intensity?: number;
}

export function VgpuBirkelandCurrents({
  className = '',
  intensity = 1.0,
}: VgpuBirkelandCurrentsProps) {
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

        const birkelandEffect = effect(gpu, BIRKELAND_CURRENTS_SHADER, {
          label: 'birkeland-currents',
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

        void birkelandEffect.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, birkelandEffect));
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

            f.pass(canvasSurface, birkelandEffect);
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
          className="absolute inset-0 bg-radial from-cyan-600/20 via-surface-muted/30 to-background/90 dark:from-cyan-900/30 dark:via-secondary/40 dark:to-background pointer-events-none"
          style={{ viewTransitionName: 'none' }}
        />
      )}
    </div>
  );
}
