// // @deno-types="npm:@hono/hono@^5.0.0"
// // @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { cors } from 'jsr:@hono/hono/cors'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import { createClient } from 'npm:@supabase/supabase-js@2'

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
  ['SEARCH_RATE_LIMIT_MAX', Deno.env.get('SEARCH_RATE_LIMIT_MAX')],
  ['SEARCH_RATE_LIMIT_WINDOW_MIN', Deno.env.get('SEARCH_RATE_LIMIT_WINDOW_MIN')],
  ['SEARCH_RPC_TIMEOUT_MS', Deno.env.get('SEARCH_RPC_TIMEOUT_MS')],
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

// Dedup map: track recent queries per IP to avoid double-counting same query
const recentQueryDedup = new Map<string, Set<string>>()
const DEDUP_WINDOW_MIN = 1 // 1-minute dedup window

// Circuit breaker state for RPC calls
interface CircuitBreaker {
  failures: number
  lastFailure: number
  open(): boolean
  recordError()
  reset()
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
async function checkRateLimit(supabase: ReturnType<typeof supabaseAdmin>, ip: string, query: string): Promise<{
  ok: boolean
  remaining: number
  deduplicated: boolean
}> {
  // --- Same‑query dedup: if this exact query was searched by this IP in the
  //     dedup window, skip the count (return deduplicated=true) so the client
  //     doesn't get rate‑limited for repeating themselves. ---
  const dedupKey = `${ip}:${query}`
  let querySet = recentQueryDedup.get(ip)
  if (!querySet) {
    querySet = new Set()
    recentQueryDedup.set(ip, querySet)
  }
  const alreadySeen = querySet.has(query)
  // Purge entries older than the dedup window
  const purgeCutoff = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString()
  for (const k of querySet.keys()) {
    if (k < purgeCutoff) {
      querySet.delete(k)
    }
  }
  if (alreadySeen) {
    // Still insert the new row so the table stays fresh, but don't count it
    const { error: insertError } = await supabase
      .from('search_rate_limit')
      .insert({ ip, created_at: new Date().toISOString() })
    if (insertError && !insertError.message?.includes('duplicate key')) {
      console.error('[search] rate-limit insert error:', insertError.message)
    }
    return { ok: true, remaining: RATE_LIMIT_MAX, deduplicated: true }
  }
  querySet.add(dedupKey)

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
    return { ok: true, remaining: RATE_LIMIT_MAX, deduplicated: false }
  }

  const remaining = RATE_LIMIT_MAX - (count ?? 0)
  if ((count ?? 0) > RATE_LIMIT_MAX) {
    console.warn(`[search] rate-limit exceeded for IP ${ip}: ${count}/${RATE_LIMIT_MAX} in ${RATE_LIMIT_WINDOW_MIN}min`)
    return { ok: false, remaining: 0, deduplicated: false }
  }

  return { ok: true, remaining, deduplicated: false }
}

// Ensure the rate-limit table exists (best‑effort, migration should already be applied).
const admin = supabaseAdmin()
;(async () => {
  try {
    await admin.from('search_rate_limit').insert({ ip: '__ensure__', created_at: new Date().toISOString() })
  } catch {
    // table may already exist or be missing — either way proceed
  }
})()

// ---------------------------------------------------------------------------
// Log a search to error_reports analytics table
// ---------------------------------------------------------------------------
async function logSearchAnalytics(supabase: ReturnType<typeof supabaseAdmin>, ip: string, query: string, success: boolean, error?: string) {
  try {
    await supabase
      .from('error_reports')
      .insert({
        ip,
        query,
        error: success ? null : error || 'search_failed',
        created_at: new Date().toISOString(),
      })
  } catch {
    // Best‑effort — never break the search flow due to analytics failure
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

  // Execute with timeout
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => {
    abortController.abort()
  }, RPC_TIMEOUT_MS)

  let result: { data: T | null; error: Error | null }
  try {
    result = await supabase.rpc(name, {}).catch((err: Error) => ({
      data: null,
      error: err,
    }))
    clearTimeout(timeoutId)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[search] RPC timeout (${RPC_TIMEOUT_MS}ms): ${name}`)
    } else {
      console.error(`[search] RPC error (${name}):`, err.message)
    }
    result = { data: null, error: err }
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

  // Spam keyword detection on the query itself (using shared sanitize helper)
  // isSpamContent returns false for empty/indivisible‑safe strings, so we
  // treat a positive result as a rejection.
  const fromLib = await import('@/lib/sanitize')
  const isSpam = fromLib.isSpamContent(cleanQuery)
  if (isSpam) {
    console.warn(`[search] spam query rejected from IP: ${c.req.header('x-forwarded-for') ?? 'unknown'} — query: "${cleanQuery}"`)
    await logSearchAnalytics(admin, 'unknown', cleanQuery, false, 'spam_query')
    return c.json({ error: 'Search query contains restricted terms' }, 403, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': String(RATE_LIMIT_MAX),
    })
  }

  // ---- Rate limiting ----
  const forwardedFor = c.req.header('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

  const { ok, remaining, deduplicated } = await checkRateLimit(admin, ip, cleanQuery)
  if (!ok) {
    await logSearchAnalytics(admin, ip, cleanQuery, false, 'rate_limit_exceeded')
    return c.json({ error: 'Rate limit exceeded. Try again in 10 minutes.' }, 429, {
      'request-id': crypto.randomUUID(),
      'x-rate-limit-remaining': '0',
    })
  }

  // ---- Execute ranked searches in parallel with circuit breaker protection ----
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const productRpc = () =>
    supabase.rpc('search_products', {
      search_query: cleanQuery,
      max_rows: 24,
    })

  const contentRpc = () =>
    supabase.rpc('search_content', {
      search_query: cleanQuery,
      max_rows: 10,
    })

  const [productsResult, contentResult] = await Promise.all([
    rpcWithProtection(supabase, productRpc, 'search_products'),
    rpcWithProtection(supabase, contentRpc, 'search_content'),
  ])

  // If circuit breaker is open, return graceful degradation
  if (productsResult.breakerOpen || contentResult.breakerOpen) {
    await logSearchAnalytics(admin, ip, cleanQuery, true, 'circuit_breaker_open')
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
    ;(products as any[]).push(
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
    ;(posts as any[]).push(
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
  const filteredPosts = posts.filter((item) => !fromLib.isSpamContent(item.title))

  // ---- Build response ----
  const total = {
    products: products.length,
    posts: filteredPosts.length,
  }

  await logSearchAnalytics(admin, ip, cleanQuery, true)

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