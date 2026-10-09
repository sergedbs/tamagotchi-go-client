/** Tamagotchi service DTOs (docs/PAYLOADS.md#tamagotchi). snake_case is kept on purpose. */

export const COMBAT_TYPES = ['FLAME', 'NATURE', 'EARTH', 'ELECTRIC', 'WATER', 'SHADOW'] as const
export type CombatType = (typeof COMBAT_TYPES)[number]

export type PackageStatValue = number | string | boolean

export interface Tamagotchi {
  id: string
  name: string
  origin_package_id: string
  config_version: number
  origin_owner_id: string
  holder_user_ids: string[]
  role: 'PRIMARY' | 'SECONDARY'
  combat_type: CombatType
  level: number
  xp: number
  sprite_ref: string
  package_stats: Record<string, PackageStatValue>
  acquired_at: string
  version: number
}

export interface Collection {
  user_id: string
  primary: Tamagotchi | null
  secondary: Tamagotchi[]
  next_cursor: string | null
  retrieved_at: string
}

export interface CareReceipt {
  care_action_id: string
  tamagotchi: Tamagotchi
  currency_status: 'PENDING'
}
