import { z } from 'zod'
import { COMBAT_TYPES } from '../creatures/dto.ts'
import type { Boss } from '../combat/raids/api.ts'

const reward = z.strictObject({ global_currency: z.int().min(0).max(1_000_000), xp: z.int().min(0).max(1_000_000) })

/** BossInput bounds from the contract; special_properties is always empty. */
export const bossInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(64),
  description: z.string().max(1000),
  sprite_ref: z.string().trim().min(1).max(512),
  combat_type: z.enum(COMBAT_TYPES),
  max_hp: z.int().min(1).max(1_000_000_000),
  defense: z.int().min(0).max(1_000_000),
  weaknesses: z.array(z.enum(COMBAT_TYPES)).max(6),
  resistances: z.array(z.enum(COMBAT_TYPES)).max(6),
  special_properties: z.strictObject({}),
  duration_seconds: z.int().min(1).max(3600),
  max_participants: z.int().min(1).max(100),
  rewards: reward,
  defeat_rewards: reward.nullable(),
})
export type BossInput = z.output<typeof bossInputSchema>

export const EMPTY_BOSS: BossInput = {
  name: '',
  description: '',
  sprite_ref: 'lythbound/gryfon/spicy',
  combat_type: 'FLAME',
  max_hp: 1000,
  defense: 10,
  weaknesses: [],
  resistances: [],
  special_properties: {},
  duration_seconds: 900,
  max_participants: 10,
  rewards: { global_currency: 50, xp: 100 },
  defeat_rewards: null,
}

/** A full replacement body from the current definition (unknown properties are not carried). */
export function bossInputFrom(boss: Boss): BossInput {
  const { definition } = boss
  return { ...definition, special_properties: {} }
}

/** Field errors keyed by the first path segment, for inline display. */
export function bossErrors(value: unknown): Record<string, string> {
  const parsed = bossInputSchema.safeParse(value)
  if (parsed.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path.slice(0, issue.path[0] === 'rewards' || issue.path[0] === 'defeat_rewards' ? 2 : 1).join('.')
    errors[key] ??= issue.message
  }
  return errors
}
