/**
 * DESIGN PREVIEW DATA ONLY. Loaded exclusively by the dev-only preview route; it is
 * never a runtime fallback and never stands in for server responses.
 */
import type { Tamagotchi } from '../dto.ts'

const OWNER = '00000000-0000-7000-8000-00000000a001'

function creature(overrides: Partial<Tamagotchi> & Pick<Tamagotchi, 'id' | 'name' | 'sprite_ref'>): Tamagotchi {
  return {
    origin_package_id: '00000000-0000-7000-8000-00000000b001',
    config_version: 1,
    origin_owner_id: OWNER,
    holder_user_ids: [OWNER],
    role: 'SECONDARY',
    combat_type: 'NATURE',
    level: 1,
    xp: 0,
    package_stats: {},
    acquired_at: '2026-10-09T09:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

export const previewPrimary = creature({
  id: '00000000-0000-7000-8000-00000000c001',
  name: 'Mossling',
  sprite_ref: 'lythbound/wolfren/green',
  role: 'PRIMARY',
  level: 4,
  xp: 1240,
  package_stats: { energy: 54, bond: 72, temperament: 'curious' },
})

export const previewOthers: { creature: Tamagotchi; presentationKey: string | null }[] = [
  {
    creature: creature({
      id: '00000000-0000-7000-8000-00000000c002',
      name: 'Ripple',
      sprite_ref: 'lythbound/laguna/blue',
      combat_type: 'WATER',
      origin_package_id: '00000000-0000-7000-8000-00000000b002',
      level: 2,
      xp: 310,
      package_stats: { hydration: 60, curiosity: 14, shell_polished: false },
    }),
    presentationKey: 'tidewater-companions',
  },
  {
    creature: creature({
      id: '00000000-0000-7000-8000-00000000c003',
      name: 'Cinder',
      sprite_ref: 'lythbound/igalyph/orange',
      combat_type: 'FLAME',
      origin_package_id: '00000000-0000-7000-8000-00000000b003',
      origin_owner_id: '00000000-0000-7000-8000-00000000a002',
      holder_user_ids: ['00000000-0000-7000-8000-00000000a002', OWNER],
      level: 6,
      xp: 2875,
    }),
    presentationKey: null,
  },
  {
    creature: creature({
      id: '00000000-0000-7000-8000-00000000c004',
      name: 'Pebblewick',
      sprite_ref: 'lythbound/nimblithe/brown',
      combat_type: 'EARTH',
      origin_package_id: '00000000-0000-7000-8000-00000000b003',
      level: 3,
      xp: 640,
    }),
    presentationKey: null,
  },
]

export const PREVIEW_CORRELATION_ID = '01a11e60-0000-7000-8000-000000000000'

export const PREVIEW_STATES = [
  'default',
  'loading',
  'long-name',
  'empty',
  'unknown-package',
  'care-pending',
  'care-done',
  'cooldown',
  'care-error',
  'unavailable',
] as const

export type PreviewState = (typeof PREVIEW_STATES)[number]
