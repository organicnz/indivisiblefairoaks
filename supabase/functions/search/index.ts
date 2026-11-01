// // @deno-types="npm:@hono/hono@^5.0.0"
// // @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { cors } from 'jsr:@hono/hono/cors'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isSpamContent } from '../_shared/spam.ts'

// ---------------------------------------------------------------------------
// Search edge function — production-ready search API.
//
// Provides:
//  - Input validation + spam‑keyword rejection on the query string
//  - Per‑IP rolling‑window rate limiting (configurable via env)
//  - Calls the existing Supabase FTS RPCs (search_products, search_content)
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
const RATE_LIMIT_MAX = Number(Deno.env.get('SEARCH_RATE_LIMIT_MAX') ?? '30')
const RATE_LIMIT_WINDOW_MIN = Number(Deno.env.get('SEARCH_RATE_LIMIT_WINDOW_MIN') ?? '10')
const RPC_TIMEOUT_MS = Number(Deno.env.get('SEARCH_RPC_TIMEOUT_MS') ?? '10000')

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
  let body: { q?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400, {
      'request-id': crypto.randomUUID(),
    })
  }

  const query = (body?.q || '').trim()
  if (!query) {
    return c.json({ error: 'Search query is required' }, 400, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': String(RATE_LIMIT_MAX),
    })
  }

  // ---- Input validation ----
  const MAX_QUERY_LENGTH = 100
  const cleanQuery = query.slice(0, MAX_QUERY_LENGTH)

  // Spam keyword detection on the query itself
  const isSpam = isSpamContent(cleanQuery)
  if (isSpam) {
    console.warn('[search] spam query rejected')
    await logSearchError(admin, 'Search query rejected by spam filter')
    return c.json({ error: 'Search query contains restricted terms' }, 403, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': String(RATE_LIMIT_MAX),
    })
  }

  // ---- Rate limiting ----
  const forwardedFor = c.req.header('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

  const { ok, remaining } = await checkRateLimit(admin, ip)
  if (!ok) {
    await logSearchError(admin, 'Search rate limit exceeded')
    return c.json({ error: 'Rate limit exceeded. Try again in 10 minutes.' }, 429, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': '0',
    })
  }

  // ---- Execute ranked searches in parallel with circuit breaker protection ----
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const productRpc = () =>
    Promise.resolve(
      supabase.rpc('search_products', {
        search_query: cleanQuery,
        max_rows: 24,
      })
    )

  const contentRpc = () =>
    Promise.resolve(
      supabase.rpc('search_content', {
        search_query: cleanQuery,
        max_rows: 10,
      })
    )

  const [productsResult, contentResult] = await Promise.all([
    rpcWithProtection(supabase, productRpc, 'search_products'),
    rpcWithProtection(supabase, contentRpc, 'search_content'),
  ])

  // If circuit breaker is open, return graceful degradation
  if (productsResult.breakerOpen || contentResult.breakerOpen) {
    await logSearchError(admin, 'Search circuit breaker opened')
    // Return whatever we can — empty results rather than error
    // But still include the query and remaining info
    return c.json(
      {
        products: [],
        posts: [],
        query: cleanQuery,
        total: { products: 0, posts: 0 },
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
  let products: { id: number; name: string; slug: string; price: number; regular_price: number | null; sale_price: number | null; image_url: string | null; stock_status: string | null }[] = []
  let posts: { id: number; title: string; slug: string; type: string | null; created_at: string | null }[] = []

  if (productsResult.data && Array.isArray(productsResult.data)) {
    ; (products as any[]).push(
      ...(productsResult.data as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: Number(row.price),
        regular_price: row.regular_price == null ? null : Number(row.regular_price),
        sale_price: row.sale_price == null ? null : Number(row.sale_price),
        image_url: row.image_url,
        stock_status: row.stock_status,
      })),
    )
  }

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
    products: products.length,
    posts: filteredPosts.length,
  }

  return c.json({ products, posts: filteredPosts, query: cleanQuery, total, remaining, requestId: crypto.randomUUID() }, 200, {
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