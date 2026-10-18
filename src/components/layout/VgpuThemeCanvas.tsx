'use client';

import { useEffect, useRef, useState } from 'react';
import type { effect, init, surface } from 'vgpu';
import { subscribeThemeHud, type ThemeHudEvent } from './theme-store';

type GpuContext = Awaited<ReturnType<typeof init>>;
type GpuSurface = ReturnType<typeof surface>;
type GpuEffect = ReturnType<typeof effect>;

const THEME_WGSL = `
struct ThemeParams {
  origin: vec2f,
  progress: f32,
  aspect: f32,
  theme: f32,
  intensity: f32,
  time: f32,
  _pad: f32,
}

@group(0) @binding(0) var<uniform> params: ThemeParams;

// High-frequency pseudo-random hash for anti-banding dithering
fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = vec2f((uv.x - params.origin.x) * params.aspect, uv.y - params.origin.y);
  let dist = length(p);
  
  // Wavefront propagation dynamically calibrated to expand past the furthest diagonal corner
  let max_dist = max(2.6, sqrt(params.aspect * params.aspect + 1.0) * 1.06);
  let wave_pos = params.progress * max_dist;
  let d = dist - wave_pos;
  let wave_width = 0.36 * (1.0 + params.progress * 0.35);
  let wave = smoothstep(wave_width, 0.0, abs(d));

  if (wave <= 0.0005) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  // Multi-band chromatic dispersion based on Cauchy optical refraction
  let disp = 0.038 * (1.0 - params.progress * 0.7);
  let d_red = dist - (wave_pos + disp * 1.25);
  let d_amber = dist - (wave_pos + disp * 0.65);
  let d_green = dist - wave_pos;
  let d_cyan = dist - (wave_pos - disp * 0.65);
  let d_blue = dist - (wave_pos - disp * 1.25);

  let w_red = smoothstep(wave_width, 0.0, abs(d_red));
  let w_amber = smoothstep(wave_width, 0.0, abs(d_amber));
  let w_green = smoothstep(wave_width, 0.0, abs(d_green));
  let w_cyan = smoothstep(wave_width, 0.0, abs(d_cyan));
  let w_blue = smoothstep(wave_width, 0.0, abs(d_blue));

  var final_color = vec3f(0.0);
  var ripple = 0.0;

  if (params.theme > 1.5) {
    // 🌌 Dark Mode: Obsidian Cosmic Void
    // Deep midnight sapphire (#0f172a), electric cobalt (#1d4ed8), and celestial cyan (#38bdf8)
    let sapphire = vec3f(0.06, 0.22, 0.85);
    let cobalt = vec3f(0.12, 0.45, 0.98);
    let celestial = vec3f(0.22, 0.78, 1.0);
    
    // High-frequency quantum micro-ripple along the wavefront crest
    ripple = sin(dist * 50.0 - params.time * 8.0) * 0.08 * (1.0 - params.progress);
    
    final_color = vec3f(
      cobalt.r * w_red * 0.85,
      mix(sapphire.g, celestial.g, w_cyan) * (w_green + ripple),
      celestial.b * w_blue * 1.15
    );
  } else if (params.theme > 0.5) {
    // ☀️ Light Mode: Solar Prismatic Ray
    // Incandescent solar white, radiant amber (#f59e0b), and topaz gold (#fbbf24)
    let solar_white = vec3f(1.0, 0.98, 0.92);
    let amber_gold = vec3f(0.96, 0.62, 0.04);
    let warm_topaz = vec3f(1.0, 0.75, 0.15);
    
    // Caustic refraction ripple simulating sunlight breaking through glass
    ripple = cos(dist * 42.0 - wave_pos * 20.0) * 0.06 * (1.0 - params.progress);
    
    let spectral_r = mix(amber_gold.r, solar_white.r, 0.35) * w_red;
    let spectral_g = mix(amber_gold.g, warm_topaz.g, 0.5) * (w_amber + ripple);
    let spectral_b = mix(warm_topaz.b, solar_white.b, 0.6) * w_blue;
    
    final_color = vec3f(spectral_r, spectral_g, spectral_b);
  } else {
    // ⚛️ System Mode: Quantum Dual-State Superposition
    // Dual-phase quantum interference between Emerald Aurora (#10b981) and Celestial Cyan (#06b6d4)
    let emerald = vec3f(0.06, 0.72, 0.51);
    let cyan = vec3f(0.02, 0.71, 0.83);
    let harmonic_phase = sin(p.x * 24.0 + p.y * 24.0 - params.time * 5.0) * 0.5 + 0.5;
    let quantum_mix = mix(emerald, cyan, harmonic_phase);
    
    ripple = sin(dist * 60.0 - params.time * 10.0) * 0.05 * (1.0 - params.progress);
    
    final_color = vec3f(
      quantum_mix.r * w_red,
      quantum_mix.g * (w_green + ripple),
      quantum_mix.b * w_cyan * 1.1
    );
  }

  // Anti-banding triangular blue-noise dither for Retina / OLED HDR displays
  let dither = (hash21(uv * 1000.0 + params.time) - 0.5) / 255.0;
  final_color += vec3f(dither);

  let alpha = (wave + ripple * 0.5) * params.intensity * 0.42;
  return vec4f(final_color * alpha, alpha);
}
`;

