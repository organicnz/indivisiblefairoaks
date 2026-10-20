'use client';

import { useEffect, useRef, useState } from 'react';
import { useThemeMode } from '@/components/layout/theme-store';

// Pure WGSL shader for VGPU with dynamic theme-adaptive chromatic auroras
export const WGSL_ATMOSPHERE = `
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

  let a = hash21(i + vec2f(0.0, 0.0));
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2f(100.0);
  var pos = p;
  for (var i = 0; i < 4; i++) {
    v += a * noise(pos);
    pos = pos * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.16;

  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseGlow = exp(-mouseDist * 2.6) * 0.42 * params.intensity;

  let q = vec2f(
    fbm(p * 1.3 + vec2f(t * 0.35, t * 0.18)),
    fbm(p * 1.3 + vec2f(-t * 0.28, t * 0.45))
  );

  let r = vec2f(
    fbm(p * 1.6 + q * 1.3 + vec2f(t * 0.5, -t * 0.25)),
    fbm(p * 1.6 + q * 1.3 + vec2f(-t * 0.35, t * 0.6))
  );

  // Continuous partition of unity across optical profiles:
  // themeMode = 2.0 (Dark: Obsidian Kerr Singularity & Relativistic Vortex)
  // themeMode = 1.0 (Light: Solar Diamond Caustics with Prismatic Dispersion)
  // themeMode = 0.0 (System: Quantum Bloch Sphere Geodesic Superposition)
  let modeDark = clamp(params.themeMode - 1.0, 0.0, 1.0);
  let modeLight = clamp(1.0 - abs(params.themeMode - 1.0), 0.0, 1.0);
  let modeSystem = clamp(1.0 - params.themeMode, 0.0, 1.0);

  // 1. Relativistic Kerr vortex warping (Dark mode)
  let kerrAngle = atan2(p.y - mouseP.y, p.x - mouseP.x);
  let kerrVortex = sin(kerrAngle * 4.0 + mouseDist * 28.0 - t * 3.5) * 0.06 * exp(-mouseDist * 2.2) * modeDark;

  // 2. Solar crystal wave interference caustics (Light mode)
  let k1 = (p.x * 24.0 + t * 2.2);
  let k2 = (-0.5 * p.x + 0.866 * p.y) * 24.0 - t * 1.8;
  let caustics = (cos(k1) + cos(k2)) * 0.025 * modeLight;

  // 3. Quantum wave packets & Bloch sphere geodesic superposition (System mode)
  let blochTheta = wave * 3.14159265;
  let blochPhi = t * 2.5 + dot(p, vec2f(1.618, 1.0)) * 5.0;
  let quantumFringe = sin(blochTheta) * cos(blochPhi) * 0.04 * modeSystem;

  let waveMod = wave + kerrVortex + caustics + quantumFringe;
  let auroraRibbon = smoothstep(0.35, 0.75, sin(waveMod * 4.5 + t * 0.8) * 0.5 + 0.5);

  let darkFactor = clamp(params.effectiveTheme, 0.0, 1.0);

  // Dark Cosmic Midnight Palette (Civic Sapphire #16305c)
  let darkBase     = vec3f(0.086, 0.188, 0.361);
  let darkMidnight = vec3f(0.11, 0.23, 0.44);
  let darkSapphire = vec3f(0.14, 0.32, 0.65);
  let darkCyanGlow = vec3f(0.25, 0.68, 0.95);
  let darkAmber    = vec3f(0.96, 0.74, 0.24);

  // Light Solar Dawn Radiant Palette (Solar Dawn #eef4ff)
  let lightBase     = vec3f(0.933, 0.957, 1.0);
  let lightMidnight = vec3f(0.88, 0.92, 0.98);
  let lightSapphire = vec3f(0.80, 0.88, 0.99);
  let lightCyanGlow = vec3f(0.45, 0.75, 0.98);
  let lightAmber    = vec3f(0.98, 0.82, 0.45);

  // System Quantum Superposition Palette
  let sysBase      = mix(vec3f(0.933, 0.957, 1.0), vec3f(0.086, 0.188, 0.361), darkFactor);
  let sysMidnight  = mix(vec3f(0.88, 0.92, 0.98), vec3f(0.11, 0.23, 0.44), darkFactor);
  let sysSapphire  = mix(vec3f(0.80, 0.88, 0.99), vec3f(0.14, 0.32, 0.65), darkFactor);
  let sysEmerald   = mix(vec3f(0.45, 0.75, 0.98), vec3f(0.25, 0.68, 0.95), darkFactor);
  let sysAmber     = mix(vec3f(0.98, 0.82, 0.45), vec3f(0.96, 0.74, 0.24), darkFactor);

  // Dynamic chromatic morphing across theme transitions
  let baseDark = lightBase * modeLight + darkBase * modeDark + sysBase * modeSystem;
  let midnight = lightMidnight * modeLight + darkMidnight * modeDark + sysMidnight * modeSystem;
  let sapphire = lightSapphire * modeLight + darkSapphire * modeDark + sysSapphire * modeSystem;
  let cyanGlow = lightCyanGlow * modeLight + darkCyanGlow * modeDark + sysEmerald * modeSystem;
  let amberGold = lightAmber * modeLight + darkAmber * modeDark + sysAmber * modeSystem;

  var col = mix(baseDark, midnight, smoothstep(0.05, 0.45, waveMod));
  col = mix(col, sapphire, smoothstep(0.35, 0.75, waveMod));
  col = mix(col, cyanGlow, auroraRibbon * 0.45);
  col = mix(col, amberGold, pow(smoothstep(0.65, 0.95, waveMod), 2.8) * 0.40);

  col += cyanGlow * mouseGlow;
  col += amberGold * (mouseGlow * 0.4);

  // Organic twinkling democratic stardust & solar sparkles
  let starGrid = uv * vec2f(45.0 * aspect, 45.0);
  let starCell = floor(starGrid);
  let starRandom = hash21(starCell);
  if (starRandom > 0.972) {
    let starPos = fract(starGrid) - 0.5;
    let starDist = length(starPos);
    let pulse = sin(params.time * 2.0 + starRandom * 6.28) * 0.5 + 0.5;
    let starLight = exp(-starDist * 18.0) * pulse * 0.65;
    col += mix(cyanGlow, amberGold, starRandom) * starLight;
  }

  // Dark-mode vignette; in light mode keep luminous edges
  let vig = mix(1.0, (1.0 - length(uv - 0.5) * 0.62) * (1.0 - uv.y * 0.3), darkFactor);
  col *= max(vig, 0.25);

  return vec4f(col, 1.0);
}
`;

