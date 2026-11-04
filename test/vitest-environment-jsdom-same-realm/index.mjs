/**
 * Same-realm jsdom environment for Vitest.
 *
 * Why this file exists
 * --------------------
 * Vitest's builtin jsdom environment creates the `<html>` window **inside a
 * node:vm context**, because it defaults jsdom's `runScripts` to
 * `"dangerously"` (see the `setup` path in vitest's `dist/chunks/*.js`;
 * `runScripts = "dangerously"` is a destructuring default, so there is no
 * config value that means "no vm"). jsdom only skips the vm when `runScripts`
 * is *undefined*, and jsdom rejects every other falsy value (`""`, `0`,
 * `null`, `false` all throw "runScripts must be undefined, \"dangerously\",
 * or \"outside-only\""). So the vm realm cannot be disabled from config.
 *
 * On Bun for darwin-arm64 that vm realm is **broken**: the window it creates
 * fails jsdom's private-field brand check, so even a plain
 * `window.addEventListener()` throws before a single test runs:
 *
 *     TypeError: 'addEventListener' called on an object that is not a valid
 *     instance of EventTarget.
 *
 * Reproduced 2026-11-03 with Bun 1.4.2, 1.4.3 and 1.4.4-canary on this
 * machine (M-series macOS) — and with plain JSDOM, no vitest involved. The
 * Linux x64 CI runner runs the identical suite green, so this is a Bun/node:vm
 * defect on this platform, not a repository bug, and not jsdom's — the
 * same-realm window works fine. It is the same class of vm divergence as the
 * documented "Proxy is not allowed in the global prototype chain" failure.
 *
 * This environment is therefore vitest's jsdom environment **minus the vm
 * realm**: the window is built in the current realm, where jsdom's IDL
 * wrappers and its private-field brand check all live. No test in this
 * repository executes inline <script> inside the DOM (they mock at the fetch
 * boundary), so the vm buys nothing and costs the entire suite.
 *
 * What it does NOT reimplement
 * ----------------------------
 *   - `populateGlobal` — copied verbatim from vitest's pinned internals at
 *     load time (see below). It is the exact accessor/teardown logic the
 *     builtin uses, including the `KEYS` allowlist that keeps Bun's native
 *     globals from shadowing jsdom's.
 *   - `patchAddEventListener` / `catchWindowErrors` — copied below (they are
 *     self-contained).
 *   - The builtin's `Request` / `URL` / `FormData` / `Blob` compat shims —
 *     omitted: no test constructs those globals (they mock at the boundary),
 *     and the shims exist to bridge Node.js to jsdom, which is not our
 *     runtime.
 *
 * Failure mode on a vitest upgrade
 * ---------------------------------
 * The chunk filename is content-hashed and `populateGlobal` is not a public
 * export, so this file locates it by scanning `node_modules/vitest/dist/chunks`
 * for the export signature. If a future vitest moves or renames it, the
 * environment throws an explicit error naming the cause — loud, with the fix,
 * never a silent fallback to the vm.
 *
 * Docblocks: test files opt in with
 *     // @vitest-environment jsdom-same-realm
 * instead of `// @vitest-environment jsdom`. Same semantics otherwise; the
 * pre-commit environment guard accepts both as the jsdom-class environment,
 * and treats `jsdom` as a violation with a pointer here.
 */

import path from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// `this package` is symlinked into root `node_modules`, so no relative-from-
// `import.meta.dirname` path can reach vitest's real location. Resolve by
// package name instead — `vitest/package.json` is an exported subpath.
const require = createRequire(import.meta.url);
const CHUNKS_DIR = path.join(path.dirname(require.resolve('vitest/package.json')), 'dist', 'chunks');

/** Locate the chunk exporting vitest's internal `populateGlobal` (as `p`). */
function findPopulateGlobal() {
  for (const name of readdirSync(CHUNKS_DIR)) {
    if (!/^index\.[A-Za-z0-9_-]+\.js$/.test(name)) continue;
    const file = path.join(CHUNKS_DIR, name);
    const src = readFileSync(file, 'utf8');
    if (/export\s*{[^}]*\bpopulateGlobal as p\b/.test(src)) return file;
  }
  throw new Error(
    `[jsdom-same-realm] could not find vitest's populateGlobal chunk in ${CHUNKS_DIR}.\n` +
      'vitest no longer exports it under `p`, or the chunk layout changed.\n' +
      'Update this file (see the header comment) — do NOT work around it by\n' +
      're-enabling runScripts: the Bun vm realm is what breaks this platform.',
  );
}

const { p: populateGlobal } = await import(pathToFileURL(findPopulateGlobal()).href);

