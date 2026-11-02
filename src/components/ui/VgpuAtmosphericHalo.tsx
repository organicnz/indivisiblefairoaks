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
  var shift = vec2f(85.0, 85.0);
  var q = p;
  for (var i = 0; i < 4; i = i + 1) {
    v += a * noise(q);
    q = q * 2.1 + shift;
    a *= 0.5;
  }
  return v;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.4;
  let mouseP = vec2f((params.mouseX - 0.5) * aspect * 0.4, (params.mouseY - 0.5) * 0.4);

  // Solar / Lunar light source center (subtly influenced by cursor)
  let sunCenter = mouseP * 0.35;
  let r = length(p - sunCenter);
  let angle = atan2(p.y - sunCenter.y, p.x - sunCenter.x);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // Background cirrostratus atmospheric sky gradient
  let bgDarkStart = vec3f(0.02, 0.04, 0.08);
  let bgDarkEnd   = vec3f(0.05, 0.08, 0.16);
  let bgLightStart = vec3f(0.92, 0.95, 0.99);
  let bgLightEnd   = vec3f(0.85, 0.91, 0.97);
  let bgSystemStart = mix(bgLightStart, bgDarkStart, darkFactor);
  let bgSystemEnd   = mix(bgLightEnd, bgDarkEnd, darkFactor);

  let bgStart = bgLightStart * modeLight + bgDarkStart * modeDark + bgSystemStart * modeSystem;
  let bgEnd   = bgLightEnd * modeLight + bgDarkEnd * modeDark + bgSystemEnd * modeSystem;

  var col = mix(bgStart, bgEnd, smoothstep(-0.5, 0.5, p.y) * 0.7);

  // Cirrus fibratus cloud veil modulation
  let cirrus = fbm(vec2f(p.x * 3.5 + t * 0.15, p.y * 5.0 - t * 0.08));
  let iceCrystalDensity = 0.7 + cirrus * 0.5;

  // 22° Halo Ring (minimum angle of deviation ~0.38 in screen coords)
  let haloRadius = 0.38;
  let distFromHalo = r - haloRadius;

  // Asymmetric dispersion: sharp inner edge (cutoff), diffused outer tail
  var haloRing = 0.0;
  if (distFromHalo >= -0.04) {
    let innerEdge = smoothstep(-0.04, 0.0, distFromHalo);
    let outerTail = exp(-max(0.0, distFromHalo) * 14.0);
    haloRing = innerEdge * outerTail * iceCrystalDensity;
  }

  // Chromatic dispersion across halo boundary:
  // Red inner fringe (less deviated), diamond white core, ice-blue outer veil
  let redDispersion   = exp(-pow((distFromHalo + 0.015) * 22.0, 2.0));
  let goldDispersion  = exp(-pow(distFromHalo * 20.0, 2.0));
  let blueDispersion  = exp(-pow((distFromHalo - 0.025) * 16.0, 2.0));

  let colRed  = vec3f(0.98, 0.42, 0.22);
  let colGold = vec3f(0.98, 0.86, 0.45);
  let colBlue = vec3f(0.38, 0.72, 0.98);
  let colIce  = vec3f(0.85, 0.94, 1.0);

  var haloColor = colRed * redDispersion * 0.7 +
                  colGold * goldDispersion * 0.9 +
                  colBlue * blueDispersion * 0.8 +
                  colIce * haloRing * 0.4;

  // Parhelia (Sun Dogs): bright optical spots at azimuth 0 and PI on the 22° ring
  let dogLeftDist  = length(p - sunCenter - vec2f(-haloRadius, 0.0));
  let dogRightDist = length(p - sunCenter - vec2f(haloRadius, 0.0));

  let parhelionLeft  = exp(-dogLeftDist * 9.0) * iceCrystalDensity;
  let parhelionRight = exp(-dogRightDist * 9.0) * iceCrystalDensity;

  // Horizontal parhelic white tails extending outward
  let leftTail = exp(-abs(p.y - sunCenter.y) * 28.0) *
                 smoothstep(-haloRadius * 2.2, -haloRadius, p.x - sunCenter.x) *
                 step(p.x - sunCenter.x, -haloRadius);
  let rightTail = exp(-abs(p.y - sunCenter.y) * 28.0) *
                  smoothstep(haloRadius * 2.2, haloRadius, p.x - sunCenter.x) *
                  step(haloRadius, p.x - sunCenter.x);

  let parheliaGlow = (parhelionLeft + parhelionRight) * 1.6 + (leftTail + rightTail) * 0.45;

  // Upper Tangent Arc: kisses the top of the 22° halo
  let tangentApex = sunCenter + vec2f(0.0, haloRadius);
  let tangentY = tangentApex.y + pow((p.x - tangentApex.x) * 1.8, 2.0);
  let distTangent = abs(p.y - tangentY);
  let tangentArc = exp(-distTangent * 18.0) * smoothstep(0.4, 0.0, abs(p.x - tangentApex.x)) * 0.6;

  // Central solar glow
  let solarGlow = exp(-r * 6.5) * 0.7;

  // Total optical emission
  let totalHalo = (haloRing * haloColor +
                   parheliaGlow * colGold +
                   tangentArc * colIce +
                   solarGlow * mix(colGold, colIce, 0.5)) * 1.35;

  let totalLum = (haloRing + parheliaGlow + tangentArc + solarGlow) *
                 mix(0.38, 0.88, darkFactor) * params.intensity;

  col = mix(col, col + totalHalo, clamp(totalLum, 0.0, 1.0));

  // Shimmering diamond dust ice crystals
  let dustCoord = floor(p * 55.0);
  let dustRand = hash21(dustCoord);
  if (dustRand > 0.982 && darkFactor > 0.25) {
    let sparkle = sin(t * 6.0 + dustRand * 40.0) * 0.5 + 0.5;
    col += colIce * sparkle * 0.35 * darkFactor;
  }

  return vec4f(col, 1.0);
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

        void haloEffect.compile(canvasSurface);

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
