'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for Ionospheric Radar & Radio Propagation (High-Altitude Atmospheric Beacons)
export const WGSL_IONOSPHERIC_RADAR = `
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

// C-infinity smooth dual-lobe volumetric envelope (zero razor cusps)
fn dualLobe(d: f32, coreW: f32, haloW: f32) -> f32 {
  let core = exp(-((d * d) / (coreW * coreW)));
  let halo = exp(-((d * d) / (haloW * haloW))) * 0.35;
  return core + halo;
}

// Dispersive Thomson scatter radio wave packet with Gaussian envelope
fn wavePacket(dist: f32, t: f32, freq: f32, speed: f32) -> f32 {
  let phase = dist * freq - t * speed;
  let wave = cos(phase) * 0.5 + 0.5;
  let envelope = exp(-dist * 1.5) * smoothstep(0.05, 0.3, dist);
  return wave * envelope;
}

// Multi-octave ionospheric plasma domain warping
fn plasmaWarp(p: vec2f, t: f32) -> vec2f {
  let q = vec2f(
    fbm(p + vec2f(t * 0.06, -t * 0.04)),
    fbm(p + vec2f(4.1 - t * 0.03, 2.7 + t * 0.05))
  );
  let r = vec2f(
    fbm(p + 2.5 * q + vec2f(1.2 - t * 0.05, 7.3 + t * 0.03)),
    fbm(p + 2.5 * q + vec2f(6.8 + t * 0.03, 1.9 - t * 0.04))
  );
  return p + 0.28 * r;
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

  let t = params.time * 0.4;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background ionospheric twilight gradient
  let bgDarkStart = vec3f(0.012, 0.028, 0.07);
  let bgDarkEnd   = vec3f(0.035, 0.06, 0.15);
  let bgLightStart = vec3f(0.94, 0.96, 0.99);
  let bgLightEnd   = vec3f(0.86, 0.91, 0.97);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  // Center beacon location (Sacramento Valley civic nexus)
  let beaconOrigin = vec2f(0.0, -0.15);
  let pWarp = plasmaWarp(p - beaconOrigin, t * 0.25);
  let distToBeacon = length(pWarp);

  // Volumetric dispersive Thomson scatter radio wavefronts
  let primaryWave = wavePacket(distToBeacon, t, 12.0, 1.1);
  let secondaryWave = wavePacket(distToBeacon, t * 1.3, 18.0, 0.9) * 0.6;
  let radarWave = primaryWave + secondaryWave;

  // Beacon nexus luminous core
  let beaconCore = dualLobe(length(p - beaconOrigin), 0.06, 0.28);

  // Volumetric Mesospheric Sodium airglow sheet (589 nm)
  let airglowY = p.y - 0.08;
  let airglowWave = sin(p.x * 4.5 + t * 0.6 + fbm(vec2f(p.x * 2.0, t * 0.15)) * 1.8) * 0.06;
  let airglowDist = abs(airglowY - airglowWave);
  let airglowSheet = dualLobe(airglowDist, 0.05, 0.16) * (0.65 + 0.35 * sin(p.x * 3.0 + t * 0.4));

  // Dynamic resonant probing at cursor
  let mouseWave = dualLobe(mouseDist, 0.07, 0.32) * (cos(mouseDist * 16.0 - t * 2.5) * 0.5 + 0.5) * params.intensity;

  // Emission spectral lines:
  // 1. High-frequency radar carrier cyan (480 nm)
  let cyanSignal = vec3f(0.18, 0.82, 0.96);
  // 2. Sodium airglow gold layer (589 nm)
  let goldLayer  = vec3f(0.98, 0.76, 0.24);
  // 3. Violet ionospheric carrier
  let violetCarrier = vec3f(0.60, 0.32, 0.94);

  let signalColor = mix(cyanSignal, goldLayer, smoothstep(-0.2, 0.3, p.y));
  let totalEmission = radarWave * signalColor * 1.3 + airglowSheet * goldLayer * 1.2 + (beaconCore * 0.7 + mouseWave) * violetCarrier * 1.5;

  // Theme-adaptive transfer
  let darkRad = col + totalEmission * mix(0.7, 1.2, params.intensity);
  let lightRad = col * (1.0 - (radarWave * 0.22 + airglowSheet * 0.2)) + (radarWave * cyanSignal * 0.65 + airglowSheet * goldLayer * 0.6 + mouseWave * violetCarrier * 0.7);
  var radiance = mix(lightRad, darkRad, darkFactor);

  radiance = tonemap(radiance);

  // Golden ratio temporal blue-noise dither
  let dither = (hash21(uv * 1264.56 + vec2f(params.time * 0.015, params.time * 0.025)) - 0.5) * (1.0 / 255.0);
  radiance += vec3f(dither);

  return vec4f(clamp(radiance, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const IONOSPHERIC_RADAR_SHADER = prepareShader(
  WGSL_IONOSPHERIC_RADAR,
  'ionospheric_radar_shader'
);

export interface VgpuIonosphericRadarProps {
  className?: string;
  intensity?: number;
}

export function VgpuIonosphericRadar({
  className = '',
  intensity = 1.0,
}: VgpuIonosphericRadarProps) {
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

        const radarEffect = effect(gpu, IONOSPHERIC_RADAR_SHADER, {
          label: 'ionospheric-radar',
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

        await radarEffect.compile(canvasSurface);
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

          frame(gpu, (f) => f.pass(canvasSurface, radarEffect));
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

            f.pass(canvasSurface, radarEffect);
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
          className="absolute inset-0 bg-radial from-secondary/40 via-surface-muted/30 to-background/90 dark:from-secondary/70 dark:via-secondary/40 dark:to-background pointer-events-none"
          style={{ viewTransitionName: 'none' }}
        />
      )}
    </div>
  );
}
