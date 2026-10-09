/** Test helpers for transport unit tests (not used by the application). */
import { vi } from 'vitest'

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const problem = status >= 400
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': problem ? 'application/problem+json' : 'application/json', ...headers },
  })
}

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'about:blank',
    title: 'Error',
    status,
    detail: `${code} detail`,
    instance: '/v1/x',
    code,
    correlation_id: '01a11e47-c352-7320-9957-baa3f0722d52',
    ...extra,
  }
}

export interface Recorded {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

/** A fetch mock that records requests and answers from a queue of handlers. */
export function fakeFetch(...handlers: ((request: Recorded) => Response | Promise<Response>)[]) {
  const calls: Recorded[] = []
  const queue = [...handlers]
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>))
    const recorded: Recorded = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(recorded)
    const handler = queue.shift()
    if (!handler) throw new Error(`Unexpected request ${recorded.method} ${recorded.url}`)
    return handler(recorded)
  })
  return { fetch: fn as unknown as typeof fetch, calls }
}

/** Unsigned JWT-shaped token carrying exp/roles hints for tests. */
export function testToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'none' })}.${encode(claims)}.sig`
}
