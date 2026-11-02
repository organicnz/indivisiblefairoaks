// @vitest-environment node
import { effect, frame, init, target, uniforms } from 'vgpu/mock';
import { describe, expect, it } from 'vitest';
import { THEME_SHADER, THEME_WGSL } from '@/components/layout/VgpuThemeCanvas';
import {
  CHOIR_HARMONICS_SHADER,
  WGSL_CHOIR_HARMONICS,
} from '@/components/ui/VgpuChoirHarmonics';
import {
  ATMOSPHERE_SHADER,
  WGSL_ATMOSPHERE,
} from '@/components/ui/VgpuCivicAtmosphere';
import {
  CONSTELLATION_SHADER,
  WGSL_CONSTELLATION,
} from '@/components/ui/VgpuCivicConstellation';
import {
  ACTION_PULSES_SHADER,
  WGSL_ACTION_PULSES,
} from '@/components/ui/VgpuActionPulses';
import {
  DEMOCRACY_BEACON_SHADER,
  WGSL_DEMOCRACY_BEACON,
} from '@/components/ui/VgpuDemocracyBeacon';
import {
  DISPATCH_WAVES_SHADER,
  WGSL_DISPATCH_WAVES,
} from '@/components/ui/VgpuDispatchWaves';
import {
  RIVER_CANOPY_SHADER,
  WGSL_RIVER_CANOPY,
} from '@/components/ui/VgpuRiverCanopy';
import {
  APERTURE_PRISM_SHADER,
  WGSL_APERTURE_PRISM,
} from '@/components/ui/VgpuAperturePrism';

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

    expect(THEME_WGSL.length).toBeGreaterThan(0);
    const themeEffect = effect(gpu, THEME_SHADER, {
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

    expect(WGSL_ATMOSPHERE.length).toBeGreaterThan(0);
    const atmosphere = effect(gpu, ATMOSPHERE_SHADER, {
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

    expect(WGSL_CONSTELLATION.length).toBeGreaterThan(0);
    const constellation = effect(gpu, CONSTELLATION_SHADER, {
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
    const constellationParams = {
      themeMode: 2.0,
      effectiveTheme: 1.0,
    };
    constellation.set({
      params: constellationParams,
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

    expect(WGSL_CHOIR_HARMONICS.length).toBeGreaterThan(0);
    const choir = effect(gpu, CHOIR_HARMONICS_SHADER, {
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

  it('compiles WGSL_ACTION_PULSES and executes concentric mobilization render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_ACTION_PULSES.length).toBeGreaterThan(0);
    const pulses = effect(gpu, ACTION_PULSES_SHADER, {
      label: 'test-action-pulses',
      set: {
        params: {
          time: 3.2,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 2.0,
          effectiveTheme: 1.0,
        },
      },
    });

    await pulses.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(pulses);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_DEMOCRACY_BEACON and executes democratic light render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_DEMOCRACY_BEACON.length).toBeGreaterThan(0);
    const beacon = effect(gpu, DEMOCRACY_BEACON_SHADER, {
      label: 'test-democracy-beacon',
      set: {
        params: {
          time: 2.5,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 1.0,
          effectiveTheme: 0.0,
        },
      },
    });

    await beacon.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(beacon);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_DISPATCH_WAVES and executes telegraphic carrier waves render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_DISPATCH_WAVES.length).toBeGreaterThan(0);
    const dispatch = effect(gpu, DISPATCH_WAVES_SHADER, {
      label: 'test-dispatch-waves',
      set: {
        params: {
          time: 4.1,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 0.0,
          effectiveTheme: 0.5,
        },
      },
    });

    await dispatch.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(dispatch);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_RIVER_CANOPY and executes American River currents render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_RIVER_CANOPY.length).toBeGreaterThan(0);
    const river = effect(gpu, RIVER_CANOPY_SHADER, {
      label: 'test-river-canopy',
      set: {
        params: {
          time: 1.8,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 2.0,
          effectiveTheme: 1.0,
        },
      },
    });

    await river.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(river);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_APERTURE_PRISM and executes optical aperture dispersion render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_APERTURE_PRISM.length).toBeGreaterThan(0);
    const prism = effect(gpu, APERTURE_PRISM_SHADER, {
      label: 'test-aperture-prism',
      set: {
        params: {
          time: 6.0,
          width: 256,
          height: 256,
          mouseX: 0.5,
          mouseY: 0.5,
          intensity: 1.0,
          themeMode: 1.0,
          effectiveTheme: 0.0,
        },
      },
    });

    await prism.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(prism);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });
});
