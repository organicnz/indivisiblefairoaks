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

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = vec2f((uv.x - params.origin.x) * params.aspect, uv.y - params.origin.y);
  let dist = length(p);
  let wave_pos = params.progress * 2.5;
  let d = dist - wave_pos;
  let wave_width = 0.38;
  let wave = smoothstep(wave_width, 0.0, abs(d));

  if (wave <= 0.001) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  let chromatic_offset = 0.025 * (1.0 - params.progress);
  let d_r = dist - (wave_pos + chromatic_offset);
  let d_b = dist - (wave_pos - chromatic_offset);
  let wave_r = smoothstep(wave_width, 0.0, abs(d_r));
  let wave_b = smoothstep(wave_width, 0.0, abs(d_b));

  var base_color: vec3f;
  if (params.theme > 1.5) {
    // Dark Mode: Obsidian Sapphire & Electric Blue (#155dfc, #8ec5ff)
    base_color = vec3f(0.08, 0.36, 0.98);
  } else if (params.theme > 0.5) {
    // Light Mode: Radiant Amber & Solar Gold (#f59e0b, #fbbf24)
    base_color = vec3f(0.96, 0.62, 0.04);
  } else {
    // System Mode: Quantum Silver & Cyan Harmonic (#38bdf8)
    base_color = vec3f(0.22, 0.74, 0.97);
  }

  let final_r = base_color.r * wave_r;
  let final_g = base_color.g * wave;
  let final_b = base_color.b * wave_b;

  let alpha = wave * params.intensity * 0.38;
  return vec4f(final_r * alpha, final_g * alpha, final_b * alpha, alpha);
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

        currentSurface = surface(gpuInstance, canvas, { dpr: [1, 2] });
        themeEffect = effect(gpuInstance, THEME_WGSL, {
          label: 'atomic-theme-wavefront',
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
      }

      setIsActive(true);

      const width = window.innerWidth;
      const height = Math.max(1, window.innerHeight);
      const aspect = width / height;

      const originX = event.coords?.x !== undefined ? event.coords.x / width : 0.5;
      const originY = event.coords?.y !== undefined ? event.coords.y / height : 0.5;
      const themeValue = event.mode === 'dark' ? 2.0 : event.mode === 'light' ? 1.0 : 0.0;

      const startTime = performance.now();
      const DURATION = 550; // ms

      const step = (currentTime: number) => {
        if (disposed) return;
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(1.0, elapsed / DURATION);

        // Quintic sensory easing: 1 - (1 - t)^5
        const progress = 1.0 - (1.0 - rawProgress) ** 5;
        // Fade intensity out smoothly in second half of duration
        const intensity = rawProgress < 0.3 ? rawProgress / 0.3 : 1.0 - (rawProgress - 0.3) / 0.7;

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
      className={`fixed inset-0 pointer-events-none z-[135] size-full transition-opacity duration-300 ${
        isActive ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
