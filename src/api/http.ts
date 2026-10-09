import type { ActivityObserver } from './activity.ts'
import { ApiError, parseProblem } from './errors.ts'
import { newUuidV7 } from './uuid.ts'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type QueryValue = string | number | boolean | null | undefined

export const REQUEST_TIMEOUT_MS = 10_000

export interface ApiRequest<T = unknown> {
  method: HttpMethod
  /** Gateway path including the service prefix, built with apiPath(). */
  path: string
  query?: Record<string, QueryValue>
  body?: unknown
  /** 'public' never sends Authorization, even when signed in. */
  auth: 'user' | 'public'
  idempotencyKey?: string
  /** Exact ETag from the resource read, quotes included. */
  ifMatch?: string
  signal?: AbortSignal
  timeoutMs?: number
  /** Optional validation of the success body. */
  parse?: (value: unknown) => T
}

export interface ApiResponse<T> {
  data: T
  status: number
  etag: string | null
  correlationId: string | null
}

/** Encodes every interpolated value as one path segment. */
export function apiPath(strings: TemplateStringsArray, ...values: (string | number)[]): string {
  return strings.reduce((path, part, index) => {
    const value = index < values.length ? encodeURIComponent(String(values[index])) : ''
    return path + part + value
  }, '')
}

/** Route template for diagnostics: strips IDs so logs never carry identifiers. */
export function routeTemplate(path: string): string {
  return path
    .split('/')
    .map((segment) => (/^[0-9a-f-]{36}$/i.test(segment) || /^\d+$/.test(segment) ? ':id' : segment))
    .join('/')
}

function buildUrl(baseUrl: string, path: string, query: Record<string, QueryValue> | undefined): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const search = params.toString()
  return `${baseUrl}${path}${search ? `?${search}` : ''}`
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

function isJson(contentType: string): boolean {
  return /^application\/(problem\+)?json\b/i.test(contentType.trim())
}

export interface SendOptions {
  baseUrl: string
  accessToken: string | null
  fetchImpl?: typeof fetch
  /** Opt-in diagnostics: receives a redacted record of every attempt. */
  observe?: ActivityObserver
}

/** Times one attempt and reports it to the optional observer (never the body or headers). */
export async function sendRequest<T>(request: ApiRequest<T>, options: SendOptions): Promise<ApiResponse<T>> {
  if (!options.observe) return attempt(request, options)
  const started = performance.now()
  const report = (status: number | null, outcome: string, code: string | null, correlationId: string | null) =>
    options.observe?.({ at: Date.now(), method: request.method, route: routeTemplate(request.path), status, durationMs: Math.round(performance.now() - started), outcome, code, correlationId })
  try {
    const response = await attempt(request, options)
    report(response.status, 'ok', null, response.correlationId)
    return response
  } catch (error) {
    if (error instanceof ApiError) report(error.status, error.kind, error.code, error.correlationId)
    throw error
  }
}

/**
 * One transport attempt. Fresh UUIDv7 correlation ID per attempt, combined
 * caller/timeout abort with timer cleanup, redirects refused, Problem/204 handled.
 */
