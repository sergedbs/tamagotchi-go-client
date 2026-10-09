import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProxyOptions } from 'vite'
import { v7 as uuidv7 } from 'uuid'

export const DEFAULT_GATEWAY_UPSTREAM = 'http://127.0.0.1:3000'

/** Matches /api and /api/..., never /apiary. */
export const API_PREFIX = /^\/api(?=\/|\?|$)/

export function resolveGatewayUpstream(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_GATEWAY_UPSTREAM
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`GATEWAY_UPSTREAM is not a valid URL: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`GATEWAY_UPSTREAM must use http or https: ${raw}`)
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('GATEWAY_UPSTREAM must be an origin without path, query or credentials')
  }
  return url.origin
}

/** Removes the client /api prefix exactly once; Gateway removes the service prefix. */
export function stripApiPrefix(path: string): string {
  const stripped = path.replace(API_PREFIX, '')
  return stripped === '' || stripped.startsWith('?') ? `/${stripped}` : stripped
}

export function upstreamProblem(instance: string) {
  return {
    type: 'about:blank',
    title: 'Bad Gateway',
    status: 502,
    detail: 'The API gateway could not be reached from the web server.',
    instance: instance.slice(0, 2048) || '/',
    code: 'upstream_unavailable',
    correlation_id: uuidv7(),
  }
}

function isServerResponse(value: unknown): value is ServerResponse {
  return typeof value === 'object' && value !== null && 'writeHead' in value
}

export function apiProxy(upstream: string): Record<string, ProxyOptions> {
  return {
    [API_PREFIX.source]: {
      target: upstream,
      changeOrigin: true,
      followRedirects: false,
      ws: false,
      xfwd: false,
      rewrite: stripApiPrefix,
      configure(proxy) {
        proxy.on('error', (_error, req: IncomingMessage, res) => {
          if (!isServerResponse(res) || res.headersSent) {
            res.end()
            return
          }
          const problem = upstreamProblem(stripApiPrefix(req.url ?? '/').split('?')[0] ?? '/')
          res.writeHead(502, {
            'content-type': 'application/problem+json',
            'x-correlation-id': problem.correlation_id,
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify(problem))
        })
      },
    },
  }
}
