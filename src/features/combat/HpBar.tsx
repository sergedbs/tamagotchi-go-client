import { formatInteger } from '../../lib/format.ts'
import styles from './Combat.module.css'

/** Server-reported HP only; nothing is recalculated in the browser. */
export function HpBar({ current, max, label, size = 'normal' }: { current: number; max: number; label: string; size?: 'normal' | 'large' }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  return (
    <div className={size === 'large' ? `${styles.hp} ${styles.hpLarge}` : styles.hp}>
      <div className={styles.hpText}>
        <span>{label}</span>
        <span className="tabular">
          {formatInteger(current)} / {formatInteger(max)} HP
        </span>
      </div>
      <meter className={styles.hpMeter} min={0} max={max} value={current} low={max * 0.25} high={max * 0.5} optimum={max} aria-label={`${label}: ${formatInteger(current)} of ${formatInteger(max)} HP`} data-low={ratio <= 0.25 || undefined} />
    </div>
  )
}
