import { describe, expect, it } from 'vitest'
import { presentationByKey } from '../../packages/presentation.ts'
import type { Tamagotchi } from './dto.ts'
import { careActions, careChanges, holderSummary, statRows, type CreatureView } from './view.ts'

const grove = presentationByKey('grove-companions')

const creature: Tamagotchi = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Mossling',
  origin_package_id: '00000000-0000-7000-8000-0000000000aa',
  config_version: 1,
  origin_owner_id: '00000000-0000-7000-8000-0000000000bb',
  holder_user_ids: ['00000000-0000-7000-8000-0000000000bb'],
  role: 'PRIMARY',
  combat_type: 'NATURE',
  level: 3,
  xp: 1240,
  sprite_ref: 'lythbound/wolfren/green',
  package_stats: { energy: 54, bond: 30, temperament: 'curious' },
  acquired_at: '2026-10-09T12:00:00.000Z',
  version: 4,
}

describe('statRows', () => {
  it('shows only defined stats with labels and factual ranges', () => {
    const rows = statRows({ creature, artUrl: null, presentation: grove })
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ['Energy', '54'],
      ['Bond', '30'],
      ['Temperament', 'Curious'],
    ])
    expect(rows[0]?.range).toEqual({ min: 0, max: 100, value: 54 })
    expect(rows[2]?.range).toBeNull()
  })

  it('renders raw API facts for an unknown package', () => {
    const rows = statRows({ creature: { ...creature, package_stats: { zeal: 4, shiny: true } }, artUrl: null, presentation: null })
    expect(rows).toEqual([
      { key: 'shiny', label: 'shiny', value: 'Yes', range: null, raw: true },
      { key: 'zeal', label: 'zeal', value: '4', range: null, raw: true },
    ])
  })

  it('reports a missing defined stat instead of inventing one', () => {
    const rows = statRows({ creature: { ...creature, package_stats: {} }, artUrl: null, presentation: grove })
    expect(rows[0]).toMatchObject({ value: 'Not set', range: null })
  })
})

describe('careActions', () => {
  it('lists declared actions with configured effects', () => {
    expect(careActions(grove).map((action) => [action.action, action.label, action.effects])).toEqual([
      ['FEED', 'Feed', ['Energy +10', '+2 XP']],
      ['PLAY', 'Play', ['Bond +5', 'Energy −3', '+3 XP']],
      ['REST', 'Rest', ['Energy +6', '+1 XP']],
    ])
  })

  it('offers no actions for unknown packages', () => {
    expect(careActions(null)).toEqual([])
  })
})

describe('careChanges', () => {
  it('compares two server states', () => {
    const before: CreatureView = { creature, artUrl: null, presentation: grove }
    const after = { ...creature, xp: 1242, package_stats: { ...creature.package_stats, energy: 64 } }
    expect(careChanges(before, after)).toEqual([
      { label: 'XP', before: '1,240', after: '1,242' },
      { label: 'Energy', before: '54', after: '64' },
    ])
  })
})

describe('holderSummary', () => {
  it('only mentions shared holders', () => {
    expect(holderSummary(creature)).toBeNull()
    expect(holderSummary({ ...creature, holder_user_ids: ['a', 'b', 'c'] })).toBe('Shared by 3 holders')
  })
})
