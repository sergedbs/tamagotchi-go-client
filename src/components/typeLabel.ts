import type { CombatType } from '../features/creatures/dto.ts'

const LABELS: Record<CombatType, string> = {
  FLAME: 'Flame',
  NATURE: 'Nature',
  EARTH: 'Earth',
  ELECTRIC: 'Electric',
  WATER: 'Water',
  SHADOW: 'Shadow',
}

export function typeLabel(type: CombatType): string {
  return LABELS[type]
}
