'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Solar Corona & Prominence Magnetic Loops (Grassroots Lifeblood Energy)
export const WGSL_SOLAR_CORONA = `
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

  let t = params.time * 0.4;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background deep space chromosphere
  let bgDarkStart = vec3f(0.02, 0.03, 0.08);
  let bgDarkEnd   = vec3f(0.06, 0.05, 0.12);
  let bgLightStart = vec3f(0.98, 0.95, 0.90);
  let bgLightEnd   = vec3f(0.94, 0.88, 0.82);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.8);

  // Central solar limb offset just below the banner
  let sunCenter = vec2f(0.0, -0.45);
  let r = length(p - sunCenter);
  let theta = atan2(p.y - sunCenter.y, p.x - sunCenter.x);

  // Radial coronal streamers with magnetic field twist
  let streamerRays = sin(theta * 14.0 + t * 0.6 + fbm(vec2f(theta * 3.0, t * 0.15)) * 3.0) * 0.5 + 0.5;
  let fineStreamers = pow(noise(vec2f(theta * 42.0 - t * 0.3, r * 4.0)), 2.0) * 1.5;
  let coronaDecay = exp(-max(r - 0.25, 0.0) * 3.8);
  let coronaStreamers = coronaDecay * (0.6 + streamerRays * 0.8 + fineStreamers * 0.6);

  // Prominence plasma loops arching over the solar limb
  let loopPhase = theta * 6.0 + sin(t * 0.7) * 0.4;
  let loopHeight = 0.38 + sin(loopPhase) * 0.12 + fbm(vec2f(p.x * 4.0, t * 0.5)) * 0.06;
  let loopDistance = abs(r - loopHeight);
  let prominenceLoop = exp(-loopDistance * 18.0) * (0.7 + 0.3 * sin(theta * 24.0 + t * 2.0));

  // Kinetic flare perturbation at cursor (solar eruption)
  let flareIntensity = exp(-mouseDist * 3.2) * 0.65 * params.intensity;

  // H-Alpha (656.3 nm) & Helium (587.6 nm) emission colors:
  let hAlphaRed = vec3f(0.96, 0.24, 0.18);
  let heliumGold = vec3f(0.99, 0.76, 0.22);
  let pearlCorona = vec3f(1.0, 0.94, 0.82);

  let plasmaColor = mix(hAlphaRed, heliumGold, smoothstep(0.3, 0.7, r));
  let coronaColor = mix(plasmaColor, pearlCorona, smoothstep(0.4, 0.9, r));

  let totalRadiance = (coronaStreamers * coronaColor + prominenceLoop * hAlphaRed + flareIntensity * heliumGold) * 1.5;

  let lum = (coronaStreamers + prominenceLoop * 0.8 + flareIntensity) * mix(0.45, 0.92, darkFactor) * params.intensity;
  col = mix(col, col + totalRadiance, clamp(lum, 0.0, 1.0));

  return vec4f(col, 1.0);
}
`;

export const SOLAR_CORONA_SHADER = prepareShader(WGSL_SOLAR_CORONA, 'solar_corona_shader');

export interface VgpuSolarCoronaProps {
  className?: string;
  intensity?: number;
}

export function VgpuSolarCorona({ className = '', intensity = 1.0 }: VgpuSolarCoronaProps) {
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

        const coronaEffect = effect(gpu, SOLAR_CORONA_SHADER, {
          label: 'solar-corona',
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

        void coronaEffect.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, coronaEffect));
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
          className="absolute inset-0 bg-radial from-amber-500/20 via-surface-muted/30 to-background/90 dark:from-amber-600/25 dark:via-secondary/40 dark:to-background pointer-events-none"
          style={{ viewTransitionName: 'none' }}
        />
      )}
    </div>
  );
}