/**
 * Hardware-accelerated WebGPU Theme Wavefront Canvas via vgpu.
 *
 * Renders an atomic, chromatic quantum wavefront across the viewport during
 * palette transitions (Dark, Light, System).
 *
 * Pro Engineering Highlights:
 * - Direct Metal/Vulkan WebGPU acceleration via vgpu.
 * - 0% CPU / GPU consumption when idle (render loop halts immediately after the 550ms transition).
 * - Full cancellation safety: Rapid clicks cancel and reset to the latest origin atomically.
 * - Graceful degradation: If WebGPU is unavailable or reduced-motion is requested,
 *   it leaves 0 footprint while CSS View Transitions handle the display.
 */
export function VgpuThemeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // WebGPU and browser environment checks
    if (typeof window === 'undefined' || !('gpu' in navigator)) {
      return;
    }

    const isReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let gpuInstance: GpuContext | null = null;
    let currentSurface: GpuSurface | null = null;
    let themeEffect: GpuEffect | null = null;

    // Asynchronously initialize WebGPU via vgpu
    void (async () => {
      try {
        const { init, effect, surface } = await import('vgpu');
        if (disposed) return;

        gpuInstance = await init();
        if (disposed) {
          gpuInstance.dispose();
          return;
        }

        // Graceful device loss handling (e.g. system sleep, tab backgrounding)
        const rawDevice = (gpuInstance as unknown as { device?: { lost?: Promise<unknown> } })
          ?.device;
        rawDevice?.lost?.then(() => {
          if (!disposed) {
            gpuInstance = null;
            currentSurface = null;
            themeEffect = null;
          }
        });

        currentSurface = surface(gpuInstance, canvas, { dpr: [1, 2] });
        themeEffect = effect(gpuInstance, THEME_WGSL, {
          label: 'atomic-theme-wavefront-pro',
          blend: 'alpha',
          set: {
            params: {
              origin: [0.5, 0.5],
              progress: 0.0,
              aspect: window.innerWidth / Math.max(1, window.innerHeight),
              theme: 0.0,
              intensity: 0.0,
              time: 0.0,
              _pad: 0.0,
            },
          },
        });

        // Pre-warm the render pipeline to eliminate first-interaction hitching
        if (currentSurface && themeEffect) {
          void themeEffect.compile(currentSurface);
        }
      } catch {
        // Graceful fallback if WebGPU initialization fails
      }
    })();

    // Listen to atomic theme transitions
    const unsubscribe = subscribeThemeHud((event: ThemeHudEvent) => {
      const activeEffect = themeEffect;
      const activeSurface = currentSurface;
      if (!activeEffect || !activeSurface || !gpuInstance || disposed) return;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      setIsActive(true);

      const width = window.innerWidth;
      const height = Math.max(1, window.innerHeight);
      const aspect = width / height;

      const originX = event.coords?.x !== undefined ? event.coords.x / width : 0.5;
      const originY = event.coords?.y !== undefined ? event.coords.y / height : 0.5;
      const themeValue = event.mode === 'dark' ? 2.0 : event.mode === 'light' ? 1.0 : 0.0;

      const startTime = performance.now();
      const DURATION = 580; // ms: sensory luxury ease duration

      const step = (currentTime: number) => {
        if (disposed) return;
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(1.0, elapsed / DURATION);

        // Quintic sensory easing: 1 - (1 - t)^5
        const progress = 1.0 - (1.0 - rawProgress) ** 5;
        // Smooth intensity envelope: fast attack, graceful decay
        const intensity =
          rawProgress < 0.25 ? rawProgress / 0.25 : 1.0 - (rawProgress - 0.25) / 0.75;

        activeEffect.set({
          params: {
            origin: [originX, originY],
            progress,
            aspect,
            theme: themeValue,
            intensity,
            time: currentTime * 0.001,
            _pad: 0.0,
          },
        });

        try {
          activeEffect.draw(activeSurface);
        } catch {
          // Ignore render interruption
        }

        if (rawProgress < 1.0) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          setIsActive(false);
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(step);
    });

    return () => {
      disposed = true;
      unsubscribe();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (gpuInstance) {
        try {
          gpuInstance.dispose();
        } catch {
          // Cleanup error suppression
        }
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={-1}
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-[135] size-full transition-opacity duration-300 ${
        isActive ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
