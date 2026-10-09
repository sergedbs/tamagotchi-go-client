import type { CombatType } from '../features/creatures/dto.ts'
import { typeLabel } from './typeLabel.ts'
import styles from './TypeBadge.module.css'

const SYMBOLS: Record<CombatType, string> = {
  FLAME: 'M12 4.2c2.8 2.8 4.7 5.3 4.7 8.4a4.7 4.7 0 0 1-9.4 0c0-1.7.7-3.1 1.8-4.2.1 1.4.8 2.3 1.9 2.7-.4-2.5.2-4.8 1-6.9Z',
  NATURE: 'M17.6 6.2C11 6.2 6.4 9.3 6.4 14.4c0 1 .2 1.9.6 2.7 1.9-4.3 4.9-6.6 8-7.7-2.7 1.8-5.5 4.6-7 8.1.8.3 1.7.5 2.6.5 5 0 7-4.3 7-11.8Z',
  EARTH: 'M4.6 17.6 10 8.2l2.9 4.9 2-3.1 4.5 7.6Z',
  ELECTRIC: 'M13.6 3.6 6.6 13.1h4.5l-1 7.4 7.4-9.9h-4.6Z',
  WATER: 'M12 4c2.9 3.6 5 6.5 5 9.3a5 5 0 0 1-10 0C7 10.5 9.1 7.6 12 4Z',
  SHADOW: 'M14.8 4.9a7.4 7.4 0 1 0 4.6 11.2 6.1 6.1 0 0 1-4.6-11.2Z',
}

export function TypeGlyph({ type, size = 24 }: { type: CombatType; size?: number }) {
  return (
    <svg className={styles.glyph} data-type={type} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11.5" className={styles.disc} />
      <path d={SYMBOLS[type]} className={styles.symbol} />
    </svg>
  )
}

/** Combat type as glyph plus text; colour is never the only signal. */
export function TypeBadge({ type, compact = false }: { type: CombatType; compact?: boolean }) {
  return (
    <span className={compact ? `${styles.badge} ${styles.compact}` : styles.badge} data-type={type}>
      <TypeGlyph type={type} size={compact ? 20 : 24} />
      <span>{typeLabel(type)}</span>
    </span>
  )
}
