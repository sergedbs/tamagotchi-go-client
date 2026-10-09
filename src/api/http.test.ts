import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, describeApiError } from './errors.ts'
import { apiPath, createApiClient, routeTemplate, sendRequest, type SessionAuth } from './http.ts'
import { fakeFetch, jsonResponse, problem } from './testing.ts'

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.useRealTimers()
})

describe('sendRequest', () => {
  it('sends JSON headers, a fresh v7 correlation ID, key and If-Match', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, { ok: true }, { etag: '"7"', 'x-correlation-id': 'c1' }))
    const response = await sendRequest(
      { method: 'PUT', path: '/x/v1/a', body: { a: 1 }, auth: 'user', idempotencyKey: 'k1', ifMatch: '"6"' },
      { baseUrl: '/api', accessToken: 'tok', fetchImpl: fetch },
    )
    expect(response).toEqual({ data: { ok: true }, status: 200, etag: '"7"', correlationId: 'c1' })
    const [call] = calls
    expect(call?.url).toBe('/api/x/v1/a')
    expect(call?.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok',
      'Idempotency-Key': 'k1',
      'If-Match': '"6"',
    })
    expect(call?.headers['X-Correlation-Id']).toMatch(V7)
    expect(call?.body).toEqual({ a: 1 })
  })

  it('omits Content-Type without a body and Authorization on public routes', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, {}))
    await sendRequest({ method: 'GET', path: '/r/v1/p', auth: 'public', query: { limit: 25, cursor: undefined } }, { baseUrl: '/api', accessToken: 'tok', fetchImpl: fetch })
    expect(calls[0]?.headers['Content-Type']).toBeUndefined()
    expect(calls[0]?.headers.Authorization).toBeUndefined()
    expect(calls[0]?.url).toBe('/api/r/v1/p?limit=25')
  })

  it('handles 204 without parsing JSON', async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 204 }))
    const response = await sendRequest({ method: 'DELETE', path: '/x', auth: 'user' }, { baseUrl: '', accessToken: 't', fetchImpl: fetch })
    expect(response.data).toBeUndefined()
  })

  it('turns Problem JSON into an ApiError with code, correlation and Retry-After', async () => {
    const body = problem(429, 'too_many_attempts', { type: 'https://errors.example.test/throttle' })
    const { fetch } = fakeFetch(() => jsonResponse(429, body, { 'retry-after': '7' }))
    const error = await sendRequest({ method: 'POST', path: '/u', auth: 'public', body: {} }, { baseUrl: '', accessToken: null, fetchImpl: fetch }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'http', status: 429, code: 'too_many_attempts', retryAfterSeconds: 7, correlationId: body.correlation_id })
    expect(describeApiError(error)).toBe('Too many attempts. Wait 7 s before trying again.')
  })

  it('keeps an unknown future code readable', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(422, problem(422, 'brand_new_rule')))
    const error = (await sendRequest({ method: 'POST', path: '/u', auth: 'user', body: {} }, { baseUrl: '', accessToken: 't', fetchImpl: fetch }).catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('brand_new_rule')
    expect(describeApiError(error)).toBe('brand_new_rule detail')
  })

  it('treats HTML from an API route as an invalid response, not data', async () => {
    const { fetch } = fakeFetch(() => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(sendRequest({ method: 'GET', path: '/x', auth: 'user' }, { baseUrl: '', accessToken: 't', fetchImpl: fetch })).rejects.toMatchObject({ kind: 'invalid_response' })
  })

  it('refuses redirects', async () => {
    const redirect = { type: 'opaqueredirect', status: 0, ok: false, headers: new Headers() } as Response
    const { fetch } = fakeFetch(() => redirect)
    await expect(sendRequest({ method: 'GET', path: '/x', auth: 'user' }, { baseUrl: '', accessToken: 't', fetchImpl: fetch })).rejects.toMatchObject({ kind: 'redirect' })
  })

  it('validates the success body when a parser is supplied', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(200, { nope: 1 }))
    const parse = (value: unknown) => {
      if (!(value as { id?: string }).id) throw new Error('id missing')
      return value
    }
    await expect(sendRequest({ method: 'GET', path: '/x', auth: 'user', parse }, { baseUrl: '', accessToken: 't', fetchImpl: fetch })).rejects.toMatchObject({ kind: 'invalid_response' })
  })

  it('distinguishes caller cancellation from the local timeout', async () => {
    const hang = (_request: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    const fetchImpl = vi.fn(hang) as unknown as typeof fetch

    const caller = new AbortController()
    const cancelled = sendRequest({ method: 'GET', path: '/x', auth: 'user', signal: caller.signal }, { baseUrl: '', accessToken: 't', fetchImpl })
    caller.abort()
    await expect(cancelled).rejects.toMatchObject({ kind: 'aborted' })

    const timedOut = sendRequest({ method: 'POST', path: '/x', auth: 'user', timeoutMs: 20, body: {} }, { baseUrl: '', accessToken: 't', fetchImpl })
    const error = (await timedOut.catch((e: unknown) => e)) as ApiError
    expect(error.kind).toBe('timeout')
    expect(error.uncertain).toBe(true)
  })

  it('reports network failure as uncertain for mutations', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const error = (await sendRequest({ method: 'POST', path: '/x', auth: 'user', body: {} }, { baseUrl: '', accessToken: 't', fetchImpl }).catch((e: unknown) => e)) as ApiError
    expect(error.kind).toBe('network')
    expect(error.uncertain).toBe(true)
  })
})

