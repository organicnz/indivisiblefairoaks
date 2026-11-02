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
  POLAR_AURORA_SHADER,
  WGSL_POLAR_AURORA,
} from '@/components/ui/VgpuPolarAurora';
import {
  GEOMAGNETIC_CUSP_SHADER,
  WGSL_GEOMAGNETIC_CUSP,
} from '@/components/ui/VgpuGeomagneticCusp';
import {
  NOCTILUCENT_WAVES_SHADER,
  WGSL_NOCTILUCENT_WAVES,
} from '@/components/ui/VgpuNoctilucentWaves';
import {
  NACREOUS_CLOUDS_SHADER,
  WGSL_NACREOUS_CLOUDS,
} from '@/components/ui/VgpuNacreousClouds';
import {
  COSMIC_RAY_CASCADE_SHADER,
  WGSL_COSMIC_RAY_CASCADE,
} from '@/components/ui/VgpuCosmicRayCascade';

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

  it('compiles WGSL_POLAR_AURORA and executes auroral curtain render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_POLAR_AURORA.length).toBeGreaterThan(0);
    const aurora = effect(gpu, POLAR_AURORA_SHADER, {
      label: 'test-polar-aurora',
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

    await aurora.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(aurora);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_GEOMAGNETIC_CUSP and executes magnetic dipole plasma funnel render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_GEOMAGNETIC_CUSP.length).toBeGreaterThan(0);
    const cusp = effect(gpu, GEOMAGNETIC_CUSP_SHADER, {
      label: 'test-geomagnetic-cusp',
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

    await cusp.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(cusp);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_NOCTILUCENT_WAVES and executes mesospheric gravity billows render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_NOCTILUCENT_WAVES.length).toBeGreaterThan(0);
    const waves = effect(gpu, NOCTILUCENT_WAVES_SHADER, {
      label: 'test-noctilucent-waves',
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

    await waves.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(waves);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_NACREOUS_CLOUDS and executes stratospheric mother-of-pearl render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_NACREOUS_CLOUDS.length).toBeGreaterThan(0);
    const nacreous = effect(gpu, NACREOUS_CLOUDS_SHADER, {
      label: 'test-nacreous-clouds',
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

    await nacreous.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(nacreous);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });

  it('compiles WGSL_COSMIC_RAY_CASCADE and executes particle shower & ionization render pass', async () => {
    const gpu = await init();
    const renderTarget = target(gpu, { size: [256, 256] });

    expect(WGSL_COSMIC_RAY_CASCADE.length).toBeGreaterThan(0);
    const cosmic = effect(gpu, COSMIC_RAY_CASCADE_SHADER, {
      label: 'test-cosmic-ray-cascade',
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

    await cosmic.compile(renderTarget);

    expect(() => {
      frame(gpu, (f) => {
        f.pass({ target: renderTarget, clear: [0, 0, 0, 1] }, (p) => {
          p.draw(cosmic);
        });
      });
    }).not.toThrow();

    gpu.dispose();
  });
});
