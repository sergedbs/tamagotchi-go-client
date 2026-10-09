import { describe, expect, it } from 'vitest'
import { battleIsTerminal, deliveryInFlight, occurrenceAvailability, raidRewardMeaning } from './status.ts'

const NOW = Date.parse('2026-10-09T12:00:00.000Z')

describe('combat status helpers', () => {
  it('knows terminal battle states', () => {
    expect(battleIsTerminal('ONGOING')).toBe(false)
    expect(battleIsTerminal('PENDING_ACCEPT')).toBe(false)
    expect(['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].every((status) => battleIsTerminal(status as 'COMPLETED'))).toBe(true)
  })

  it('treats only not-ready and pending delivery as in flight', () => {
    expect(deliveryInFlight('PENDING')).toBe(true)
    expect(deliveryInFlight('NOT_READY')).toBe(true)
    expect(deliveryInFlight('PARTIAL')).toBe(false)
    expect(deliveryInFlight('NEEDS_ATTENTION')).toBe(false)
  })

  it('requires an active occurrence inside its window', () => {
    const window = (status: 'active' | 'scheduled', from: string, until: string) => ({ status, available_from: from, available_until: until })
    expect(occurrenceAvailability(window('active', '2026-10-09T11:00:00Z', '2026-10-09T13:00:00Z'), NOW)).toBe('available')
    expect(occurrenceAvailability(window('active', '2026-10-09T09:00:00Z', '2026-10-09T10:00:00Z'), NOW)).toBe('closed')
    expect(occurrenceAvailability(window('scheduled', '2026-10-09T19:00:00Z', '2026-10-09T20:00:00Z'), NOW)).toBe('upcoming')
    expect(occurrenceAvailability({ status: 'cancelled', available_from: '2026-10-09T11:00:00Z', available_until: '2026-10-09T13:00:00Z' }, NOW)).toBe('closed')
  })

  it('explains distinct reward semantics', () => {
    expect(raidRewardMeaning('CANCELLED')).toMatch(/no rewards/)
    expect(raidRewardMeaning('FAILED')).toMatch(/Defeat rewards/)
  })
})