interface VgpuCivicAtmosphereProps {
  className?: string;
  intensity?: number;
}

export function VgpuCivicAtmosphere({ className = '', intensity = 1.0 }: VgpuCivicAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [_isSupported, setIsSupported] = useState<boolean | null>(null);

  const { mode, effective } = useThemeMode();
  const themeModeRef = useRef(mode);
  const effectiveThemeRef = useRef(effective);
  const isReducedMotionRef = useRef(false);
  const renderFrameRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    themeModeRef.current = mode;
    effectiveThemeRef.current = effective;
    if (isReducedMotionRef.current && renderFrameRef.current) {
      renderFrameRef.current(1.0);
    }
  }, [mode, effective]);

  useEffect(() => {
    let disposed = false;
    let cleanupFn: (() => void) | null = null;

    // Check reduced motion and WebGPU support before any GPU work
    if (typeof window === 'undefined' || !('gpu' in navigator)) {
      setIsSupported(false);
      return;
    }

    const isReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isReducedMotionRef.current = isReducedMotion;

    async function initVGPU() {
      try {
        const {
          init,
          effect,
          frame,
          frameLoop,
          surface,
          clock,
          uniforms: uniformsFn,
        } = await import('vgpu');
        if (disposed) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

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

        setIsSupported(true);
        setIsWebGPUActive(true);

        const canvasSurface = surface(gpu, canvas, { dpr: [1, 2.5] });

        let currentMouseX = 0.5;
        let currentMouseY = 0.5;
        let targetMouseX = 0.5;
        let targetMouseY = 0.5;

        let targetEffective = effectiveThemeRef.current === 'dark' ? 1.0 : 0.0;
        let currentEffective = targetEffective;
        let targetMode =
          themeModeRef.current === 'dark' ? 2.0 : themeModeRef.current === 'light' ? 1.0 : 0.0;
        let currentMode = targetMode;

        const handleMouseMove = (e: MouseEvent) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            targetMouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            targetMouseY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        let currentWidth = canvasSurface.size[0];
        let currentHeight = canvasSurface.size[1];

        // Shared GPU uniform buffer — zero-allocation per-frame updates
        const sharedParams = uniformsFn(gpu, {
          time: 0,
          width: currentWidth,
          height: currentHeight,
          mouseX: currentMouseX,
          mouseY: currentMouseY,
          intensity,
          themeMode: currentMode,
          effectiveTheme: currentEffective,
        });

        const atmosphere = effect(gpu, WGSL_ATMOSPHERE, {
          label: 'civic-atmosphere',
          set: { params: sharedParams },
        });

        // Pre-warm the GPU render pipeline
        void atmosphere.compile(canvasSurface);

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

          frame(gpu, (f) => f.pass(canvasSurface, atmosphere));
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

        // Pause GPU frame updates when scrolled off screen
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              isVisible = entry.isIntersecting;
            }
          },
          { threshold: 0.05 }
        );

        if (containerRef.current) {
          observer.observe(containerRef.current);
        }

        let loop: { stop: () => void } | null = null;

        if (isReducedMotion) {
          renderFrame(1.0);
        } else {
          const timeTracker = clock(gpu);

          loop = frameLoop(gpu, (f) => {
            if (!isVisible) return;

            // Smooth lerp mouse coords
            currentMouseX += (targetMouseX - currentMouseX) * 0.06;
            currentMouseY += (targetMouseY - currentMouseY) * 0.06;

            // Smooth chromatic transition across theme toggles and optical profiles
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

            f.pass(canvasSurface, atmosphere);
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

    initVGPU();

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
      {/* WebGPU Canvas */}
      <canvas
        ref={canvasRef}
        style={{ viewTransitionName: 'none' }}
        className={`w-full h-full block transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback & Ambient Layer for devices without WebGPU or while shader warms up */}
      <div
        className={`absolute inset-0 overflow-hidden bg-gradient-to-br transition-opacity duration-1000 ${
          effective === 'dark'
            ? 'from-slate-950 via-blue-950 to-indigo-950'
            : 'from-blue-100/60 via-indigo-50/40 to-slate-100/70'
        } ${isWebGPUActive ? 'opacity-20' : 'opacity-100'}`}
      >
        <div
          className={`absolute -top-[30%] -left-[10%] w-[70vw] h-[70vw] rounded-full blur-[120px] animate-pulse duration-[8000ms] ${
            effective === 'dark' ? 'bg-blue-600/15' : 'bg-blue-400/20'
          }`}
        />
        <div
          className={`absolute top-[20%] -right-[15%] w-[60vw] h-[60vw] rounded-full blur-[140px] animate-pulse duration-[10000ms] ${
            effective === 'dark' ? 'bg-indigo-500/15' : 'bg-indigo-300/20'
          }`}
        />
        <div
          className={`absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] rounded-full blur-[130px] animate-pulse duration-[12000ms] ${
            effective === 'dark' ? 'bg-cyan-400/10' : 'bg-cyan-300/15'
          }`}
        />
      </div>
    </div>
  );
}
