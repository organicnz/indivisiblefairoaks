#!/usr/bin/env bun
// Zero-dependency stand-in for the notify-contact Edge Function, used by the
// Playwright suite. The app's server action POSTs { id } here; this mock
// replies with configurable delivery outcomes so tests can drive every UI
// status branch without sending real email.
//
// Control plane (used by tests via the playwright `request` fixture):
//   GET  /__health       -> 200 liveness
//   GET  /__mode         -> current canned response + call count
//   POST /__mode         -> merge fields into the canned response ({ emailed, copied, ok, status })
//   POST /__reset        -> restore defaults and zero the call counter
//   POST /notify-contact -> the canned response
//
// `Bun.serve` rather than `node:http`. The handler returns a `Response`, the
// body is parsed with `req.json()` instead of a hand-rolled stream listener,
// and the server's connection lifetime is one option (`idleTimeout`) instead of
// `keepAliveTimeout` plus `headersTimeout`.

const DEFAULT_MODE = { ok: true, emailed: true, copied: true };
let mode = { ...DEFAULT_MODE };
let calls = 0;
let lastBody = null;

const port = Number(Bun.argv[2] || 3101);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const server = Bun.serve({
  port,
  hostname: '127.0.0.1',
  // The previous `node:http` server set a 65 s keep-alive timeout and a 66 s
  // headers timeout, so a connection the Playwright `request` fixture holds
  // open across a slow test is not reaped mid-run. `idleTimeout` is Bun's
  // single knob for the same thing — and it counts in **seconds** (capped at
  // 255), not milliseconds.
  idleTimeout: 66,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/__health') {
      return json({ ok: true });
    }

    if (url.pathname === '/__last') {
      return json({ lastBody });
    }

    if (url.pathname === '/__mode') {
      if (req.method === 'GET') return json({ mode, calls });
      if (req.method === 'POST') {
        // A malformed body was a `{}` under the old stream-reader, and a
        // malformed body is still a `{}` here.
        const body = await req.json().catch(() => ({}));
        mode = body?.reset === true ? { ...DEFAULT_MODE } : { ...DEFAULT_MODE, ...body };
        return json({ mode });
      }
    }

    if (req.method === 'POST' && url.pathname === '/__reset') {
      mode = { ...DEFAULT_MODE };
      calls = 0;
      return json({ calls });
    }

    if (req.method === 'POST' && url.pathname === '/notify-contact') {
      calls += 1;
      const raw = await req.text();
      try {
        lastBody = JSON.parse(raw);
      } catch {
        lastBody = raw;
      }
      const status = typeof mode.status === 'number' ? mode.status : 200;
      return json(mode, status);
    }

    return json({ error: 'not found' }, 404);
  },
});

console.log(`mock-notify-contact listening on http://127.0.0.1:${server.port}`);
