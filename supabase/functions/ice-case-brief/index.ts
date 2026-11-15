// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  buildMessages,
  cleanText,
  fallbackBrief,
  imageFilenameIsUsable,
  isHttpsUrl,
  isSafeWikimediaImageUrl,
  parseModelBrief,
  titleCandidates,
  type CityImage,
  type IceBriefInput,
  type ModelBrief,
} from './logic.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ZAI_API_KEY = Deno.env.get('ZAI_API_KEY') ?? ''
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const ZAI_MODEL = Deno.env.get('ICE_ZAI_MODEL') ?? 'glm-4.5-flash'
const GROQ_MODEL = Deno.env.get('ICE_GROQ_MODEL') ?? 'llama-3.3-70b-versatile'
const RATE_MAX = positiveInt(Deno.env.get('ICE_AI_RATE_LIMIT_MAX'), 20, 100)
const RATE_MIN = positiveInt(Deno.env.get('ICE_AI_RATE_LIMIT_WINDOW_MIN'), 10, 60)
const MAX_REQUEST_BYTES = 4_000
const PROVIDER_TIMEOUT_MS = 10_000
const IMAGE_TIMEOUT_MS = 6_000
const ZAI_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const USER_AGENT =
  'IndivisibleFairOaks-IceCaseBrief/1.0 (https://indivisiblefairoaks.org; public-data map)'
const IMAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const IMAGE_MISS_TTL_MS = 15 * 60 * 1_000

type AnyClient = SupabaseClient<any>
type GeneratedBy = 'ai' | 'dataset'
type Json = Record<string, unknown>

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

function cleanField(value: unknown, max: number): string {
  return cleanText(value, max)
}

function parsePayload(raw: unknown): IceBriefInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const body = raw as Json

  const city = cleanField(body.city, 100)
  const state = cleanField(body.state, 80)
  const stateCode = cleanField(body.stateCode, 2).toUpperCase()
  const count = Number(body.count)
  const rank = Number(body.rank)
  const sharePercent = Number(body.sharePercent)
  const mappedRecords = Number(body.mappedRecords)
  const periodStart = cleanField(body.periodStart, 10)
  const periodEnd = cleanField(body.periodEnd, 10)
  const sourceName = cleanField(body.sourceName, 160)
  const sourceRelease = cleanField(body.sourceRelease, 400)
  const sourceUrl = cleanField(body.sourceUrl, 300)
  const sourceCitation = cleanField(body.sourceCitation, 800)

  // Five published city labels contain encoding artifacts (for example
  // `Caï¿½on City`) or a stray double quote. They are still real rows in this
  // snapshot; allow the punctuation rather than failing those points.
  if (!city || !/^[\p{L}\p{N} .'’()\-"\uFFFDï¿½]{1,100}$/u.test(city)) return null
  if (!state || !/^[\p{L} .'’()\-]{1,80}$/u.test(state)) return null
  if (!/^[A-Z]{2}$/.test(stateCode)) return null
  if (!Number.isInteger(count) || count < 1 || count > 10_000_000) return null
  if (!Number.isInteger(rank) || rank < 1 || rank > 100_000) return null
  if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) return null
  if (!Number.isInteger(mappedRecords) || mappedRecords < 1) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return null
  }
  if (!sourceName || !sourceRelease || !isHttpsUrl(sourceUrl)) return null

  return {
    city,
    state,
    stateCode,
    count,
    rank,
    sharePercent,
    mappedRecords,
    periodStart,
    periodEnd,
    sourceName,
    sourceRelease,
    sourceUrl,
    sourceCitation,
  }
}

async function checkRateLimit(client: AnyClient, ip: string): Promise<boolean> {
  const key = `ice:${ip}`
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
  messages: ReturnType<typeof buildMessages>
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
      temperature: 0.3,
      max_tokens: 450,
      stream: false,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`provider-${response.status}`)

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('empty-provider-response')
  return content.trim().slice(0, 5_000)
}