async function attempt<T>(request: ApiRequest<T>, options: SendOptions): Promise<ApiResponse<T>> {
  const fetchImpl = options.fetchImpl ?? fetch
  const route = routeTemplate(request.path)
  const failure = (init: Omit<ConstructorParameters<typeof ApiError>[0], 'method' | 'route'>) =>
    new ApiError({ ...init, method: request.method, route })

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Correlation-Id': newUuidV7(),
  }
  if (request.body !== undefined) headers['Content-Type'] = 'application/json'
  if (request.auth === 'user' && options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`
  if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey
  if (request.ifMatch) headers['If-Match'] = request.ifMatch

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), request.timeoutMs ?? REQUEST_TIMEOUT_MS)
  const signal = request.signal ? AbortSignal.any([request.signal, timeout.signal]) : timeout.signal

  let response: Response
  try {
    response = await fetchImpl(buildUrl(options.baseUrl, request.path, request.query), {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal,
      redirect: 'manual',
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch (error) {
    clearTimeout(timer)
    if (request.signal?.aborted) throw failure({ kind: 'aborted', message: 'Request cancelled' })
    if (timeout.signal.aborted) throw failure({ kind: 'timeout', message: 'Request timed out' })
    throw failure({ kind: 'network', message: error instanceof Error ? error.message : 'Network failure' })
  }

  try {
    const correlationId = response.headers.get('x-correlation-id')
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      throw failure({ kind: 'redirect', message: 'API redirect refused', status: response.status || null, correlationId })
    }
    const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'))
    const contentType = response.headers.get('content-type') ?? ''

    if (response.status === 204 || response.status === 205) {
      return { data: undefined as T, status: response.status, etag: response.headers.get('etag'), correlationId }
    }

    let json: unknown
    let parsed = false
    if (isJson(contentType)) {
      try {
        json = await response.json()
        parsed = true
      } catch {
        parsed = false
      }
    }

    if (!response.ok) {
      const problem = parsed ? parseProblem(json) : null
      if (!problem && !parsed) {
        throw failure({
          kind: 'invalid_response',
          message: `HTTP ${response.status} without an API error body`,
          status: response.status,
          correlationId,
          retryAfterSeconds,
        })
      }
      throw failure({
        kind: 'http',
        message: problem?.title || `HTTP ${response.status}`,
        status: response.status,
        problem,
        correlationId,
        retryAfterSeconds,
      })
    }

    if (!parsed) {
      throw failure({ kind: 'invalid_response', message: 'Expected an API JSON response', status: response.status, correlationId })
    }
    let data: T
    try {
      data = request.parse ? request.parse(json) : (json as T)
    } catch (error) {
      throw failure({
        kind: 'invalid_response',
        message: error instanceof Error ? `Unexpected response shape: ${error.message.slice(0, 200)}` : 'Unexpected response shape',
        status: response.status,
        correlationId,
      })
    }
    return { data, status: response.status, etag: response.headers.get('etag'), correlationId }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (request.signal?.aborted) throw failure({ kind: 'aborted', message: 'Request cancelled' })
    if (timeout.signal.aborted) throw failure({ kind: 'timeout', message: 'Request timed out' })
    throw failure({ kind: 'network', message: error instanceof Error ? error.message : 'Network failure' })
  } finally {
    clearTimeout(timer)
  }
}

/** Session hooks the client needs; implemented by the in-memory session store. */
export interface SessionAuth {
  /** A valid access token, refreshing shortly before expiry; null when signed out. */
  getAccessToken(): Promise<string | null>
  /** Forces one coordinated refresh after a 401; resolves false if the session ended. */
  refreshAfterUnauthorized(rejectedToken: string): Promise<boolean>
}

export interface ApiClient {
  request<T>(request: ApiRequest<T>): Promise<ApiResponse<T>>
}

/**
 * Session-aware client. A GET is retried once after a successful refresh;
 * mutations are never replayed automatically after a 401.
 */
export function createApiClient(options: { baseUrl: string; session: SessionAuth; fetchImpl?: typeof fetch; observe?: ActivityObserver }): ApiClient {
  const send = <T>(request: ApiRequest<T>, accessToken: string | null) =>
    sendRequest(request, { baseUrl: options.baseUrl, accessToken, fetchImpl: options.fetchImpl, observe: options.observe })
  return {
    async request<T>(request: ApiRequest<T>): Promise<ApiResponse<T>> {
      const token = request.auth === 'user' ? await options.session.getAccessToken() : null
      try {
        return await send(request, token)
      } catch (error) {
        const unauthorized = error instanceof ApiError && error.status === 401 && request.auth === 'user' && token
        if (!unauthorized) throw error
        const refreshed = await options.session.refreshAfterUnauthorized(token)
        if (!refreshed || request.method !== 'GET') throw error
        const next = await options.session.getAccessToken()
        return send(request, next)
      }
    },
  }
}
