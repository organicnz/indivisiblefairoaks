import { describe, expect, it, vi } from 'vitest';
import {
  applyThemeAttribute,
  isThemeMode,
  nextThemeMode,
  readThemeMode,
  resolveEffectiveTheme,
  THEME_ATTR,
  THEME_MODES,
  THEME_ORDER,
  THEME_STORAGE_KEY,
  type ThemeMode,
  themeBootstrapScript,
  themeModeLabel,
  writeThemeMode,
} from '@/lib/theme';

/** A storage stub that records what was written, and can be made to throw. */
function fakeStorage(overrides: Partial<Storage> = {}) {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    ...overrides,
  };
}

describe('readThemeMode', () => {
  it('reads a pinned preference', () => {
    for (const mode of THEME_MODES) {
      const storage = fakeStorage();
      storage.values.set(THEME_STORAGE_KEY, mode);
      expect(readThemeMode(storage), mode).toBe(mode);
    }
  });

  it('reads a missing preference as system', () => {
    expect(readThemeMode(fakeStorage())).toBe('system');
  });

  it('reads every unrecognized value as system', () => {
    // A value from an older release, a hand edit, or another site sharing the
    // key resets to following the OS rather than throwing or painting a mode
    // this release does not know.
    for (const value of ['true', '1', 'darkly', '', 'dark ']) {
      const storage = fakeStorage();
      storage.values.set(THEME_STORAGE_KEY, value);
      expect(readThemeMode(storage), value).toBe('system');
    }
  });

  it('reads a storage that throws as system rather than propagating', () => {
    const storage = fakeStorage({
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    });
    expect(readThemeMode(storage)).toBe('system');
  });

  it('reads no storage at all as system', () => {
    expect(readThemeMode(null)).toBe('system');
    expect(readThemeMode(undefined)).toBe('system');
  });
});

describe('isThemeMode', () => {
  it('accepts exactly the three modes', () => {
    expect(THEME_MODES).toEqual(['system', 'light', 'dark']);
    for (const mode of THEME_MODES) {
      expect(isThemeMode(mode)).toBe(true);
    }
  });

  it('rejects everything else', () => {
    for (const value of ['', 'System', 'LIGHT', null, undefined, 1, {}]) {
      expect(isThemeMode(value), String(value)).toBe(false);
    }
  });
});

describe('writeThemeMode', () => {
  it('persists a pin', () => {
    const storage = fakeStorage();
    writeThemeMode(storage, 'dark');
    expect(storage.values.get(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('removes the key for system', () => {
    // "Never expressed a preference" and "follow the OS again" are the same
    // state in storage, so no stale pin can outlive the choice to withdraw it.
    const storage = fakeStorage();
    storage.values.set(THEME_STORAGE_KEY, 'dark');
    writeThemeMode(storage, 'system');
    expect(storage.values.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it('treats a storage that throws as a preference that resets', () => {
    const storage = fakeStorage({
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    });
    expect(() => writeThemeMode(storage, 'dark')).not.toThrow();
    expect(() => writeThemeMode(storage, 'system')).not.toThrow();
  });
});

describe('resolveEffectiveTheme', () => {
  it('resolves a pin without consulting the OS preference', () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('light', false)).toBe('light');
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });

  it('resolves system from the OS preference', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark');
    expect(resolveEffectiveTheme('system', false)).toBe('light');
  });
});

describe('nextThemeMode', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
  });

  it('visits every mode exactly once per three clicks', () => {
    const visited: ThemeMode[] = [];
    let mode: ThemeMode = 'system';
    for (let i = 0; i < 3; i += 1) {
      mode = nextThemeMode(mode);
      visited.push(mode);
    }
    expect(visited).toEqual([...THEME_ORDER.filter((m) => m !== 'system'), 'system'].slice(0, 3));
    expect(new Set(visited).size).toBe(3);
  });
});

describe('themeModeLabel', () => {
  it('names each mode as the toggle announces it', () => {
    expect(themeModeLabel('system')).toBe('System');
    expect(themeModeLabel('light')).toBe('Light');
    expect(themeModeLabel('dark')).toBe('Dark');
  });
});

describe('applyThemeAttribute', () => {
  it('sets the attribute on the document root', () => {
    const setAttribute = vi.fn();
    applyThemeAttribute({ setAttribute }, 'dark');
    expect(setAttribute).toHaveBeenCalledWith(THEME_ATTR, 'dark');
  });
});

describe('themeBootstrapScript', () => {
  it('resolves a dark pin', () => {
    // The script's branches are `resolveEffectiveTheme`'s. These cases pin
    // the two halves together: the inline <script> cannot import the module,
    // so a failure here is the only thing that notices the drift.
    const script = themeBootstrapScript();
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain(THEME_ATTR);
    expect(script).toContain("m==='dark'");
    expect(script).toContain("m!=='light'");
    expect(script).toContain('prefers-color-scheme: dark');
  });

  it('falls back to light when storage or matchMedia throws', () => {
    const script = themeBootstrapScript();
    // A privacy mode that throws on either access gets the light palette and
    // an unstyled flash, not a blank document.
    expect(script).toContain(`setAttribute('${THEME_ATTR}','light')`);
  });

  it('is one synchronous expression', () => {
    // It runs in <head> before the bundle exists: no imports, no awaits, and
    // nothing that could be deferred.
    const script = themeBootstrapScript();
    expect(script).not.toContain('import');
    expect(script).not.toContain('await');
    expect(script.startsWith('(function(){try{')).toBe(true);
    expect(script.endsWith('}})();')).toBe(true);
  });
});
