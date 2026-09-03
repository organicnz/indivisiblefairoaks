/**
 * Minimal localStorage shim for test environments (runner-agnostic).
 *
 * zustand/persist writes through localStorage on every state change; some
 * test environments (bun test, bare node) don't provide it. Installs only
 * when missing so jsdom/browser implementations are never clobbered.
 */
const map = new Map<string, string>();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
      clear: () => void map.clear(),
      key: (index: number) => [...map.keys()][index] ?? null,
      get length() {
        return map.size;
      },
    },
  });
}

export {};
