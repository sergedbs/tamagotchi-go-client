/** RFC 9457 Problem as returned by Gateway and services (docs/PAYLOADS.md#problem). */
export interface Problem {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: string
  correlation_id: string
}

export type ApiFailureKind =
  /** The server answered with an error status. */
  | 'http'
  /** No response: offline, DNS, refused connection, CORS. */
  | 'network'
  /** The local 10 s budget elapsed; the outcome of a mutation is unknown. */
  | 'timeout'
  /** The caller cancelled (navigation, unmount, logout). */
  | 'aborted'
  /** A redirect was refused for an API request. */
  | 'redirect'
  /** Non-JSON or malformed body where API JSON was expected (proxy/HTML fallback). */
  | 'invalid_response'

export class ApiError extends Error {
  readonly kind: ApiFailureKind
  readonly status: number | null
  readonly code: string | null
  readonly problem: Problem | null
  readonly correlationId: string | null
  readonly retryAfterSeconds: number | null
  readonly method: string
  readonly route: string

  constructor(init: {
    kind: ApiFailureKind
    message: string
    method: string
    route: string
    status?: number | null
    problem?: Problem | null
    correlationId?: string | null
    retryAfterSeconds?: number | null
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.method = init.method
    this.route = init.route
    this.status = init.status ?? null
    this.problem = init.problem ?? null
    this.code = init.problem?.code ?? null
    this.correlationId = init.problem?.correlation_id ?? init.correlationId ?? null
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
  }

  /** True when a mutation may have committed even though no success was observed. */
  get uncertain(): boolean {
    if (this.kind === 'timeout' || this.kind === 'network' || this.kind === 'invalid_response') return true
    return this.status === 502 || this.status === 504
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Parses a Problem body defensively; unknown or partial shapes still yield a usable error. */
export function parseProblem(value: unknown): Problem | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.status !== 'number' || typeof record.code !== 'string') return null
  const text = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : '')
  return {
    type: text('type') || 'about:blank',
    title: text('title'),
    status: record.status,
    detail: text('detail'),
    instance: text('instance'),
    code: record.code,
    correlation_id: text('correlation_id'),
  }
}

/** Safe, user-facing explanation. Server detail is plain text, never HTML. */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong in the client.'
  switch (error.kind) {
    case 'network':
      return 'Tamagotchi Go could not be reached. Check your connection.'
    case 'timeout':
      return 'The server did not answer in time.'
    case 'aborted':
      return 'The request was cancelled.'
    case 'redirect':
      return 'The API answered with a redirect, which the client refuses.'
    case 'invalid_response':
      return 'The server sent an unexpected response.'
    case 'http':
      break
  }
  switch (error.code) {
    case 'too_many_attempts':
      return error.retryAfterSeconds
        ? `Too many attempts. Wait ${error.retryAfterSeconds} s before trying again.`
        : 'Too many attempts. Wait a moment before trying again.'
    case 'too_many_tasks':
      return 'The server is busy. Try again in a moment.'
    case 'auth_keys_unavailable':
    case 'gateway_keys_unavailable':
      return 'The sign-in service is temporarily unavailable. Your account is not affected.'
    case 'upstream_unavailable':
    case 'dependency_error':
      return 'A Tamagotchi Go service is unavailable right now.'
    case 'task_timeout':
      return 'The server ran out of time; the operation may or may not have completed.'
    case 'idempotency_conflict':
      return 'This request conflicts with an earlier attempt that used different details.'
    case 'command_in_progress':
      return 'This action is still being processed.'
    case 'precondition_failed':
      return 'This changed since you loaded it. Reload and review before saving again.'
  }
  if (error.status === 401) return 'Your session has ended. Sign in again.'
  if (error.status === 403) return 'You do not have permission to do that.'
  if (error.status === 404) return 'That item is not available.'
  if (error.problem?.detail) return error.problem.detail
  return `The request failed (HTTP ${error.status ?? 'unknown'}).`
}
