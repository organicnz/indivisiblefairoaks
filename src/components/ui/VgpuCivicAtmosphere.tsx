'use client';

import { useEffect, useRef, useState } from 'react';

// Pure WGSL shader for VGPU
const WGSL_ATMOSPHERE = `
struct Params {
  time: f32,
  width: f32,
  height: f32,
  mouseX: f32,
  mouseY: f32,
  intensity: f32,
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
  let mouseRipple = sin(mouseDist * 24.0 - t * 4.0) * 0.5 + 0.5;
  let mouseGlow = exp(-mouseDist * 2.8) * (0.35 + mouseRipple * 0.25) * params.intensity;

  let q = vec2f(
    fbm(p * 1.3 + vec2f(t * 0.35, t * 0.18)),
    fbm(p * 1.3 + vec2f(-t * 0.28, t * 0.45))
  );

  let r = vec2f(
    fbm(p * 1.6 + q * 1.3 + vec2f(t * 0.5, -t * 0.25)),
    fbm(p * 1.6 + q * 1.3 + vec2f(-t * 0.35, t * 0.6))
  );

  let wave = fbm(p * 2.0 + r * 1.6);
  let auroraRibbon = smoothstep(0.35, 0.75, sin(wave * 4.5 + t * 0.8) * 0.5 + 0.5);

  let baseDark = vec3f(0.015, 0.03, 0.08);
  let midnight = vec3f(0.05, 0.12, 0.32);
  let sapphire = vec3f(0.08, 0.25, 0.65);
  let cyanGlow = vec3f(0.12, 0.68, 0.95);
  let amberGold = vec3f(0.96, 0.74, 0.24);

  var col = mix(baseDark, midnight, smoothstep(0.05, 0.45, wave));
  col = mix(col, sapphire, smoothstep(0.35, 0.75, wave));
  col = mix(col, cyanGlow, auroraRibbon * 0.45);
  col = mix(col, amberGold, pow(smoothstep(0.65, 0.95, wave), 2.8) * 0.40);

  col += cyanGlow * mouseGlow;
  col += amberGold * (mouseGlow * 0.4);

  // Organic twinkling democratic stardust
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

  let vig = (1.0 - length(uv - 0.5) * 0.62) * (1.0 - uv.y * 0.3);
  col *= max(vig, 0.25);

  return vec4f(col, 1.0);
}
`;

interface VgpuCivicAtmosphereProps {
  className?: string;
  intensity?: number;
  showBadge?: boolean;
}

export function VgpuCivicAtmosphere({
  className = '',
  intensity = 1.0,
  showBadge = true,
}: VgpuCivicAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [_isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanupFn: (() => void) | null = null;

    // Check WebGPU availability
    if (typeof window === 'undefined' || !('gpu' in navigator)) {
      setIsSupported(false);
      return;
    }

    async function initVGPU() {
      try {
        const { init, effect, frameLoop, surface, clock } = await import('vgpu');
        if (disposed) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const gpu = await init();
        if (disposed) {
          gpu.dispose();
          return;
        }

        setIsSupported(true);
        setIsWebGPUActive(true);

        const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });

        let currentMouseX = 0.5;
        let currentMouseY = 0.5;
        let targetMouseX = 0.5;
        let targetMouseY = 0.5;

        const handleMouseMove = (e: MouseEvent) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            targetMouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            targetMouseY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        const atmosphere = effect(gpu, WGSL_ATMOSPHERE, {
          label: 'civic-atmosphere',
          set: {
            params: {
              time: 0,
              width: canvasSurface.size[0],
              height: canvasSurface.size[1],
              mouseX: currentMouseX,
              mouseY: currentMouseY,
              intensity,
            },
          },
        });

        const unsubscribeResize = canvasSurface.onResize(({ width, height }) => {
          atmosphere.set({
            params: { width, height },
          });
        });

        const timeTracker = clock(gpu);
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

        const loop = frameLoop(gpu, (frame) => {
          if (!isVisible) return;

          // Smooth lerp mouse coords
          currentMouseX += (targetMouseX - currentMouseX) * 0.06;
          currentMouseY += (targetMouseY - currentMouseY) * 0.06;

          atmosphere.set({
            params: {
              time: timeTracker.time,
              mouseX: currentMouseX,
              mouseY: currentMouseY,
            },
          });

          frame.pass(canvasSurface, atmosphere);
        });

        cleanupFn = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          observer.disconnect();
          unsubscribeResize();
          loop.stop();
          gpu.dispose();
          setIsWebGPUActive(false);
        };
      } catch (err) {
        console.warn(
          'WebGPU acceleration disabled or not supported; falling back to CSS aurora.',
          err
        );
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
        className={`w-full h-full block transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback & Ambient Layer for devices without WebGPU or while shader warms up */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 transition-opacity duration-1000 ${
          isWebGPUActive ? 'opacity-20' : 'opacity-100'
        }`}
      >
        <div className="absolute -top-[30%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-blue-600/15 blur-[120px] animate-pulse duration-[8000ms]" />
        <div className="absolute top-[20%] -right-[15%] w-[60vw] h-[60vw] rounded-full bg-indigo-500/15 blur-[140px] animate-pulse duration-[10000ms]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-cyan-400/10 blur-[130px] animate-pulse duration-[12000ms]" />
      </div>

      {/* Optional Hardware Acceleration Indicator Badge */}
      {showBadge && (
        <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono font-medium text-slate-300 shadow-lg">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWebGPUActive
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                  : 'bg-blue-400'
              }`}
            />
            <span>{isWebGPUActive ? 'WebGPU 60fps' : 'Civic Aurora'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
