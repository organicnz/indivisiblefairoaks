// // @deno-types="npm:@hono/hono@^5.0.0"
// // @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { cors } from 'jsr:@hono/hono/cors'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isSpamContent } from '../_shared/spam.ts'
import { readJsonBody, RequestBodyTooLargeError } from '../_shared/request-body.ts'

// ---------------------------------------------------------------------------
// Search edge function — production-ready search API.
//
// Provides:
//  - Input validation + spam‑keyword rejection on the query string
//  - Per‑IP rolling‑window rate limiting (configurable via env)
//  - Calls the Supabase FTS RPC (search_content)
//  - Post‑processing spam filter on content titles
//  - Structured JSON responses with typed rows
//  - Graceful degradation & detailed logging
//  - Request-ID correlation, rate-limit headers, dedup
//  - Search analytics (log to error_reports) + circuit breaker
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Environment validation — fail fast with clear messages
// ---------------------------------------------------------------------------
const REQUIRED_ENV: [string, string | undefined][] = [
  ['SUPABASE_URL', Deno.env.get('SUPABASE_URL')],
  ['SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')],
]

for (const [name, value] of REQUIRED_ENV) {
  if (!value) {
    throw new Error(`search function is missing required environment variable: ${name}`)
  }
}

const SUPABASE_URL = REQUIRED_ENV[0][1]!
const SUPABASE_SERVICE_ROLE_KEY = REQUIRED_ENV[1][1]!

/**
 * A typo in a numeric secret must not disable the limiter.
 *
 * `Number('abc')` is `NaN`, and every comparison against `NaN` is false — so
 * an unvalidated `RATE_LIMIT_MAX` would turn `count > NaN` into a permanent
 * "allow" and an unvalidated window would make `toISOString()` throw. Clamp
 * each value to a sane range and fall back to the documented default.
 */
function envPositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

const RATE_LIMIT_MAX = envPositiveInt(Deno.env.get('SEARCH_RATE_LIMIT_MAX'), 30, 1_000)
const RATE_LIMIT_WINDOW_MIN = envPositiveInt(
  Deno.env.get('SEARCH_RATE_LIMIT_WINDOW_MIN'),
  10,
  24 * 60
)
const RPC_TIMEOUT_MS = envPositiveInt(Deno.env.get('SEARCH_RPC_TIMEOUT_MS'), 10_000, 60_000)
const MAX_REQUEST_BYTES = 8_000

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------
const app = new Hono()

app.use(
  '/*',
  cors({
    origin: Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org',
    allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
    allowMethods: ['POST', 'OPTIONS'],
  }),
)

// ---------------------------------------------------------------------------
// Per‑IP rate limiting using a PostgreSQL table with a rolling window.
// ---------------------------------------------------------------------------

// Circuit breaker state for RPC calls
interface CircuitBreaker {
  failures: number
  lastFailure: number
  open(): boolean
  recordError(): void
  reset(): void
}
const rpcBreaker: CircuitBreaker = {
  failures: 0,
  lastFailure: 0,
  open() {
    return this.failures >= 3 && Date.now() - this.lastFailure < 60_000
  },
  recordError() {
    this.failures++
    this.lastFailure = Date.now()
  },
  reset() {
    this.failures = 0
  },
}