/**
 * jsdom 24-era abort-signal bridging: a signal from the host realm is not
 * instanceof jsdom's AbortSignal, so swap in a jsdom-owned controller.
 * Copied from vitest 5.1.0 (MIT).
 */
function patchAddEventListener(window) {
  const abortControllers = new WeakMap();
  const JSDOMAbortSignal = window.AbortSignal;
  const JSDOMAbortController = window.AbortController;
  const originalAddEventListener = window.EventTarget.prototype.addEventListener;

  function getJsdomAbortController(signal) {
    if (!abortControllers.has(signal)) {
      const controller = new JSDOMAbortController();
      signal.addEventListener('abort', () => {
        controller.abort(signal.reason);
      });
      abortControllers.set(signal, controller);
    }
    return abortControllers.get(signal);
  }

  window.EventTarget.prototype.addEventListener = function addEventListener(type, callback, options) {
    if (typeof options === 'object' && options?.signal != null) {
      const { signal, ...rest } = options;
      if (!(signal instanceof JSDOMAbortSignal)) {
        const compatOptions = Object.create(null);
        Object.assign(compatOptions, rest);
        compatOptions.signal = getJsdomAbortController(signal).signal;
        return originalAddEventListener.call(this, type, callback, compatOptions);
      }
    }
    return originalAddEventListener.call(this, type, callback, options);
  };

  return () => {
    window.EventTarget.prototype.addEventListener = originalAddEventListener;
  };
}

/**
 * Route uncaught window errors into `process` so the runner sees them.
 * Copied from vitest 5.1.0 (MIT).
 */
function catchWindowErrors(window) {
  let userErrorListenerCount = 0;
  function throwUnhandlerError(event) {
    if (userErrorListenerCount === 0 && event.error != null) {
      event.preventDefault();
      process.emit('uncaughtException', event.error);
    }
  }
  const addEventListener = window.addEventListener.bind(window);
  const removeEventListener = window.removeEventListener.bind(window);
  window.addEventListener('error', throwUnhandlerError);
  window.addEventListener = function (...args) {
    if (args[0] === 'error') userErrorListenerCount++;
    return addEventListener.apply(this, args);
  };
  window.removeEventListener = function (...args) {
    if (args[0] === 'error' && userErrorListenerCount) userErrorListenerCount--;
    return removeEventListener.apply(this, args);
  };
  return function clearErrorHandlers() {
    window.removeEventListener('error', throwUnhandlerError);
  };
}

export default {
  name: 'jsdom-same-realm',
  viteEnvironment: 'client',
  async setup(global, { jsdom = {} } = {}) {
    const jsdomModule = await import('jsdom');
    const { CookieJar, JSDOM, ResourceLoader } = jsdomModule;
    const {
      html = '<!DOCTYPE html>',
      url = 'http://localhost:3000',
      contentType = 'text/html',
      pretendToBeVisual = true,
      includeNodeLocations = false,
      cookieJar = false,
      resources,
      userAgent,
      // `runScripts` is accepted to fail loudly rather than silently ignored.
      // It is the one option this environment refuses to forward: jsdom builds
      // a node:vm realm for it, and on Bun/darwin-arm64 that realm is what
      // breaks every wrapper's brand check.
      runScripts,
      ...restOptions
    } = jsdom;

    if (runScripts !== undefined) {
      throw new Error(
        '[jsdom-same-realm] `runScripts` is not supported by this environment. ' +
          'The vitest-builtin jsdom already defaults it to "dangerously" and jsdom ' +
          'has no falsy value that disables the vm realm — which is the realm that ' +
          'breaks Bun/darwin-arm64. See test/vitest-environment-jsdom-same-realm/index.mjs.',
      );
    }

    const resourceOption = !ResourceLoader
      ? userAgent
        ? { userAgent }
        : resources
      : { resources: resources ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined) };

    const dom = new JSDOM(html, {
      pretendToBeVisual,
      url,
      contentType,
      includeNodeLocations,
      cookieJar: cookieJar ? new CookieJar() : undefined,
      ...resourceOption,
      // Same realm — deliberately NO `runScripts`.
      ...restOptions,
    });

    const clearAddEventListenerPatch = patchAddEventListener(dom.window);
    const { keys, originals } = populateGlobal(global, dom.window, { bindFunctions: true });
    const clearWindowErrors = catchWindowErrors(global);

    global.jsdom = dom;

    return {
      teardown(global) {
        clearAddEventListenerPatch();
        clearWindowErrors();
        dom.window.close();
        delete global.jsdom;
        keys.forEach((key) => delete global[key]);
        originals.forEach((descriptor, key) => Object.defineProperty(global, key, descriptor));
      },
    };
  },
};
