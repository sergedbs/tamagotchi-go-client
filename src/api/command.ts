import type { ApiRequest, HttpMethod } from './http.ts'
import { newUuidV7 } from './uuid.ts'

/**
 * A logical mutation, snapshotted before sending. An explicit retry re-sends the
 * exact method, path, body and Idempotency-Key; a new intention gets a new key.
 */
export interface Command<T = unknown> {
  readonly method: Exclude<HttpMethod, 'GET'>
  readonly path: string
  readonly body: unknown
  readonly idempotencyKey: string | undefined
  readonly ifMatch: string | undefined
  readonly auth: 'user' | 'public'
  readonly parse: ((value: unknown) => T) | undefined
  /** Who issued it; a replay after re-login is only allowed for the same user. */
  readonly actor: string | null
}

export interface CommandSpec<T> {
  method: Exclude<HttpMethod, 'GET'>
  path: string
  body?: unknown
  /** Whether the endpoint takes an Idempotency-Key (see the endpoint appendix). */
  idempotent: boolean
  ifMatch?: string
  auth?: 'user' | 'public'
  parse?: (value: unknown) => T
  actor: string | null
}

function deepFreeze<V>(value: V): V {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

export function createCommand<T>(spec: CommandSpec<T>): Command<T> {
  return Object.freeze({
    method: spec.method,
    path: spec.path,
    body: spec.body === undefined ? undefined : deepFreeze(structuredClone(spec.body)),
    idempotencyKey: spec.idempotent ? newUuidV7() : undefined,
    ifMatch: spec.ifMatch,
    auth: spec.auth ?? 'user',
    parse: spec.parse,
    actor: spec.actor,
  })
}

export function commandRequest<T>(command: Command<T>, signal?: AbortSignal): ApiRequest<T> {
  return {
    method: command.method,
    path: command.path,
    body: command.body,
    auth: command.auth,
    idempotencyKey: command.idempotencyKey,
    ifMatch: command.ifMatch,
    parse: command.parse,
    signal,
  }
}
