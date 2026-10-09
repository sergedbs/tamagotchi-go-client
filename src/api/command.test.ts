import { describe, expect, it } from 'vitest'
import { commandRequest, createCommand } from './command.ts'

describe('createCommand', () => {
  it('snapshots the body and freezes it, so a retry sends exactly the same request', () => {
    const body = { action: 'FEED', nested: { at: '2026-10-09T12:00:00.123456Z' } }
    const command = createCommand({ method: 'POST', path: '/tamagotchi/v1/tamagotchis/x/care', body, idempotent: true, actor: 'u1' })
    body.action = 'PLAY'
    body.nested.at = 'changed'
    expect(command.body).toEqual({ action: 'FEED', nested: { at: '2026-10-09T12:00:00.123456Z' } })
    expect(Object.isFrozen(command.body)).toBe(true)
    const first = commandRequest(command)
    const retry = commandRequest(command)
    expect(retry.idempotencyKey).toBe(first.idempotencyKey)
    expect(retry.body).toBe(first.body)
  })

  it('gives each new intention a new UUIDv7 key', () => {
    const spec = { method: 'POST' as const, path: '/x', body: { action: 'FEED' }, idempotent: true, actor: 'u1' }
    const a = createCommand(spec)
    const b = createCommand(spec)
    expect(a.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })

  it('omits the key for endpoints without one', () => {
    expect(createCommand({ method: 'DELETE', path: '/x', idempotent: false, actor: 'u1' }).idempotencyKey).toBeUndefined()
  })
})