// ---------------------------------------------------------------------------
// Per‑IP rate limiting using a PostgreSQL table with a rolling window.
// ---------------------------------------------------------------------------
//
// Every request is counted. An earlier version kept an in-memory map of recent
// queries per IP and returned `ok: true` immediately for a repeat, on the theory
// that a double-submit should not cost quota. It could not work: the window is
// counted from rows, and that branch still inserted a row, so "not counted" was
// never true. What it actually did was skip the check entirely, so repeating one
// query was an unmetered path through the limiter — the cheapest possible flood.
// The limit is 30 requests per 10 minutes, which is already generous enough for
// a double-submit; correctness wins over the optimisation.
async function checkRateLimit(supabase: ReturnType<typeof supabaseAdmin>, ip: string): Promise<{
  ok: boolean
  remaining: number
}> {
  // --- Insert new rate-limit row ---
  const { error: insertError } = await supabase
    .from('search_rate_limit')
    .insert({ ip, created_at: new Date().toISOString() })

  if (insertError && !insertError.message?.includes('duplicate key')) {
    console.error('[search] rate-limit insert error:', insertError.message)
    // allow on DB error — fail open
  }

  // --- Count requests in the rolling window for this IP ---
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString()
  const { count, error: countError } = await supabase
    .from('search_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gt('created_at', cutoff)

  if (countError) {
    console.error('[search] rate-limit count error:', countError.message)
    return { ok: true, remaining: RATE_LIMIT_MAX }
  }

  const remaining = RATE_LIMIT_MAX - (count ?? 0)
  if ((count ?? 0) > RATE_LIMIT_MAX) {
    console.warn(
      `[search] rate limit exceeded: ${count}/${RATE_LIMIT_MAX} in ${RATE_LIMIT_WINDOW_MIN}min`
    )
    return { ok: false, remaining: 0 }
  }

  return { ok: true, remaining }
}

// One service-role client for this module's own writes.
//
// There used to be an `__ensure__` insert here, on the theory that it ensured
// the rate-limit table existed. It could not: an insert cannot create a table,
// and the schema is owned by `supabase/migrations`. What it did do was write a
// junk row into `search_rate_limit` on every isolate cold start, where the cron
// prune then had to wait seven days to collect it.
const admin = supabaseAdmin()

// ---------------------------------------------------------------------------
// Log a search to error_reports analytics table
// ---------------------------------------------------------------------------
async function logSearchError(
  supabase: ReturnType<typeof supabaseAdmin>,
  message: string
) {
  try {
    const { error } = await supabase.from('error_reports').insert({
      fingerprint: `search-${crypto.randomUUID()}`,
      message: message.slice(0, 500),
      category: 'api',
      path: 'edge/search',
    })
    if (error) console.error('[search] error logging failed:', error.message)
  } catch (error) {
    console.error('[search] error logging failed:', error)
  }
}

// ---------------------------------------------------------------------------
// Executes an RPC with circuit‑breaker protection and optional timeout.
// Returns null on circuit-open or timeout rather than throwing.
// ---------------------------------------------------------------------------
async function rpcWithProtection<T>(
  supabase: ReturnType<typeof supabaseAdmin>,
  rpcFn: () => Promise<{ data: T | null; error: Error | null }>,
  name: string
): Promise<{ data: T | null; error: Error | null; breakerOpen: boolean }> {
  // Check circuit breaker
  if (rpcBreaker.open()) {
    console.warn(`[search] circuit breaker open for RPC: ${name}`)
    return { data: null, error: null, breakerOpen: true }
  }

  let timeoutReject: ((reason?: unknown) => void) | undefined
  const timeoutId = setTimeout(() => {
    timeoutReject?.(new DOMException('RPC timeout', 'AbortError'))
  }, RPC_TIMEOUT_MS)

  let result: { data: T | null; error: Error | null }
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutReject = reject
    })
    result = await Promise.race([rpcFn(), timeout])
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    if (error.name === 'AbortError') {
      console.warn(`[search] RPC timeout (${RPC_TIMEOUT_MS}ms): ${name}`)
    } else {
      console.error(`[search] RPC error (${name}):`, error)
    }
    result = { data: null, error }
  } finally {
    clearTimeout(timeoutId)
  }

  // Record failure if there's an error
  if (result.error) {
    rpcBreaker.recordError()
  } else {
    rpcBreaker.reset()
  }

  return {
    data: result.data,
    error: result.error,
    breakerOpen: rpcBreaker.open(),
  }
}

