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

import { createServer } from 'node:http';

const DEFAULT_MODE = { ok: true, emailed: true, copied: true };
let mode = { ...DEFAULT_MODE };
let calls = 0;
let lastBody = null;

const port = Number(process.argv[2] || 3101);

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/__health') {
      return json(res, 200, { ok: true });
    }

    if (url.pathname === '/__last') {
      return json(res, 200, { lastBody });
    }

  if (url.pathname === '/__mode') {
    if (req.method === 'GET') return json(res, 200, { mode, calls });
    if (req.method === 'POST') {
      const body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
      });
      mode = body?.reset === true ? { ...DEFAULT_MODE } : { ...DEFAULT_MODE, ...body };
      return json(res, 200, { mode });
    }
  }

  if (req.method === 'POST' && url.pathname === '/__reset') {
    mode = { ...DEFAULT_MODE };
    calls = 0;
    return json(res, 200, { calls });
  }

  if (req.method === 'POST' && url.pathname === '/notify-contact') {
    calls += 1;
    const raw = await new Promise((resolve) => {
      let acc = '';
      req.on('data', (c) => (acc += c));
      req.on('end', () => resolve(acc));
    });
    try {
      lastBody = JSON.parse(raw);
    } catch {
      lastBody = raw;
    }
    const status = typeof mode.status === 'number' ? mode.status : 200;
    return json(res, status, mode);
  }

  json(res, 404, { error: 'not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`mock-notify-contact listening on http://127.0.0.1:${port}`);
});
