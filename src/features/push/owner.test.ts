import { afterEach, describe, expect, it } from 'vitest'
import { ownerAction, readOwner, writeOwner } from './owner.ts'

const A = '01a15000-0000-7000-8000-0000000000a1'
const B = '01a15000-0000-7000-8000-0000000000b1'
const DEVICE = '01a15000-0000-7000-8000-00000000d001'

afterEach(() => writeOwner(null))

describe('push owner record', () => {
  it('round-trips the owner and device ID only', () => {
    writeOwner({ user_id: A, device_id: DEVICE })
    expect(readOwner()).toEqual({ user_id: A, device_id: DEVICE })
    expect(Object.values(window.localStorage).join(' ')).not.toMatch(/token/i)
    writeOwner(null)
    expect(readOwner()).toBeNull()
  })

  it('ignores malformed records', () => {
    window.localStorage.setItem('tamagotchi-go.push-owner', '{"user_id":"x"}')
    expect(readOwner()).toBeNull()
    window.localStorage.setItem('tamagotchi-go.push-owner', 'not json')
    expect(readOwner()).toBeNull()
    window.localStorage.setItem('tamagotchi-go.push-owner', JSON.stringify({ user_id: A, device_id: 'x' }))
    expect(readOwner()).toEqual({ user_id: A, device_id: null })
  })
})

describe('ownerAction', () => {
  it.each([
    [null, 'granted', 'none'],
    [{ user_id: A, device_id: DEVICE }, 'granted', 'listen'],
    [{ user_id: A, device_id: null }, 'denied', 'none'],
    [{ user_id: B, device_id: DEVICE }, 'granted', 'release'],
    [{ user_id: B, device_id: null }, 'default', 'release'],
  ] as const)('owner %j with permission %s signed in as A -> %s', (owner, permission, expected) => {
    expect(ownerAction(owner, A, permission)).toBe(expected)
  })
})
