import type { HttpMethod } from './http.ts'

/**
 * One transport attempt as diagnostics may see it: no bodies, query strings,
 * headers, tokens, tickets or messages; the route is an ID-free template.
 */
export interface Activity {
  at: number
  method: HttpMethod
  route: string
  status: number | null
  durationMs: number
  /** 'ok' or the failure kind (http, timeout, network, ...). */
  outcome: string
  code: string | null
  correlationId: string | null
}

export type ActivityObserver = (activity: Activity) => void
