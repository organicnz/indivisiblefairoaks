import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  buildMessages,
  parseCandidates,
  parseTriageResponse,
  type TriageCandidate,
  type TriageDecision,
} from './logic.ts'
import { readTextBody, RequestBodyTooLargeError } from '../_shared/request-body.ts'

/**
 * AI triage for the discovery review queue.
 *
 * The Next.js deployment does not hold a model key. This function does, so the
 * admin action calls it with the service key and the key never leaves the
 * Supabase project — the same boundary `ice-source-refine` uses for the source
 * crawler.
 *
 * Auth is deliberately in code, not `verify_jwt`: the caller presents a new
 * `sb_secret_` key, and those keys are not JWTs. The exact constant-time check
 * mirrors `ice-scan`. An unauthenticated POST must never spend model credits.
 */

const APP_URL = Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org'
const ZAI_API_KEY = Deno.env.get('ZAI_API_KEY') ?? ''
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const ZAI_MODEL = Deno.env.get('ICE_ZAI_MODEL') ?? 'glm-4.5-flash'
const GROQ_MODEL = Deno.env.get('ICE_GROQ_MODEL') ?? 'llama-3.3-70b-versatile'
const MAX_REQUEST_BYTES = 64_000
const PROVIDER_TIMEOUT_MS = 20_000
const MAX_OUTPUT_TOKENS = 2_500
const ZAI_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const NO_STORE = { 'cache-control': 'no-store' }

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': APP_URL,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  }
}

/** Constant-time comparison so an auth probe cannot learn the secret by timing. */
function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

function inboundKeys() {
  const keys = new Set<string>()
  const plural = Deno.env.get('SUPABASE_SECRET_KEYS') ?? ''
  if (plural) {
    try {
      const parsed = JSON.parse(plural) as unknown
      if (parsed && typeof parsed === 'object') {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
          if (typeof value === 'string' && value.length > 0) keys.add(value)
        }
      }
    } catch {
      // A malformed platform value must not crash the endpoint; the legacy key
      // below is still a valid fallback.
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (legacy) keys.add(legacy)
  return [...keys]
}

const INBOUND_KEYS = inboundKeys()

function authorized(request: Request) {
  if (INBOUND_KEYS.length === 0) return false
  const authorization = request.headers.get('authorization') ?? ''
  const apikey = request.headers.get('apikey') ?? ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const candidates = [apikey, bearer].filter((value) => value.length > 0)
  return INBOUND_KEYS.some((key) =>
    candidates.some((value) => timingSafeEqual(value, key))
  )
}

type Provider = {
  name: string
  key: string
  endpoint: string
  model: string
  zai: boolean
}

function configuredProviders(): Provider[] {
  return [
    {
      name: 'primary',
      key: ZAI_API_KEY,
      endpoint: ZAI_ENDPOINT,
      model: ZAI_MODEL,
      zai: true,
    },
    {
      name: 'fallback',
      key: GROQ_API_KEY,
      endpoint: GROQ_ENDPOINT,
      model: GROQ_MODEL,
      zai: false,
    },
  ].filter((provider) => Boolean(provider.key))
}

async function callProvider(
  provider: Provider,
  candidates: readonly TriageCandidate[]
): Promise<string> {
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${provider.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      messages: buildMessages(candidates),
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: false,
      ...(provider.zai ? { thinking: { type: 'disabled' } } : {}),
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`provider-${response.status}`)

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('empty-provider-response')
  return content.trim()
}

async function generate(
  candidates: readonly TriageCandidate[]
): Promise<{ results: TriageDecision[]; model: string } | null> {
  for (const provider of configuredProviders()) {
    try {
      const decisions = parseTriageResponse(await callProvider(provider, candidates), candidates)
      if (decisions) return { results: decisions, model: provider.model }
      console.error(`[ice-discovery-triage] ${provider.name} returned unusable JSON`)
    } catch (error) {
      console.error(
        `[ice-discovery-triage] ${provider.name} failed`,
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

  const responseHeaders = { ...headers, ...NO_STORE }
  if (!authorized(request)) {
    return json({ error: 'Unauthorized.' }, 401, responseHeaders)
  }

  if (configuredProviders().length === 0) {
    return json({ error: 'No AI provider configured.' }, 503, responseHeaders)
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

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request.' }, 400, responseHeaders)
  }
  const candidates = parseCandidates((payload as Record<string, unknown>).candidates)
  if (!candidates) return json({ error: 'Invalid candidates.' }, 400, responseHeaders)

  const result = await generate(candidates)
  if (!result) {
    return json({ error: 'AI triage is temporarily unavailable.' }, 502, responseHeaders)
  }

  return json({ results: result.results, model: result.model }, 200, responseHeaders)
})
