import { v7 } from 'uuid'

/**
 * The single UUIDv7 source for command keys, chat client IDs and correlation IDs.
 * crypto.randomUUID() produces v4 and must not be used for these.
 */
export function newUuidV7(): string {
  return v7()
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Server IDs are UUID strings (v7 for new records); validate before routing. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}
