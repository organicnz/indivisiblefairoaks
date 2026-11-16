import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The ports the e2e suite uses.
 *
 * ## One source of truth
 *
 * `playwright.config.ts`, `e2e/contact.spec.ts` and `e2e/instant.spec.ts` all
 * need these numbers, and they used to each hard-code `3100` and `3101`. That
 * is three places to keep in step, and the step that matters — moving the
 * suite off a busy port — was the one nobody remembered to make.
 *
 * They now read them from here, and `playwright.config.ts` reads them from
 * here too, so the app's port and the mock server's port cannot drift apart.
 *
 * ## Why the port is chosen, not merely configurable
 *
 * A fixed port is a collision waiting to happen. Another application, a
 * developer's dev server, or a second checkout of this repository can already
 * be listening when the gate starts. That is not hypothetical: it happened
 * here, and the suite drove the other application because Playwright was
 * allowed to reuse whatever answered.
 *
 * The default is therefore the first free adjacent pair starting at 3100. The
 * pair is probed by briefly binding each port on loopback and closing it. The
 * result is written to `.next/e2e-port` by the e2e build, so the build and the
 * suite that tests it agree on the origin even when 3100 was busy.
 *
 * `E2E_PORT` still wins when explicitly set, because the staging instructions
 * need the suite to match a `NEXT_PUBLIC_SITE_URL` on a chosen port. An
 * explicit port must be free: the config no longer reuses an existing server,
 * so an occupied port is a mistake worth reporting rather than a server worth
 * adopting.
 */
const DEFAULT_PORT = 3100;
const PORT_SEARCH_LIMIT = 50;
const MAX_PORT = 65_534;

/** The port chosen by the e2e build, for the suite to reuse. */
const BUILD_PORT_FILE = path.join(import.meta.dirname, '..', '..', '.next', 'e2e-port');

/**
 * Whether nothing is listening on `port` on loopback.
 *
 * `Bun.serve` is synchronous and reports a bind failure immediately, so this
 * stays a module-level value rather than turning every import of the ports
 * into a promise. `stop(true)` closes the probe before the real server starts.
 */
function isFree(port: number): boolean {
  try {
    const probe = Bun.serve({
      hostname: '127.0.0.1',
      port,
      fetch: () => new Response(null, { status: 204 }),
    });
    void probe.stop(true);
    return true;
  } catch {
    return false;
  }
}

/** A usable app port has a usable mock port directly above it. */
function isFreePair(port: number): boolean {
  return (
    Number.isInteger(port) && port > 0 && port < MAX_PORT && isFree(port) && isFree(port + 1)
  );
}

/** The port stored by `scripts/build.mjs`, when it is still usable. */
function buildPort(): number | null {
  try {
    const raw = readFileSync(BUILD_PORT_FILE, 'utf8').trim();
    const port = Number(raw);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

/**
 * Persist a newly chosen port for the worker processes.
 *
 * The config process sets `E2E_PORT`, which Playwright passes to the workers.
 * Writing the same value to disk is a second guarantee for a worker that
 * starts without the parent's environment, and it keeps `instant.spec.ts`'s
 * `APP_URL` pointed at the server the config actually started. It is best
 * effort: `playwright test --list` can run without a build directory.
 */
function rememberPort(port: number): void {
  if (!existsSync(path.join(import.meta.dirname, '..', '..', '.next', 'BUILD_ID'))) return;
  try {
    writeFileSync(BUILD_PORT_FILE, `${port}\n`);
  } catch {
    // The next process will probe again rather than fail on a read-only tree.
  }
}

function choosePort(): number {
  const configured = Bun.env.E2E_PORT;
  if (configured !== undefined && configured !== '') {
    const port = Number(configured);
    if (!Number.isInteger(port) || port <= 0 || port >= MAX_PORT) {
      throw new Error(
        `E2E_PORT must be an integer between 1 and ${MAX_PORT - 1}; received ${JSON.stringify(configured)}.`
      );
    }
    // The config process checks this pair before starting the server. By the
    // time a worker imports this module the server is supposed to be listening
    // on it, so a second free-port check here would reject a healthy run.
    return port;
  }

  const stored = buildPort();
  if (stored !== null && isFreePair(stored)) return stored;

  for (let port = DEFAULT_PORT; port < DEFAULT_PORT + PORT_SEARCH_LIMIT; port += 1) {
    if (!isFreePair(port)) continue;
    rememberPort(port);
    return port;
  }

  throw new Error(
    `No free adjacent port pair found in ${DEFAULT_PORT}-${DEFAULT_PORT + PORT_SEARCH_LIMIT - 1}. ` +
      'Stop a local server or set E2E_PORT to a free pair.'
  );
}

export const E2E_PORT = choosePort();

// Playwright evaluates the config once and then starts worker processes. The
// worker imports this module again; the environment is the handoff that keeps
// every spec on the same port instead of each worker probing independently.
if (!Bun.env.E2E_PORT) process.env.E2E_PORT = String(E2E_PORT);

export const MOCK_PORT = E2E_PORT + 1;

/** The mock notify server's origin. */
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

/** The app's origin. */
export const APP_URL = `http://localhost:${E2E_PORT}`;
