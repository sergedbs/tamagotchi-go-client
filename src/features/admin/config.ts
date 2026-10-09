import { z } from 'zod'
import { packageConfigInputSchema, PUBLIC_ORIGIN_PLACEHOLDER, type AuthoredPackage } from '../../packages/schema.ts'

/** A Registry definition as sent to the API: the authored shape with absolute asset URLs. */
export const configDraftSchema = packageConfigInputSchema.extend({
  assets: z
    .array(z.strictObject({ sprite_ref: z.string().min(1).max(512), url: z.url({ protocol: /^https?$/ }) }))
    .min(1)
    .max(100),
})
export type ConfigDraft = z.output<typeof configDraftSchema>

export type DraftCheck = { ok: true; draft: ConfigDraft } | { ok: false; errors: string[] }

/** Validates a full configuration draft: bounds from the contract plus cross-references. */
export function checkDraft(text: string): DraftCheck {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['The draft is not valid JSON.'] }
  }
  const parsed = configDraftSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join('.') || 'draft'}: ${issue.message}`) }
  }
  const draft = parsed.data
  const errors: string[] = []
  const stats = new Map(draft.stats.map((stat) => [stat.key, stat]))
  if (stats.size !== draft.stats.length) errors.push('stats: keys must be unique.')
  const actions = new Set(draft.care_actions.map((rule) => rule.action))
  if (actions.size !== draft.care_actions.length) errors.push('care_actions: actions must be unique.')
  for (const rule of draft.care_actions) {
    for (const delta of rule.deltas) if (!stats.has(delta.stat_key)) errors.push(`care_actions.${rule.action}: changes undefined stat ${delta.stat_key}.`)
  }
  for (const bonus of draft.bonuses) if (stats.get(bonus.stat_key)?.value_type !== 'NUMBER') errors.push(`bonuses: ${bonus.stat_key} is not a number stat.`)
  for (const [key, value] of Object.entries(draft.starter.initial_stats)) {
    const stat = stats.get(key)
    if (!stat) errors.push(`starter.initial_stats: ${key} is not defined.`)
    else if (stat.value_type === 'NUMBER' && (typeof value !== 'number' || (stat.minimum !== null && value < stat.minimum) || (stat.maximum !== null && value > stat.maximum))) {
      errors.push(`starter.initial_stats: ${key} is outside its bounds.`)
    } else if (stat.value_type === 'STRING' && (typeof value !== 'string' || (stat.allowed_strings && !stat.allowed_strings.includes(value)))) {
      errors.push(`starter.initial_stats: ${key} is not an allowed value.`)
    } else if (stat.value_type === 'BOOLEAN' && typeof value !== 'boolean') errors.push(`starter.initial_stats: ${key} must be true or false.`)
  }
  const refs = new Set(draft.assets.map((asset) => asset.sprite_ref))
  if (refs.size !== draft.assets.length) errors.push('assets: sprite_ref values must be unique.')
  if (!refs.has(draft.starter.sprite_ref)) errors.push('starter.sprite_ref is missing from assets.')
  return errors.length > 0 ? { ok: false, errors } : { ok: true, draft }
}

/** Starts a draft from a bundled authored package, with this client's public origin. */
export function draftFromAuthored(authored: AuthoredPackage, origin: string): ConfigDraft {
  return {
    ...authored.definition,
    assets: authored.definition.assets.map((asset) => ({ ...asset, url: asset.url.replace(PUBLIC_ORIGIN_PLACEHOLDER, origin) })),
  }
}

export function formatDraft(draft: unknown): string {
  return `${JSON.stringify(draft, null, 2)}\n`
}
