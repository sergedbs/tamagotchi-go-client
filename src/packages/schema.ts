import { z } from 'zod'

/**
 * Authored package file: one source for the fixture Registry definition
 * (PackageConfigInput) and the client presentation. Presentation-only fields are
 * stripped before an API body is built.
 */

const statKey = z.string().min(1).max(64)
const bound = z.number().min(-1_000_000).max(1_000_000)
const combatType = z.enum(['FLAME', 'NATURE', 'EARTH', 'ELECTRIC', 'WATER', 'SHADOW'])

export const statDefinitionSchema = z.strictObject({
  key: statKey,
  value_type: z.enum(['NUMBER', 'STRING', 'BOOLEAN']),
  minimum: bound.nullable(),
  maximum: bound.nullable(),
  allowed_strings: z.array(z.string().min(1).max(64)).max(50).nullable(),
})

export const careRuleSchema = z.strictObject({
  action: z.string().min(1).max(64),
  deltas: z.array(z.strictObject({ stat_key: statKey, delta: bound })).max(32),
  xp: z.int().min(0).max(1000),
  cooldown_seconds: z.int().min(1).max(86_400),
  local_currency: z.int().min(0).max(10_000),
})

export const bonusRuleSchema = z.strictObject({
  stat_key: statKey,
  operator: z.enum(['GT', 'GTE', 'LT', 'LTE']),
  threshold: bound,
  effect: z.enum(['ATTACK_BPS', 'DEFENSE_BPS']),
  value_bps: z.int().min(0).max(5000),
})

/** Asset URLs are authored against a placeholder origin supplied at fixture time. */
export const PUBLIC_ORIGIN_PLACEHOLDER = '<PUBLIC_CLIENT_ORIGIN>'

export const packageConfigInputSchema = z.strictObject({
  stats: z.array(statDefinitionSchema).min(1).max(32),
  bonuses: z.array(bonusRuleSchema).max(32),
  care_actions: z.array(careRuleSchema).min(1).max(32),
  daily_currency_cap: z.int().min(0).max(1_000_000),
  starter: z.strictObject({
    name: z.string().min(1).max(64),
    combat_type: combatType,
    sprite_ref: z.string().min(1).max(512),
    initial_stats: z.record(statKey, z.union([z.number(), z.string(), z.boolean()])),
  }),
  assets: z
    .array(
      z.strictObject({
        sprite_ref: z.string().min(1).max(512),
        url: z.string().startsWith(`${PUBLIC_ORIGIN_PLACEHOLDER}/assets/`),
      }),
    )
    .min(1)
    .max(100),
})

/** Lucide icons a presentation may name for a care action. */
export const CARE_ICONS = ['apple', 'sparkles', 'moon', 'droplets', 'compass', 'heart', 'brush'] as const

export const presentationSchema = z.strictObject({
  stats: z.record(statKey, z.strictObject({ label: z.string().min(1).max(32), unit: z.string().max(16).optional() })),
  actions: z.record(
    z.string().min(1).max(64),
    z.strictObject({
      label: z.string().min(1).max(24),
      icon: z.enum(CARE_ICONS),
      progressive: z.string().min(1).max(32),
    }),
  ),
})

export const authoredPackageSchema = z
  .strictObject({
    key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    package: z.strictObject({
      name: z.string().min(3).max(64),
      description: z.string().max(1000),
      version: z.string().min(1).max(32),
    }),
    definition: packageConfigInputSchema,
    presentation: presentationSchema,
  })
  .superRefine((authored, ctx) => {
    const statKeys = new Set(authored.definition.stats.map((stat) => stat.key))
    const actions = new Set(authored.definition.care_actions.map((rule) => rule.action))
    for (const key of statKeys) {
      if (!authored.presentation.stats[key]) ctx.addIssue({ code: 'custom', message: `stat ${key} has no presentation` })
    }
    for (const key of Object.keys(authored.presentation.stats)) {
      if (!statKeys.has(key)) ctx.addIssue({ code: 'custom', message: `presentation stat ${key} is not defined` })
    }
    for (const action of actions) {
      if (!authored.presentation.actions[action]) {
        ctx.addIssue({ code: 'custom', message: `care action ${action} has no presentation` })
      }
    }
    for (const action of Object.keys(authored.presentation.actions)) {
      if (!actions.has(action)) ctx.addIssue({ code: 'custom', message: `presentation action ${action} is not defined` })
    }
    for (const rule of authored.definition.care_actions) {
      for (const delta of rule.deltas) {
        if (!statKeys.has(delta.stat_key)) {
          ctx.addIssue({ code: 'custom', message: `${rule.action} changes undefined stat ${delta.stat_key}` })
        }
      }
    }
    const refs = new Set(authored.definition.assets.map((asset) => asset.sprite_ref))
    if (!refs.has(authored.definition.starter.sprite_ref)) {
      ctx.addIssue({ code: 'custom', message: 'starter sprite_ref is missing from assets' })
    }
  })

export type AuthoredPackage = z.output<typeof authoredPackageSchema>
export type StatDefinition = z.output<typeof statDefinitionSchema>
export type CareRule = z.output<typeof careRuleSchema>
export type CareIcon = (typeof CARE_ICONS)[number]
