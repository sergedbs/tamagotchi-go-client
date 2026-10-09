import { describe, expect, it } from 'vitest'
import { pendingRequestWith, relationshipWith } from './api.ts'

const request = (from: string, to: string, status = 'PENDING') => ({ request_id: `${from}-${to}`, from_user_id: from, to_user_id: to, status: status as 'PENDING', expires_at: '2026-10-10T00:00:00.000Z' })

describe('social helpers', () => {
  it('reports my relationship only, defaulting to stranger', () => {
    const items = [{ user_id: 'a', relationship: 'friend' as const }, { user_id: 'b', relationship: 'enemy' as const }]
    expect(relationshipWith(items, 'a')).toBe('friend')
    expect(relationshipWith(items, 'b')).toBe('enemy')
    expect(relationshipWith(items, 'c')).toBe('stranger')
  })

  it('separates incoming and outgoing pending requests', () => {
    const requests = [request('x', 'me'), request('me', 'y'), request('z', 'me', 'REJECTED')]
    expect(pendingRequestWith(requests, 'me', 'x').incoming?.request_id).toBe('x-me')
    expect(pendingRequestWith(requests, 'me', 'y').outgoing?.request_id).toBe('me-y')
    expect(pendingRequestWith(requests, 'me', 'z')).toEqual({ incoming: null, outgoing: null })
  })
})
