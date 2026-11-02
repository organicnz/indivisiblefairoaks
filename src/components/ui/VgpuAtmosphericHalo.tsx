'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { useThemeMode } from '@/components/layout/theme-store';

// WGSL Shader for 22° Atmospheric Ice Halo & Parhelia (Sun Dogs)
// Optical refraction through hexagonal cirrostratus ice crystals symbolizing civic clarity & wisdom.
export const WGSL_ATMOSPHERIC_HALO = `
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
  var shift = vec2f(85.0, 85.0);
  var q = p;
  for (var i = 0; i < 4; i = i + 1) {
    v += a * noise(q);
    q = q * 2.1 + shift;
    a *= 0.5;
  }
  return v;
}

// C-infinity smooth dual-lobe volumetric envelope (zero razor cusps)
fn dualLobe(d: f32, coreW: f32, haloW: f32) -> f32 {
  let d2 = d * d;
  let core = exp(-d2 / (2.0 * coreW * coreW));
  let halo = exp(-d2 / (2.0 * haloW * haloW)) * 0.45;
  return core + halo;
}

// Multi-octave cirrostratus cloud domain warping
fn cirrusWarp(p: vec2f, t: f32) -> vec2f {
  let q = vec2f(
    fbm(p + vec2f(t * 0.04, -t * 0.03)),
    fbm(p + vec2f(3.4 - t * 0.02, 1.8 + t * 0.04))
  );
  let r = vec2f(
    fbm(p + 2.4 * q + vec2f(1.9 - t * 0.03, 6.2 + t * 0.03)),
    fbm(p + 2.4 * q + vec2f(5.8 + t * 0.03, 2.7 - t * 0.04))
  );
  return p + 0.24 * r;
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

  let t = params.time * 0.32;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect * 0.35, (params.mouseY - 0.5) * 0.35);

  // Solar / Lunar light source center (subtly influenced by cursor)
  let sunCenter = mouseP * 0.28;
  let pWarp = cirrusWarp(p, t * 0.18);
  let r = length(p - sunCenter);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background cirrostratus atmospheric sky gradient
  let bgDarkStart = vec3f(0.015, 0.032, 0.07);
  let bgDarkEnd   = vec3f(0.04, 0.065, 0.15);
  let bgLightStart = vec3f(0.93, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.86, 0.91, 0.97);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smootherstep(-0.5, 0.5, p.y) * 0.7);

  // Cirrostratus ice crystal sheet modulation
  let cirrus = fbm(vec2f(pWarp.x * 2.2 + t * 0.10, pWarp.y * 3.0 - t * 0.05));
  let iceCrystalDensity = 0.72 + cirrus * 0.42;

  // 22° Halo Ring (minimum angle of deviation ~0.38 in normalized coordinates)
  let haloRadius = 0.38;
  let distFromHalo = r - haloRadius;

  // Continuous chromatic dispersion across halo boundary:
  // Red inner fringe (less deviated), diamond white core, ice-blue outer veil
  let redDispersion  = dualLobe(distFromHalo + 0.018, 0.045, 0.14);
  let goldDispersion = dualLobe(distFromHalo, 0.048, 0.16);
  let blueDispersion = dualLobe(distFromHalo - 0.024, 0.055, 0.18);

  let colRed  = vec3f(0.98, 0.38, 0.22);
  let colGold = vec3f(0.98, 0.85, 0.42);
  let colBlue = vec3f(0.38, 0.75, 0.98);
  let colIce  = vec3f(0.88, 0.95, 1.0);

  let haloColor = colRed * redDispersion * 0.85 +
                  colGold * goldDispersion * 1.1 +
                  colBlue * blueDispersion * 0.95 +
                  colIce * (redDispersion + blueDispersion) * 0.35;

  // Parhelia (Sun Dogs): bright optical spots at azimuth 0 and PI on the 22° ring
  let dogLeftDist  = length(p - sunCenter - vec2f(-haloRadius, 0.0));
  let dogRightDist = length(p - sunCenter - vec2f(haloRadius, 0.0));

  let parhelionLeft  = dualLobe(dogLeftDist, 0.09, 0.30) * iceCrystalDensity;
  let parhelionRight = dualLobe(dogRightDist, 0.09, 0.30) * iceCrystalDensity;

  // Smooth horizontal parhelic white tails extending outward
  let tailY = abs(p.y - sunCenter.y);
  let leftTail = dualLobe(tailY, 0.05, 0.18) * smootherstep(-haloRadius * 2.5, -haloRadius, p.x - sunCenter.x) * smootherstep(-haloRadius * 0.8, -haloRadius, p.x - sunCenter.x);
  let rightTail = dualLobe(tailY, 0.05, 0.18) * smootherstep(haloRadius * 2.5, haloRadius, p.x - sunCenter.x) * smootherstep(haloRadius * 0.8, haloRadius, p.x - sunCenter.x);

  let parheliaGlow = (parhelionLeft + parhelionRight) * 1.4 + (leftTail + rightTail) * 0.35;

  // Upper Tangent Arc: kisses the top of the 22° halo with smooth parabolic curve
  let tangentApex = sunCenter + vec2f(0.0, haloRadius);
  let tangentY = tangentApex.y + pow((p.x - tangentApex.x) * 1.4, 2.0);
  let distTangent = abs(p.y - tangentY);
  let tangentArc = dualLobe(distTangent, 0.06, 0.20) * smootherstep(0.45, 0.0, abs(p.x - tangentApex.x)) * 0.65;

  // Central solar glow
  let solarGlow = dualLobe(r, 0.12, 0.42) * 0.40;

  // Center text-legibility shield: preserves high contrast for foreground typography
  let textShield = mix(0.55, 1.0, smootherstep(0.05, 0.65, length(p * vec2f(0.85, 1.4))));

  // Total optical emission: soft, delicate ice crystal reflections
  let totalHalo = (haloColor * iceCrystalDensity * 0.38 +
                   parheliaGlow * colGold * 0.40 +
                   tangentArc * colIce * 0.32 +
                   solarGlow * mix(colGold, colIce, 0.5) * 0.30) * textShield;

  // Theme-adaptive transfer: delicate, elegant ambient glow maintaining high text contrast
  let darkRad = col + totalHalo * mix(0.35, 0.55, params.intensity);
  let lightRad = col * (1.0 - (goldDispersion * 0.08 + parheliaGlow * 0.06) * textShield) +
                 (haloColor * 0.18 + parheliaGlow * colGold * 0.16 + solarGlow * colGold * 0.16) * textShield;
  var radiance = mix(lightRad, darkRad, darkFactor);

  radiance = tonemap(radiance);

  // Golden ratio temporal blue-noise dither
  let dither = (hash21(uv * 1244.56 + vec2f(params.time * 0.015, params.time * 0.025)) - 0.5) * (1.0 / 255.0);
  radiance += vec3f(dither);

  return vec4f(clamp(radiance, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const ATMOSPHERIC_HALO_SHADER = prepareShader(
  WGSL_ATMOSPHERIC_HALO,
  'atmospheric_halo_shader'
);

export interface VgpuAtmosphericHaloProps {
  className?: string;
  intensity?: number;
}

export function VgpuAtmosphericHalo({
  className = '',
  intensity = 1.0,
}: VgpuAtmosphericHaloProps) {
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

        const haloEffect = effect(gpu, ATMOSPHERIC_HALO_SHADER, {
          label: 'atmospheric-halo',
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

        await haloEffect.compile(canvasSurface);
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

          frame(gpu, (f) => f.pass(canvasSurface, haloEffect));
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

            f.pass(canvasSurface, haloEffect);
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
          className="absolute inset-0 bg-radial from-amber-500/20 via-surface-muted/30 to-background/90 dark:from-amber-600/25 dark:via-secondary/40 dark:to-background pointer-events-none"
          style={{ viewTransitionName: 'none' }}
        />
      )}
    </div>
  );
}