// ---------------------------------------------------------------------------
// POST /search
//
// Body: { q: string }
// Returns: { products, posts, query, total, remaining, requestId }
// ---------------------------------------------------------------------------
app.post('*', async (c) => {
  // This function is deployed with JWT verification off. `c.req.json()` would
  // buffer an arbitrarily large body before any validation runs, so read the
  // stream with the shared ceiling and reject oversized payloads at the edge.
  let body: unknown
  try {
    body = await readJsonBody(c.req.raw, MAX_REQUEST_BYTES)
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError
    return c.json(
      { error: tooLarge ? 'Request body too large' : 'Invalid JSON body' },
      tooLarge ? 413 : 400,
      { 'request-id': crypto.randomUUID() }
    )
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid JSON body' }, 400, {
      'request-id': crypto.randomUUID(),
    })
  }

  const rawQuery = (body as { q?: unknown }).q
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''
  if (!query) {
    return c.json({ error: 'Search query is required' }, 400, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': String(RATE_LIMIT_MAX),
    })
  }

  // ---- Input validation ----
  const MAX_QUERY_LENGTH = 100
  const cleanQuery = query.slice(0, MAX_QUERY_LENGTH)

  // ---- Rate limiting ----
  //
  // Run this before the spam filter, not after it. The filter is deliberately
  // cheap, but a rejected spam query must still consume the caller's quota;
  // otherwise a spam flood is an unmetered path through the endpoint. The
  // endpoint is public, so the platform's `x-real-ip` is the trusted identity;
  // a client-supplied `x-forwarded-for` first hop can be forged. Prefer
  // `x-real-ip`, and use the nearest (last) forwarded hop only as a fallback,
  // matching the other public Edge functions.
  const realIp = c.req.header('x-real-ip')?.trim()
  const forwardedFor = c.req.header('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const ip = (realIp || forwardedFor?.[forwardedFor.length - 1] || 'unknown').slice(0, 80)

  const { ok, remaining } = await checkRateLimit(admin, ip)
  if (!ok) {
    // Do not write an analytics row for a rejected request. The caller is
    // already flooding us; turning every rejected request into a database
    // insert is the amplification this limit exists to prevent.
    console.warn('[search] rate limit exceeded')
    return c.json({ error: 'Rate limit exceeded. Try again in 10 minutes.' }, 429, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': '0',
    })
  }

  // Spam keyword detection on the query itself
  const isSpam = isSpamContent(cleanQuery)
  if (isSpam) {
    console.warn('[search] spam query rejected')
    return c.json({ error: 'Search query contains restricted terms' }, 403, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': String(remaining),
    })
  }

  // ---- Execute ranked search with circuit breaker protection ----
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const contentRpc = () =>
    Promise.resolve(
      supabase.rpc('search_content', {
        search_query: cleanQuery,
        max_rows: 24,
      })
    )

  const contentResult = await rpcWithProtection(supabase, contentRpc, 'search_content')

  // If circuit breaker is open, return graceful degradation
  if (contentResult.breakerOpen) {
    await logSearchError(admin, 'Search circuit breaker opened')
    return c.json(
      {
        posts: [],
        query: cleanQuery,
        total: { posts: 0 },
        remaining,
        requestId: crypto.randomUUID(),
        circuitBreakerOpen: true,
      },
      200,
      {
        'request-id': crypto.randomUUID(),
        'x-rate-limit-remaining': String(remaining),
      }
    )
  }

  // Map raw RPC results to typed rows — guard against missing data
  let posts: { id: number; title: string; slug: string; type: string | null; created_at: string | null }[] = []

  if (contentResult.data && Array.isArray(contentResult.data)) {
    ; (posts as any[]).push(
      ...(contentResult.data as any[]).map((row: any) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        type: row.type,
        created_at: row.created_at,
      })),
    )
  }

  // Post‑process: filter posts whose title contains spam keywords
  const filteredPosts = posts.filter((item) => !isSpamContent(item.title))

  // ---- Build response ----
  const total = {
    posts: filteredPosts.length,
  }

  return c.json({ posts: filteredPosts, query: cleanQuery, total, remaining, requestId: crypto.randomUUID() }, 200, {
    'request-id': crypto.randomUUID(),
    'x-rate-limit-remaining': String(remaining),
  })
})

// Healthcheck endpoint (useful for monitoring/load balancers)
app.get('*', (c) => {
  return c.json({ ok: true, service: 'search', ts: Date.now() }, 200, {
    'request-id': crypto.randomUUID(),
  })
})

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status, {
      'request-id': crypto.randomUUID(),
    })
  }
  const message = err instanceof Error ? err.message : 'Unknown error'
  console.error('Search function error:', message)
  return c.json({ error: 'Internal server error' }, 500, {
    'request-id': crypto.randomUUID(),
  })
})

Deno.serve(app.fetch)