import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Collection, Tamagotchi } from './dto.ts'
import { applyCreatureState, creatureKeys, flattenCollection } from './api.ts'

function creature(id: string, overrides: Partial<Tamagotchi> = {}): Tamagotchi {
  return {
    id,
    name: id,
    origin_package_id: 'p',
    config_version: 1,
    origin_owner_id: 'u',
    holder_user_ids: ['u'],
    role: 'SECONDARY',
    combat_type: 'WATER',
    level: 1,
    xp: 0,
    sprite_ref: 's',
    package_stats: {},
    acquired_at: '2026-10-09T00:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

function page(primary: Tamagotchi | null, secondary: Tamagotchi[], next: string | null): Collection {
  return { user_id: 'u', primary, secondary, next_cursor: next, retrieved_at: '2026-10-09T00:00:00.000Z' }
}

describe('flattenCollection', () => {
  it('takes primary from the first page and de-duplicates by id across pages', () => {
    const p = creature('p', { role: 'PRIMARY' })
    const result = flattenCollection([page(p, [creature('a'), creature('b')], 'c1'), page(p, [creature('b'), creature('c'), creature('p')], null)])
    expect(result.primary?.id).toBe('p')
    expect(result.secondary.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('handles an empty collection', () => {
    expect(flattenCollection([page(null, [], null)])).toEqual({ primary: null, secondary: [] })
    expect(flattenCollection(undefined)).toEqual({ primary: null, secondary: [] })
  })
})

describe('applyCreatureState', () => {
  it('replaces every cached copy with the server state', () => {
    const client = new QueryClient()
    client.setQueryData(creatureKeys.collection('u'), { pages: [page(creature('p'), [creature('a')], null)], pageParams: [null] })
    client.setQueryData(creatureKeys.creature('u', 'a'), { value: creature('a'), etag: '"1"' })
    applyCreatureState(client, 'u', creature('a', { xp: 5, version: 2 }), '"2"')
    const collection = client.getQueryData<{ pages: Collection[] }>(creatureKeys.collection('u'))
    expect(collection?.pages[0]?.secondary[0]?.xp).toBe(5)
    expect(client.getQueryData(creatureKeys.creature('u', 'a'))).toEqual({ value: creature('a', { xp: 5, version: 2 }), etag: '"2"' })
  })

  it('drops a stale ETag when the version changed without a new one', () => {
    const client = new QueryClient()
    client.setQueryData(creatureKeys.creature('u', 'a'), { value: creature('a'), etag: '"1"' })
    applyCreatureState(client, 'u', creature('a', { version: 3 }))
    expect(client.getQueryData(creatureKeys.creature('u', 'a'))).toMatchObject({ etag: null })
  })
})
