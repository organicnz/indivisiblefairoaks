// @vitest-environment node
import { effect, frame, init, target, uniforms } from 'vgpu/mock';
import { describe, expect, it } from 'vitest';
import { THEME_WGSL } from '@/components/layout/VgpuThemeCanvas';
import { WGSL_CHOIR_HARMONICS } from '@/components/ui/VgpuChoirHarmonics';
import { WGSL_ATMOSPHERE } from '@/components/ui/VgpuCivicAtmosphere';
import { WGSL_CONSTELLATION } from '@/components/ui/VgpuCivicConstellation';

describe('VGPU WebGPU Shader Compilation & Pipeline Verification', () => {
  it('compiles THEME_WGSL without WGSL errors and executes a multi-wave render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    const zeroWave = {
      origin: [0.5, 0.5],
      progress: 0.0,
      theme: 0.0,
      intensity: 0.0,
      effective: 0.0,
      enabled: 0.0,
      phase: 0.0,
    };

    const initialGlobals = {
      aspect: 1.0,
      time: 1.25,
      resolution: [256, 256],
      mouse: [0.5, 0.5],
      pointerActive: 1.0,
      pointerSpeed: 1.5,
      wave1: {
        ...zeroWave,
        enabled: 1.0,
        progress: 0.45,
        theme: 2.0,
        intensity: 0.9,
        effective: 1.0,
      },
      wave2: {
        ...zeroWave,
        enabled: 1.0,
        progress: 0.25,
        theme: 1.0,
        intensity: 0.7,
        effective: 0.0,
      },
      wave3: {
        ...zeroWave,
        enabled: 1.0,
        progress: 0.12,
        theme: 0.0,
        intensity: 0.5,
        effective: 0.0,
      },
      wave4: { ...zeroWave },
      wave5: { ...zeroWave },
      wave6: { ...zeroWave },
      wave7: { ...zeroWave },
      wave8: { ...zeroWave },
    };

    const sharedGlobals = uniforms(gpu, initialGlobals);

    const themeEffect = effect(gpu, THEME_WGSL, {
      label: 'test-theme-wavefront',
      blend: 'alpha',
      set: {
        globals: sharedGlobals,
      },
    });

    await themeEffect.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 0] }, (p) => {
          p.draw(themeEffect);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_ATMOSPHERE with theme parameters and executes render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    const atmosphere = effect(gpu, WGSL_ATMOSPHERE, {
      label: 'test-civic-atmosphere',
      set: {
        params: {
          time: 2.0,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 2.0, // dark mode
          effectiveTheme: 1.0,
        },
      },
    });

    await atmosphere.compile(renderTarget);

    // Verify dynamic light theme parameter update
    atmosphere.set({
      params: {
        themeMode: 1.0, // light mode
        effectiveTheme: 0.0,
      },
    });

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(atmosphere);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_CONSTELLATION with theme parameters and executes render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    const constellation = effect(gpu, WGSL_CONSTELLATION, {
      label: 'test-civic-constellation',
      set: {
        params: {
          time: 3.5,
          width: 256,
          height: 256,
          mouseX: 0.4,
          mouseY: 0.6,
          intensity: 0.9,
          themeMode: 0.0, // system mode
          effectiveTheme: 0.0,
        },
      },
    });

    await constellation.compile(renderTarget);

    // Verify dark palette transition
    constellation.set({
      params: {
        themeMode: 2.0,
        effectiveTheme: 1.0,
      },
    });

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(constellation);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_CHOIR_HARMONICS with vocal ribbon harmonics and executes render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    const choir = effect(gpu, WGSL_CHOIR_HARMONICS, {
      label: 'test-choir-harmonics',
      set: {
        params: {
          time: 5.0,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 1.0, // light mode
          effectiveTheme: 0.0,
        },
      },
    });

    await choir.compile(renderTarget);

    // Verify dynamic dark resonance
    choir.set({
      params: {
        themeMode: 2.0,
        effectiveTheme: 1.0,
      },
    });

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(choir);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });
});
