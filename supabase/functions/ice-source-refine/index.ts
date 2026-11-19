// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  buildMessages,
  parseRefineResponse,
  type RefineInput,
  type RefineMode,
} from './logic.ts'
import { readTextBody, RequestBodyTooLargeError } from '../_shared/request-body.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ZAI_API_KEY = Deno.env.get('ZAI_API_KEY') ?? ''
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const ZAI_MODEL = Deno.env.get('ICE_ZAI_MODEL') ?? 'glm-4.5-flash'
const GROQ_MODEL = Deno.env.get('ICE_GROQ_MODEL') ?? 'llama-3.3-70b-versatile'
// The crawler can refine dozens of pages in one run, so this needs a higher
// ceiling than the interactive ICE case-brief endpoint. It stays per-IP and
// bounded; a single crawl otherwise exhausts the bucket partway through.
const RATE_MAX = positiveInt(Deno.env.get('ICE_REFINE_RATE_LIMIT_MAX'), 120, 500)
const RATE_MIN = positiveInt(Deno.env.get('ICE_REFINE_RATE_LIMIT_WINDOW_MIN'), 10, 60)
const MAX_REQUEST_BYTES = 32_000
const MAX_TEXT = 24_000
const MAX_TITLE = 300
const PROVIDER_TIMEOUT_MS = 25_000
const ZAI_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

type AnyClient = SupabaseClient<any>

function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': APP_URL,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  }
}

function noStore(headers: HeadersInit): HeadersInit {
  return { ...headers, 'cache-control': 'no-store' }
}

function requestIp(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return forwarded?.[forwarded.length - 1] ?? 'unknown'
}

function parsePayload(raw: unknown): RefineInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length < 20 || text.length > MAX_TEXT) return null

  let sourceUrl: string | null = null
  if (typeof body.sourceUrl === 'string' && body.sourceUrl.trim()) {
    try {
      const url = new URL(body.sourceUrl.trim())
      if (url.protocol !== 'https:') return null
      sourceUrl = url.toString().slice(0, 500)
    } catch {
      return null
    }
  }

  const sourceTitle =
    typeof body.sourceTitle === 'string'
      ? body.sourceTitle.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || null
      : null

  const mode: RefineMode = body.mode === 'refine' ? 'refine' : 'clean'

  return { text, sourceUrl, sourceTitle, mode }
}

async function checkRateLimit(client: AnyClient, ip: string): Promise<boolean> {
  const key = `refine:${ip}`
  const cutoff = new Date(Date.now() - RATE_MIN * 60_000).toISOString()
  const { error: insertError } = await client.from('search_rate_limit').insert({ ip: key })
  if (insertError) throw insertError
  const { count, error } = await client
    .from('search_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('ip', key)
    .gt('created_at', cutoff)
  if (error) throw error
  return (count ?? 0) <= RATE_MAX
}

async function callProvider(
  apiKey: string,
  endpoint: string,
  model: string,
  messages: ReturnType<typeof buildMessages>,
  zai: boolean
): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: 4_096,
      stream: false,
      ...(zai ? { thinking: { type: 'disabled' } } : {}),
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`provider-${response.status}`)

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('empty-provider-response')
  return content.trim()
}

async function refine(
  input: RefineInput
): Promise<{ text: string; isReport: boolean; mode: RefineMode } | null> {
  const messages = buildMessages(input)

  if (ZAI_API_KEY) {
    try {
      const parsed = parseRefineResponse(
        await callProvider(ZAI_API_KEY, ZAI_ENDPOINT, ZAI_MODEL, messages, true),
        input.text,
        input.mode
      )
      if (parsed) return { ...parsed, mode: input.mode ?? 'clean' }
      console.error('[ice-source-refine] primary provider returned an unusable response')
    } catch (error) {
      console.error(
        '[ice-source-refine] primary provider failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
    }
  }

  if (GROQ_API_KEY) {
    try {
      const parsed = parseRefineResponse(
        await callProvider(GROQ_API_KEY, GROQ_ENDPOINT, GROQ_MODEL, messages, false),
        input.text,
        input.mode
      )
      if (parsed) return { ...parsed, mode: input.mode ?? 'clean' }
      console.error('[ice-source-refine] fallback provider returned an unusable response')
    } catch (error) {
      console.error(
        '[ice-source-refine] fallback provider failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
    }
  }

  return null
}

Deno.serve(async (request) => {
  const headers = corsHeaders()
  if (request.method === 'OPTIONS') return new Response(null, { headers })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers)

  const responseHeaders = noStore(headers)
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Source refinement is temporarily unavailable.' }, 503, responseHeaders)
  }

  let payload: unknown
  try {
    payload = JSON.parse(await readTextBody(request, MAX_REQUEST_BYTES))
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ error: 'Invalid request.' }, 413, responseHeaders)
    }
    return json({ error: 'Invalid request.' }, 400, responseHeaders)
  }

  const input = parsePayload(payload)
  if (!input) return json({ error: 'Invalid source text.' }, 400, responseHeaders)

  const ip = requestIp(request).slice(0, 80)
  const client = createClient<any>(SUPABASE_URL, SERVICE_KEY)
  try {
    if (!(await checkRateLimit(client, ip))) {
      return json({ error: 'Too many requests. Please try again later.' }, 429, responseHeaders)
    }
  } catch (error) {
    console.error(
      '[ice-source-refine] rate-limit check failed',
      error instanceof Error ? error.message : 'unknown-error'
    )
    return json({ error: 'Source refinement is temporarily unavailable.' }, 503, responseHeaders)
  }

  const result = await refine(input)
  if (!result) {
    return json({ error: 'Source refinement is temporarily unavailable.' }, 502, responseHeaders)
  }

  return json(
    {
      isReport: result.isReport,
      text: result.text,
      generatedBy: 'ai' as const,
      mode: result.mode,
      sourceUrl: input.sourceUrl,
    },
    200,
    responseHeaders
  )
})
