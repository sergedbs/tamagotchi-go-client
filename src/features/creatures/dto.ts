import { z } from 'zod'

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

export interface PrimarySelection {
  user_id: string
  tamagotchi_id: string | null
  version: number
}

export interface Holders {
  tamagotchi_id: string
  origin_owner_id: string
  holder_user_ids: string[]
  holder_cap: number
  version: number
}

const statValue = z.union([z.number(), z.string(), z.boolean()])

export const tamagotchiSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin_package_id: z.string(),
  config_version: z.number().int(),
  origin_owner_id: z.string(),
  holder_user_ids: z.array(z.string()),
  role: z.enum(['PRIMARY', 'SECONDARY']),
  combat_type: z.enum(COMBAT_TYPES),
  level: z.number().int(),
  xp: z.number().int(),
  sprite_ref: z.string(),
  package_stats: z.record(z.string(), statValue),
  acquired_at: z.string(),
  version: z.number().int(),
})

export const collectionSchema = z.object({
  user_id: z.string(),
  primary: tamagotchiSchema.nullable(),
  secondary: z.array(tamagotchiSchema),
  next_cursor: z.string().nullable(),
  retrieved_at: z.string(),
})

export const careReceiptSchema = z.object({
  care_action_id: z.string(),
  tamagotchi: tamagotchiSchema,
  currency_status: z.literal('PENDING'),
})

export const primarySelectionSchema = z.object({
  user_id: z.string(),
  tamagotchi_id: z.string().nullable(),
  version: z.number().int(),
})

export const holdersSchema = z.object({
  tamagotchi_id: z.string(),
  origin_owner_id: z.string(),
  holder_user_ids: z.array(z.string()),
  holder_cap: z.number().int(),
  version: z.number().int(),
})