async function generateBrief(
  input: IceBriefInput
): Promise<{ brief: ModelBrief; generatedBy: GeneratedBy }> {
  const messages = buildMessages(input)

  if (ZAI_API_KEY) {
    try {
      const parsed = parseModelBrief(
        await callProvider(ZAI_API_KEY, ZAI_ENDPOINT, ZAI_MODEL, messages)
      )
      if (parsed) return { brief: parsed, generatedBy: 'ai' }
      console.error('[ice-case-brief] primary provider returned unusable JSON')
    } catch (error) {
      console.error(
        '[ice-case-brief] primary provider failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
    }
  }

  if (GROQ_API_KEY) {
    try {
      const parsed = parseModelBrief(
        await callProvider(GROQ_API_KEY, GROQ_ENDPOINT, GROQ_MODEL, messages)
      )
      if (parsed) return { brief: parsed, generatedBy: 'ai' }
      console.error('[ice-case-brief] fallback provider returned unusable JSON')
    } catch (error) {
      console.error(
        '[ice-case-brief] fallback provider failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
    }
  }

  // No provider, or both returned text that failed the grounding checks. A
  // deterministic note is safer than showing an unverified model paragraph.
  return { brief: fallbackBrief(input), generatedBy: 'dataset' }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`wikimedia-${response.status}`)
  return await response.json()
}

type ExtMetadata = Record<string, { value?: unknown }>
type CommonsImageInfo = {
  thumburl?: unknown
  extmetadata?: ExtMetadata
}

const imageCache = new Map<string, { value: CityImage | null; expiresAt: number }>()

async function fetchCityImageUncached(input: IceBriefInput): Promise<CityImage | null> {
  for (const title of titleCandidates(input.city, input.state, input.stateCode)) {
    try {
      const pageParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        redirects: '1',
        prop: 'pageimages',
        piprop: 'thumbnail|name',
        pithumbsize: '640',
        titles: title,
      })
      const page = (await fetchJson(`${WIKIPEDIA_API}?${pageParams}`)) as {
        query?: { pages?: Array<{ missing?: boolean; pageimage?: unknown }> }
      }
      const firstPage = page.query?.pages?.[0]
      if (!firstPage || firstPage.missing) continue

      const pageimage = cleanText(firstPage.pageimage, 240).replace(/^File:/i, '')
      if (!pageimage || !imageFilenameIsUsable(pageimage)) continue

      const commonsParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '640',
        titles: `File:${pageimage}`,
      })
      const commons = (await fetchJson(`${COMMONS_API}?${commonsParams}`)) as {
        query?: { pages?: Array<{ imageinfo?: CommonsImageInfo[] }> }
      }
      const info = commons.query?.pages?.[0]?.imageinfo?.[0]
      const url = cleanText(info?.thumburl, 1_000)
      if (!info || !isSafeWikimediaImageUrl(url)) continue

      const metadata = info.extmetadata ?? {}
      const artist = cleanText(metadata.Artist?.value, 140)
      const credit =
        artist || cleanText(metadata.Credit?.value, 140) || 'Wikimedia Commons contributor'
      const license = cleanText(metadata.LicenseShortName?.value, 80) || 'Wikimedia Commons'
      const licenseUrlRaw = cleanText(metadata.LicenseUrl?.value, 300)
      const licenseUrl = isHttpsUrl(licenseUrlRaw) ? licenseUrlRaw : null
      const fileTitle = pageimage.replace(/^File:/i, '')

      return {
        url,
        alt: `City reference image of ${input.city}, ${input.stateCode}. Not a case photograph.`,
        credit,
        license,
        licenseUrl,
        sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle)}`,
        kind: 'place-reference',
      }
    } catch (error) {
      console.error(
        '[ice-case-brief] city image lookup failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
    }
  }
  return null
}

async function fetchCityImage(input: IceBriefInput): Promise<CityImage | null> {
  const key = `${input.city}|${input.stateCode}`.toLowerCase()
  const cached = imageCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const value = await fetchCityImageUncached(input)
  imageCache.set(key, {
    value,
    // A transient Wikipedia/Commons failure should not suppress this city's
    // image for the full cache window.
    expiresAt: Date.now() + (value ? IMAGE_CACHE_TTL_MS : IMAGE_MISS_TTL_MS),
  })
  if (imageCache.size > 200) {
    const oldest = imageCache.keys().next().value
    if (oldest) imageCache.delete(oldest)
  }
  return value
}

function imageNotice(): string {
  return 'The FOIA extract contains no case photographs. City reference images, when available, come from Wikimedia Commons and are not case photos.'
}

Deno.serve(async (request) => {
  const headers = corsHeaders()
  if (request.method === 'OPTIONS') return new Response(null, { headers })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers)

  const responseHeaders = noStore(headers)
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'City context is temporarily unavailable.' }, 503, responseHeaders)
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Invalid request.' }, 413, responseHeaders)
  }

  let payload: unknown
  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: 'Invalid request.' }, 413, responseHeaders)
    }
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid request.' }, 400, responseHeaders)
  }

  const input = parsePayload(payload)
  if (!input) return json({ error: 'Invalid city context request.' }, 400, responseHeaders)

  const ip = requestIp(request).slice(0, 80)
  const client = createClient<any>(SUPABASE_URL, SERVICE_KEY)
  try {
    if (!(await checkRateLimit(client, ip))) {
      return json({ error: 'Too many requests. Please try again later.' }, 429, responseHeaders)
    }
  } catch (error) {
    console.error(
      '[ice-case-brief] rate-limit check failed',
      error instanceof Error ? error.message : 'unknown-error'
    )
    return json({ error: 'City context is temporarily unavailable.' }, 503, responseHeaders)
  }

  const [{ brief, generatedBy }, image] = await Promise.all([
    generateBrief(input).catch((error) => {
      console.error(
        '[ice-case-brief] brief generation failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
      return { brief: fallbackBrief(input), generatedBy: 'dataset' as const }
    }),
    fetchCityImage(input).catch((error) => {
      console.error(
        '[ice-case-brief] image lookup failed',
        error instanceof Error ? error.message : 'unknown-error'
      )
      return null
    }),
  ])

  return json(
    {
      headline: brief.headline,
      brief: brief.brief,
      caveats: brief.caveats,
      generatedAt: new Date().toISOString(),
      generatedBy,
      image,
      imageNotice: imageNotice(),
      city: {
        city: input.city,
        state: input.state,
        stateCode: input.stateCode,
        count: input.count,
        rank: input.rank,
        sharePercent: input.sharePercent,
      },
      source: {
        name: input.sourceName,
        url: input.sourceUrl,
        release: input.sourceRelease,
        citation: input.sourceCitation,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    },
    200,
    responseHeaders
  )
})