describe('apiPath and routeTemplate', () => {
  it('encodes each interpolated segment', () => {
    expect(apiPath`/users/v1/users/${'a/b?c'}/friends/${'x y'}`).toBe('/users/v1/users/a%2Fb%3Fc/friends/x%20y')
  })

  it('removes identifiers from diagnostic routes', () => {
    expect(routeTemplate('/tamagotchi/v1/users/01a11d09-508b-7095-80e3-cb2c2db6eca5/collection')).toBe('/tamagotchi/v1/users/:id/collection')
  })
})

describe('createApiClient', () => {
  function session(tokens: string[], refreshResult = true) {
    const queue = [...tokens]
    return {
      getAccessToken: vi.fn(async () => queue[0] ?? null),
      refreshAfterUnauthorized: vi.fn(async () => {
        queue.shift()
        return refreshResult
      }),
    } satisfies SessionAuth
  }

  it('retries a GET once after a successful refresh, with a new correlation ID', async () => {
    const auth = session(['old', 'new'])
    const { fetch, calls } = fakeFetch(
      () => jsonResponse(401, problem(401, 'unauthorized')),
      () => jsonResponse(200, { me: true }),
    )
    const client = createApiClient({ baseUrl: '/api', session: auth, fetchImpl: fetch })
    await expect(client.request({ method: 'GET', path: '/users/v1/users/me', auth: 'user' })).resolves.toMatchObject({ data: { me: true } })
    expect(calls.map((call) => call.headers.Authorization)).toEqual(['Bearer old', 'Bearer new'])
    expect(calls[0]?.headers['X-Correlation-Id']).not.toBe(calls[1]?.headers['X-Correlation-Id'])
  })

  it('never replays a mutation after a 401', async () => {
    const auth = session(['old', 'new'])
    const { fetch, calls } = fakeFetch(() => jsonResponse(401, problem(401, 'unauthorized')))
    const client = createApiClient({ baseUrl: '/api', session: auth, fetchImpl: fetch })
    await expect(client.request({ method: 'POST', path: '/x', auth: 'user', body: {}, idempotencyKey: 'k' })).rejects.toMatchObject({ status: 401 })
    expect(calls).toHaveLength(1)
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledWith('old')
  })

  it('stops after one refresh when the session has ended', async () => {
    const auth = session(['old'], false)
    const { fetch, calls } = fakeFetch(() => jsonResponse(401, problem(401, 'unauthorized')))
    const client = createApiClient({ baseUrl: '/api', session: auth, fetchImpl: fetch })
    await expect(client.request({ method: 'GET', path: '/x', auth: 'user' })).rejects.toMatchObject({ status: 401 })
    expect(calls).toHaveLength(1)
  })

  it('does not consult the session for public requests', async () => {
    const auth = session(['tok'])
    const { fetch, calls } = fakeFetch(() => jsonResponse(401, problem(401, 'invalid_credentials')))
    const client = createApiClient({ baseUrl: '/api', session: auth, fetchImpl: fetch })
    await expect(client.request({ method: 'POST', path: '/users/v1/users/login', auth: 'public', body: {} })).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(auth.getAccessToken).not.toHaveBeenCalled()
    expect(calls[0]?.headers.Authorization).toBeUndefined()
  })
})
