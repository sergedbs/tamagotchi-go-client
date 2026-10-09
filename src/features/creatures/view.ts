import type { AuthoredPackage, CareIcon } from '../../packages/schema.ts'
import { formatInteger, formatNumber, formatSigned } from '../../lib/format.ts'
import type { PackageStatValue, Tamagotchi } from './dto.ts'

export interface CreatureView {
  creature: Tamagotchi
  /** Validated artwork URL, or null when the sprite is unresolved. */
  artUrl: string | null
  /** Presentation for this exact package/config_version, or null when unknown. */
  presentation: AuthoredPackage | null
}

export interface StatRow {
  key: string
  label: string
  /** Display text for the value, e.g. "64" or "Curious". */
  value: string
  /** Factual range from the package definition, when numeric and bounded. */
  range: { min: number; max: number; value: number } | null
  /** True when the stat is not described by a known presentation. */
  raw: boolean
}

function displayValue(value: PackageStatValue | undefined): string {
  if (value === undefined) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return formatNumber(value)
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

/** Only stats the package defines; unknown packages show raw API keys and values. */
export function statRows(view: CreatureView): StatRow[] {
  const stats = view.creature.package_stats
  if (!view.presentation) {
    return Object.keys(stats)
      .sort()
      .map((key) => ({ key, label: key, value: displayValue(stats[key]), range: null, raw: true }))
  }
  const { definition, presentation } = view.presentation
  return definition.stats.map((stat) => {
    const value = stats[stat.key]
    const bounded =
      stat.value_type === 'NUMBER' && typeof value === 'number' && stat.minimum !== null && stat.maximum !== null && stat.maximum > stat.minimum
    return {
      key: stat.key,
      label: presentation.stats[stat.key]?.label ?? stat.key,
      value: displayValue(value),
      range: bounded ? { min: stat.minimum as number, max: stat.maximum as number, value: value as number } : null,
      raw: false,
    }
  })
}

export interface CareActionView {
  action: string
  label: string
  progressive: string
  icon: CareIcon
  /** Configured effects of this action, e.g. ["Energy +10", "+2 XP"]. */
  effects: string[]
}

export function careActions(presentation: AuthoredPackage | null): CareActionView[] {
  if (!presentation) return []
  return presentation.definition.care_actions.flatMap((rule) => {
    const shown = presentation.presentation.actions[rule.action]
    if (!shown) return []
    const effects = rule.deltas.map(
      (delta) => `${presentation.presentation.stats[delta.stat_key]?.label ?? delta.stat_key} ${formatSigned(delta.delta)}`,
    )
    if (rule.xp > 0) effects.push(`+${formatInteger(rule.xp)} XP`)
    return [{ action: rule.action, label: shown.label, progressive: shown.progressive, icon: shown.icon, effects }]
  })
}

export interface CareChange {
  label: string
  before: string
  after: string
}

/** Differences between two authoritative server states, for local feedback. */
export function careChanges(before: CreatureView, after: Tamagotchi): CareChange[] {
  const changes: CareChange[] = []
  if (after.level !== before.creature.level) {
    changes.push({ label: 'Level', before: String(before.creature.level), after: String(after.level) })
  }
  if (after.xp !== before.creature.xp) {
    changes.push({ label: 'XP', before: formatInteger(before.creature.xp), after: formatInteger(after.xp) })
  }
  const afterRows = statRows({ ...before, creature: after })
  for (const row of statRows(before)) {
    const next = afterRows.find((candidate) => candidate.key === row.key)
    if (next && next.value !== row.value) changes.push({ label: row.label, before: row.value, after: next.value })
  }
  return changes
}

export function holderSummary(creature: Tamagotchi): string | null {
  const count = creature.holder_user_ids.length
  return count > 1 ? `Shared by ${count} holders` : null
}

/** Local state of the latest care command on the shown creature. */
export type CareStatus =
  | { kind: 'idle' }
  | { kind: 'pending'; action: string }
  | { kind: 'done'; action: string; changes: CareChange[] }
  | { kind: 'cooldown'; action: string; retryAfterSeconds: number | null }
  | { kind: 'failed'; action: string; message: string; correlationId: string | null; uncertain: boolean }
